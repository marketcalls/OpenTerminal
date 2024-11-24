import json
import logging
import http.client
from models import User, OrderLog, db, Instrument
from typing import Dict
from ...voice.utils.helpers import map_product_type_to_api

logger = logging.getLogger('scalper')

class ScalperService:
    def place_order(self, action: str, quantity: int, tradingsymbol: str, 
                   exchange: str, product_type: str, client_id: str) -> Dict:
        """Place an order using the Angel One API"""
        conn = None
        try:
            # Get user and auth token
            user = User.query.filter_by(client_id=client_id).first()
            if not user:
                logger.error("User not found")
                raise ValueError("User not found")

            auth_token = user.access_token
            if not auth_token:
                logger.error("Authentication token not found")
                raise ValueError("Authentication token not found")

            # Get symbol token from database
            instrument = Instrument.query.filter_by(
                symbol=tradingsymbol,
                exch_seg=exchange
            ).first()
            
            if not instrument:
                logger.error(f"Instrument not found: {tradingsymbol} on {exchange}")
                raise ValueError(f"Instrument not found for symbol {tradingsymbol} on {exchange}")

            # Map product type to Angel API format
            api_product_type = map_product_type_to_api(product_type)
            logger.info(f"Mapped product type {product_type} to {api_product_type}")

            # Prepare order payload
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

            # Log request details
            logger.info(f"Preparing order request - Payload: {json.dumps(payload)}")

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

            # Make API request
            logger.info("Sending request to Angel One API")
            conn.request("POST", "/rest/secure/angelbroking/order/v1/placeOrder", 
                       json.dumps(payload), headers)
            
            response = conn.getresponse()
            response_data = response.read().decode()
            
            # Log raw response
            logger.info(f"Raw API Response: {response_data}")
            
            # Parse response
            response_json = json.loads(response_data)
            logger.info(f"Parsed API Response: {json.dumps(response_json)}")

            # Create order log
            order_log = OrderLog(
                user_id=user.id,
                order_id=response_json.get('data', {}).get('orderid', 'UNKNOWN'),
                symbol=tradingsymbol,
                exchange=exchange,
                order_type='MARKET',
                transaction_type=action,
                product_type=product_type,  # Store original product type
                quantity=quantity,
                status=response_json.get('status', 'FAILED'),
                message=response_json.get('message', ''),
                order_source='SCALPER'
            )
            db.session.add(order_log)
            db.session.commit()
            logger.info(f"Order log created: {order_log.order_id}")

            if response_json.get('status'):
                return {
                    "status": "success",
                    "orderid": response_json['data']['orderid'],
                    "message": response_json['message']
                }
            else:
                logger.error(f"Order failed: {response_json.get('message')}")
                return {
                    "status": "error",
                    "message": response_json.get('message', 'Order placement failed')
                }

        except json.JSONDecodeError as e:
            error_msg = f"Failed to parse API response: {str(e)}"
            logger.error(error_msg)
            return {"error": error_msg}

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
                        order_source='SCALPER'
                    )
                    db.session.add(order_log)
                    db.session.commit()
                    logger.info("Failed order logged")
            except Exception as log_error:
                logger.error(f"Error logging failed order: {str(log_error)}")

            return {"error": error_msg}

        finally:
            if conn:
                try:
                    conn.close()
                    logger.debug("API connection closed")
                except Exception as e:
                    logger.error(f"Error closing connection: {str(e)}")
