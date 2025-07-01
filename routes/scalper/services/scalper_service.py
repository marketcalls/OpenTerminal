import json
import logging
import http.client
from models import User, OrderLog, db, Instrument
from typing import Dict
from ...voice.utils.helpers import map_product_type_to_api
from datetime import datetime
import pytz

logger = logging.getLogger('scalper')

class ScalperService:
    def __init__(self):
        self.ist_tz = pytz.timezone('Asia/Kolkata')

    def get_current_ist_time(self):
        """Get current time in IST"""
        return datetime.now(self.ist_tz)

    def place_order(self, action: str, quantity: int, tradingsymbol: str, 
                   exchange: str, product_type: str, client_id: str) -> Dict:
        """Place an order using the Angel One API"""
        try:
            # Get user and auth token
            user = User.query.filter_by(client_id=client_id).first()
            if not user:
                raise ValueError("User not found")

            auth_token = user.access_token
            if not auth_token:
                raise ValueError("Authentication token not found")

            # Get symbol token from database
            instrument = Instrument.query.filter_by(
                symbol=tradingsymbol,
                exch_seg=exchange
            ).first()
            
            if not instrument:
                raise ValueError(f"Instrument not found for symbol {tradingsymbol} on {exchange}")

            # Map product type to Angel API format
            api_product_type = map_product_type_to_api(product_type)
            logger.info(f"Mapped product type {product_type} to {api_product_type}")

            # Prepare API request
            conn = http.client.HTTPSConnection("apiconnect.angelone.in")
            headers = {
                'Authorization': f'Bearer {auth_token}',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-UserType': 'USER',
                'X-SourceID': 'WEB',
                'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
                'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
                'X-MACAddress': 'MAC_ADDRESS',
                'X-PrivateKey': user.api_key
            }

            # Prepare order payload according to Angel One API docs
            payload = {
                "variety": "NORMAL",
                "tradingsymbol": tradingsymbol,
                "symboltoken": instrument.token,
                "transactiontype": action,
                "exchange": exchange,
                "ordertype": "MARKET",
                "producttype": api_product_type,
                "duration": "DAY",
                "quantity": str(quantity),
                "price": "0",
                "triggerprice": "0"
            }

            # Log request
            logger.info(f"Placing scalping order - Request: {json.dumps(payload)}")

            try:
                # Make API request
                conn.request("POST", "/rest/secure/angelbroking/order/v1/placeOrder", 
                           json.dumps(payload), headers)
                
                response = conn.getresponse()
                response_data = json.loads(response.read().decode())
                
                # Log response
                logger.info(f"Angel One API Response: {json.dumps(response_data)}")

            except Exception as api_error:
                logger.error(f"API request error: {str(api_error)}")
                raise ValueError(f"API request failed: {str(api_error)}")

            finally:
                conn.close()

            # Create order log with IST timestamp
            order_log = OrderLog(
                user_id=user.id,
                order_id=response_data.get('data', {}).get('orderid', 'UNKNOWN'),
                symbol=tradingsymbol,
                exchange=exchange,
                order_type='MARKET',
                transaction_type=action,
                product_type=product_type,  # Store original product type
                quantity=quantity,
                status=response_data.get('status', 'FAILED'),
                message=response_data.get('message', ''),
                order_source='SCALPER',
                timestamp=self.get_current_ist_time()
            )
            db.session.add(order_log)
            db.session.commit()
            logger.info(f"Order log created: {order_log.order_id}")

            if response_data.get('status'):
                return {
                    "status": "success",
                    "orderid": response_data['data']['orderid'],
                    "message": response_data['message']
                }
            else:
                logger.error(f"Order failed: {response_data.get('message')}")
                return {
                    "status": "error",
                    "message": response_data.get('message', 'Order placement failed')
                }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error placing scalping order: {error_msg}")
            
            # Log failed order attempt
            try:
                if 'user' in locals() and user:
                    order_log = OrderLog(
                        user_id=user.id,
                        order_id='FAILED',
                        symbol=tradingsymbol,
                        exchange=exchange,
                        order_type='MARKET',
                        transaction_type=action,
                        product_type=product_type,
                        quantity=quantity,
                        status='FAILED',
                        message=error_msg,
                        order_source='SCALPER',
                        timestamp=self.get_current_ist_time()
                    )
                    db.session.add(order_log)
                    db.session.commit()
                    logger.info("Failed order logged")
            except Exception as log_error:
                logger.error(f"Error logging failed order: {str(log_error)}")

            return {"error": error_msg}
