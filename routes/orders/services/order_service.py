# routes/orders/services/order_service.py
from typing import Dict, Optional
from ..validators.order_validator import OrderValidator
from ..validators.exchange_rules import ExchangeRules
from .broker_service import BrokerService
from .market_feed import MarketFeedService
from ..utils.formatters import format_order_response
from extensions import redis_client

class OrderService:
    def __init__(self):
        self.validator = OrderValidator()
        self.exchange_rules = ExchangeRules()
        self.broker = BrokerService()
        self.market_feed = MarketFeedService()

    async def place_order(self, user_id: str, order_data: Dict) -> Dict:
        """Place an order with validation and preprocessing"""
        try:
            # Get authentication tokens
            tokens = self._get_auth_tokens(user_id)
            if not tokens:
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
                tokens['access_token'],
                processed_data
            )

            # Format and return response
            return format_order_response(response)

        except Exception as e:
            # Log error
            print(f"Error placing order: {str(e)}")
            raise

    def _get_auth_tokens(self, user_id: str) -> Optional[Dict]:
        """Get authentication tokens from Redis/DB"""
        redis_key = f"user:{user_id}"
        tokens = redis_client.hgetall(redis_key)
        
        if tokens:
            return {
                'access_token': tokens.get('access_token'),
                'api_key': tokens.get('api_key')
            }
            
        return None

    async def modify_order(self, user_id: str, order_id: str, 
                         modifications: Dict) -> Dict:
        """Modify an existing order"""
        pass

    async def cancel_order(self, user_id: str, order_id: str) -> Dict:
        """Cancel an existing order"""
        pass