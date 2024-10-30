# routes/orders/services/order_service.py

from typing import Dict, Optional
from ..validators.order_validator import OrderValidator
from ..validators.exchange_rules import ExchangeRules
from .broker_service import BrokerService
from .market_feed import MarketFeedService
from ..utils.formatters import format_order_response
from extensions import redis_client
from models import OrderLog, db
from datetime import datetime

class OrderService:
    def __init__(self):
        self.validator = OrderValidator()
        self.exchange_rules = ExchangeRules()
        self.broker = BrokerService()
        self.market_feed = MarketFeedService()

    async def place_order(self, client_id: str, order_data: Dict) -> Dict:
        """Place an order with validation and preprocessing"""
        try:
            # Get authentication tokens from Redis
            auth_data = self._get_auth_data(client_id)
            if not auth_data:
                raise ValueError("Invalid or expired session")

            # Validate order
            validated_data = self.validator.validate(order_data)
            
            # Apply exchange rules
            processed_data = self.exchange_rules.apply_rules(
                validated_data,
                order_data['exchange']
            )

            # Get latest price
            latest_price = await self.market_feed.get_ltp(
                processed_data['token'],
                processed_data['exchange']
            )

            # Validate price
            if not self.validator.validate_price(
                processed_data['price'],
                latest_price,
                processed_data['ordertype']
            ):
                raise ValueError("Invalid price")

            # Place order with broker
            response = await self.broker.place_order(
                processed_data,
                auth_data['access_token'],
                auth_data['api_key']
            )

            # Log order
            await self._log_order(client_id, processed_data, response)

            # Format and return response
            return format_order_response(response)

        except Exception as e:
            # Log error
            print(f"Error placing order: {str(e)}")
            raise

    def _get_auth_data(self, client_id: str) -> Optional[Dict]:
        """Get authentication data from Redis"""
        try:
            user_data = redis_client.hgetall(f"user:{client_id}")
            if not user_data:
                return None

            return {
                'access_token': user_data.get(b'access_token', b'').decode('utf-8'),
                'api_key': user_data.get(b'api_key', b'').decode('utf-8')
            }
        except Exception as e:
            print(f"Error getting auth data from Redis: {str(e)}")
            return None

    async def _log_order(self, client_id: str, order_data: Dict, response: Dict) -> None:
        """Log order to database"""
        try:
            log = OrderLog(
                user_id=client_id,
                order_id=response.get('data', {}).get('orderid', ''),
                symbol=order_data['symbol'],
                exchange=order_data['exchange'],
                order_type=order_data['ordertype'],
                transaction_type=order_data['side'],
                product_type=order_data['producttype'],
                quantity=int(order_data['quantity']),
                price=float(order_data.get('price', 0)),
                trigger_price=float(order_data.get('triggerprice', 0)) 
                    if order_data.get('variety') == 'STOPLOSS' else None,
                status=response.get('status', 'FAILED'),
                message=response.get('message', '')
            )
            
            db.session.add(log)
            db.session.commit()
            
        except Exception as e:
            print(f"Error logging order: {str(e)}")
            # Don't raise exception as this is not critical

    async def modify_order(self, client_id: str, order_id: str, 
                         modifications: Dict) -> Dict:
        """Modify an existing order"""
        pass

    async def cancel_order(self, client_id: str, order_id: str) -> Dict:
        """Cancel an existing order"""
        pass