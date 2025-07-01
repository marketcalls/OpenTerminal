# routes/orders/services/broker_service.py

import http.client
import json
from typing import Dict
from flask import request
from ..constants import (
    PLACE_ORDER_ENDPOINT,
    MODIFY_ORDER_ENDPOINT,
    CANCEL_ORDER_ENDPOINT
)

class BrokerService:
    def __init__(self):
        self.base_url = "apiconnect.angelone.in"

    async def place_order(self, order_data: Dict, access_token: str, api_key: str) -> Dict:
        """Place order with Angel One broker"""
        try:
            conn = http.client.HTTPSConnection(self.base_url)
            
            # Prepare payload
            payload = self._prepare_order_payload(order_data)
            #print('Prepared payload:', payload)
            # Prepare headers with provided tokens
            headers = self._prepare_headers(access_token, api_key)
            #print('Prepared headers:', headers)
            # Send request
            conn.request("POST", PLACE_ORDER_ENDPOINT, payload, headers)
            
            # Get response
            response = conn.getresponse()
            data = response.read()
            return json.loads(data.decode("utf-8"))

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
            "quantity": str(order_data["quantity"]),
            "disclosedquantity": str(order_data.get("disclosedquantity", "0"))
        }
        
        # Add stop loss specific fields
        if order_data.get("variety") == "STOPLOSS":
            payload["triggerprice"] = str(order_data.get("triggerprice", "0"))
        
        return json.dumps(payload)

    def _prepare_headers(self, access_token: str, api_key: str) -> Dict:
        """Prepare request headers with authentication"""

        return {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
            'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
            'X-MACAddress': 'MAC_ADDRESS',
            'X-PrivateKey': api_key
        }

    async def modify_order(self, order_data: Dict, access_token: str, api_key: str) -> Dict:
        """Modify an existing order"""
        pass

    async def cancel_order(self, order_id: str, access_token: str, api_key: str) -> Dict:
        """Cancel an existing order"""
        pass