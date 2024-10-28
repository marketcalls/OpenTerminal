# routes/orders/services/broker_service.py
import http.client
import json
from typing import Dict
from ..constants import (
    PLACE_ORDER_ENDPOINT,
    MODIFY_ORDER_ENDPOINT,
    CANCEL_ORDER_ENDPOINT
)

class BrokerService:
    def __init__(self):
        self.base_url = "apiconnect.angelone.in"

    async def place_order(self, access_token: str, order_data: Dict) -> Dict:
        """Place order with Angel One broker"""
        try:
            conn = http.client.HTTPSConnection(self.base_url)
            
            # Prepare payload
            payload = self._prepare_order_payload(order_data)
            
            # Prepare headers
            headers = self._prepare_headers(access_token)
            
            # Send request
            conn.request("POST", PLACE_ORDER_ENDPOINT, payload, headers)
            
            # Get response
            response = conn.getresponse()
            return json.loads(response.read().decode("utf-8"))

        except Exception as e:
            print(f"Error in broker service: {str(e)}")
            raise

    def _prepare_order_payload(self, order_data: Dict) -> str:
        """Prepare order payload for Angel One API"""
        payload = {
            "variety": order_data.get("variety", "NORMAL"),
            "tradingsymbol": order_data["symbol"],
            "symboltoken": order_data["token"],
            "transactiontype": order_data["side"],
            "exchange": order_data["exchange"],
            "ordertype": order_data["ordertype"],
            "producttype": order_data["producttype"],
            "duration": order_data.get("duration", "DAY"),
            "price": str(order_data.get("price", "0")),
            "squareoff": "0",
            "stoploss": "0",
            "quantity": str(order_data["quantity"])
        }
        
        # Add stop loss specific fields
        if order_data.get("variety") == "STOPLOSS":
            payload["triggerprice"] = str(order_data.get("triggerprice", "0"))

        return json.dumps(payload)

    def _prepare_headers(self, access_token: str) -> Dict:
        """Prepare request headers"""
        return {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB'
        }