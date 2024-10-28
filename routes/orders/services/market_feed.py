# routes/orders/services/market_feed.py
from typing import Dict, Optional
import http.client
import json
from extensions import redis_client

class MarketFeedService:
    def __init__(self):
        self.base_url = "apiconnect.angelone.in"

    async def get_ltp(self, token: str, exchange: str) -> Optional[float]:
        """Get Last Traded Price for a symbol"""
        try:
            # Try getting from Redis first
            redis_key = f"ltp:{exchange}:{token}"
            ltp = redis_client.get(redis_key)
            if ltp:
                return float(ltp)

            # If not in Redis, fetch from API
            data = await self._fetch_market_data(token, exchange)
            if data and 'ltp' in data:
                # Cache in Redis
                redis_client.setex(redis_key, 1, str(data['ltp']))
                return float(data['ltp'])

            return None

        except Exception as e:
            print(f"Error fetching LTP: {str(e)}")
            return None

    async def _fetch_market_data(self, token: str, exchange: str) -> Dict:
        """Fetch market data from Angel One API"""
        try:
            conn = http.client.HTTPSConnection(self.base_url)
            
            payload = json.dumps({
                "mode": "OHLC",
                "exchangeTokens": {
                    exchange: [token]
                }
            })

            # Get auth token from Redis/DB
            # This is simplified - you'll need proper token management
            headers = self._get_headers()
            
            conn.request("POST", "/rest/secure/angelbroking/market/v1/quote/", 
                        payload, headers)
            
            response = conn.getresponse()
            return json.loads(response.read().decode("utf-8"))

        except Exception as e:
            print(f"Error fetching market data: {str(e)}")
            return {}

    def _get_headers(self) -> Dict:
        """Get headers for market data API"""
        # Implement proper token management
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB'
        }