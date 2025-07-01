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

            # Validate order data
            validated_data = self.validator.validate(processed_data)
            print("Validated order data:", validated_data)

            # Apply exchange rules
            processed_data = self.exchange_rules.apply_rules(
                validated_data,
                validated_data['exchange']
            )

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

            # Parse broker response
            if isinstance(response, dict) and not response.get('success', True):
                raise ValueError(response.get('message', 'Order placement failed'))

            # Return success response
            return {
                'status': 'success',
                'message': 'Order placed successfully',
                'data': response
            }

        except ValueError as e:
            print(f"Validation error in order placement: {str(e)}")
            raise

        except Exception as e:
            print(f"Error placing order: {str(e)}")
            raise ValueError(str(e))

    def _preprocess_order_data(self, order_data: Dict) -> Dict:
        """Preprocess order data before validation"""
        processed_data = order_data.copy()

        # Handle variety and order types
        variety = processed_data.get('variety', 'NORMAL')
        original_order_type = processed_data.get('ordertype')

        # Handle STOPLOSS variety
        if variety == 'STOPLOSS':
            if original_order_type == 'MARKET':
                processed_data['ordertype'] = 'STOPLOSS_MARKET'
                processed_data['price'] = '0'
            elif original_order_type == 'LIMIT':
                processed_data['ordertype'] = 'STOPLOSS_LIMIT'
                if processed_data.get('price') is None or processed_data.get('price') == '0':
                    raise ValueError("Price is required for STOPLOSS_LIMIT orders")
                processed_data['price'] = str(float(processed_data['price']))
                # Handle trigger price
                if not processed_data.get('triggerprice'):
                    raise ValueError("Trigger price is required for STOPLOSS orders")
                processed_data['triggerprice'] = str(float(processed_data['triggerprice']))
        else:
            # Handle regular orders
            if original_order_type == 'MARKET':
                processed_data['price'] = '0'
                processed_data['triggerprice'] = '0'
            elif original_order_type == 'LIMIT':
                if processed_data.get('price') is None or processed_data.get('price') == '0':
                    raise ValueError("Price is required for LIMIT orders")
                processed_data['price'] = str(float(processed_data['price']))
                processed_data['triggerprice'] = '0'

        # Convert quantity to string
        try:
            quantity = int(processed_data.get('quantity', 0))
            if quantity <= 0:
                raise ValueError("Invalid quantity")
            processed_data['quantity'] = str(quantity)
        except (TypeError, ValueError):
            raise ValueError("Invalid quantity value")

        # Handle other defaults
        processed_data['variety'] = variety
        processed_data['disclosedquantity'] = processed_data.get('disclosedquantity', '0')

        print(f"Preprocessed order data: {processed_data}")
        return processed_data

    def _get_auth_data(self, client_id: str) -> Optional[Dict]:
        """Get authentication data from Redis"""
        try:
            print(f"Getting auth data for client: {client_id}")
            user_data = redis_client.hgetall(f"user:{client_id}")
            if not user_data:
                print("No user data found in Redis")
                return None

            # Convert bytes to string for all values
            user_data = {k.decode('utf-8') if isinstance(k, bytes) else k: 
                        v.decode('utf-8') if isinstance(v, bytes) else v 
                        for k, v in user_data.items()}

            # Get required tokens
            access_token = user_data.get('access_token', '').strip()
            api_key = user_data.get('api_key', '').strip()

            # Validate tokens
            if not access_token or not api_key:
                print("Missing required tokens")
                print(f"Access token: {access_token}")
                print(f"API key: {api_key}")
                return None

            auth_data = {
                'access_token': access_token,
                'api_key': api_key
            }

            return auth_data

        except Exception as e:
            print(f"Error getting auth data from Redis: {str(e)}")
            return None

    async def _log_order(self, client_id: str, order_data: Dict, response: Dict) -> None:
        """Log order to database"""
        try:
            # Handle response format
            if isinstance(response, str):
                response = json.loads(response)

            # Extract response data
            response_data = response.get('data', {}) if isinstance(response, dict) else {}
            
            # Create log entry
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
                trigger_price=float(order_data.get('triggerprice', 0)) if order_data.get('triggerprice', '0') != '0' else None,
                status=response.get('status', 'FAILED') if isinstance(response, dict) else 'UNKNOWN',
                message=response.get('message', '') if isinstance(response, dict) else str(response)
            )
            
            # Save to database
            db.session.add(log)
            db.session.commit()
            print("Order logged successfully")
            
        except Exception as e:
            print(f"Error logging order: {str(e)}")
            print(f"Order data: {order_data}")
            print(f"Response: {response}")
            # Don't raise exception as logging failure shouldn't stop order processing