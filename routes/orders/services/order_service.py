# routes/orders/services/order_service.py

from typing import Dict, Optional
from ..validators.order_validator import OrderValidator
from ..validators.exchange_rules import ExchangeRules
from .broker_service import BrokerService
from .market_feed import MarketFeedService
from ..utils.formatters import format_order_response
from extensions import redis_client
from models import OrderLog, db
import json

class OrderService:
    def __init__(self):
        self.validator = OrderValidator()
        self.exchange_rules = ExchangeRules()
        self.broker = BrokerService()
        self.market_feed = MarketFeedService()

    async def place_order(self, client_id: str, order_data: Dict) -> Dict:
        """Place an order with validation and preprocessing"""
        try:
            print("Placing order for client:", client_id)
            print("Order data received:", order_data)

            # Get authentication tokens
            auth_data = self._get_auth_data(client_id)
            if not auth_data:
                raise ValueError("Invalid or expired session")

            # Pre-process order data
            processed_data = self._preprocess_order_data(order_data)
            print("Processed order data:", processed_data)

            # Validate order
            validated_data = self.validator.validate(processed_data)
            print("Validated order data:", validated_data)
            
            # Apply exchange rules
            processed_data = self.exchange_rules.apply_rules(
                validated_data,
                order_data['exchange']
            )

            # Get latest price for price validation (if LIMIT order)
            if processed_data['ordertype'] == 'LIMIT':
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
            print("Broker response:", response)

            # Log order
            try:
                await self._log_order(client_id, processed_data, response)
            except Exception as log_error:
                print(f"Error logging order: {str(log_error)}")
                # Continue even if logging fails

            # Return response
            return {
                'status': 'success',
                'message': 'Order placed successfully',
                'data': response
            }

        except Exception as e:
            print(f"Error placing order: {str(e)}")
            raise

    def _preprocess_order_data(self, order_data: Dict) -> Dict:
        """Preprocess order data before validation"""
        processed_data = order_data.copy()

        # Handle MARKET orders
        if processed_data.get('ordertype') == 'MARKET':
            processed_data['price'] = '0'
            processed_data['triggerprice'] = '0'
        elif processed_data.get('price') is None:
            processed_data['price'] = '0'

        # Convert quantity to string
        processed_data['quantity'] = str(processed_data.get('quantity', '0'))
        
        # Ensure price is string
        if 'price' in processed_data and processed_data['price'] is not None:
            processed_data['price'] = str(processed_data['price'])

        # Handle empty values
        processed_data['variety'] = processed_data.get('variety', 'NORMAL')
        processed_data['disclosedquantity'] = processed_data.get('disclosedquantity', '0')
        processed_data['triggerprice'] = str(processed_data.get('triggerprice', '0'))

        return processed_data

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
            # Parse response if it's a string
            if isinstance(response, str):
                response = json.loads(response)

            # Handle different response formats
            response_data = response.get('data', {}) if isinstance(response, dict) else {}
            
            log = OrderLog(
                user_id=client_id,
                order_id=str(response_data.get('orderid', '')),
                symbol=order_data.get('symbol', ''),
                exchange=order_data.get('exchange', ''),
                order_type=order_data.get('ordertype', ''),
                transaction_type=order_data.get('side', ''),
                product_type=order_data.get('producttype', ''),
                quantity=int(order_data.get('quantity', 0)),
                price=float(order_data['price']) if order_data.get('price', '0') != '0' else None,
                trigger_price=float(order_data['triggerprice']) if order_data.get('triggerprice', '0') != '0' else None,
                status=response.get('status', 'FAILED') if isinstance(response, dict) else 'UNKNOWN',
                message=response.get('message', '') if isinstance(response, dict) else str(response)
            )
            
            db.session.add(log)
            db.session.commit()
            print("Order logged successfully")
            
        except Exception as e:
            print(f"Error logging order: {str(e)}")
            print(f"Order data: {order_data}")
            print(f"Response: {response}")
            # Don't raise the exception as this is not critical for order placement