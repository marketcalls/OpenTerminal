from models import User, Watchlist
from extensions import redis_client
from datetime import datetime
import json
from .utils import cache_key, get_cached_data, set_cached_data

class MarketDataService:
    def __init__(self):
        self.exchange_map = {
            'NSE': 1,     # nse_cm
            'NFO': 2,     # nse_fo
            'BSE': 3,     # bse_cm
            'BFO': 4,     # bse_fo
            'MCX': 5,     # mcx_fo
            'NCX': 7,     # ncx_fo
            'CDS': 13     # cde_fo
        }
        # Add index tokens
        self.index_tokens = [
            {"token": "99926000", "symbol": "Nifty 50", "name": "NIFTY", "exch_seg": "NSE"},
            {"token": "99919000", "symbol": "SENSEX", "name": "SENSEX", "exch_seg": "BSE"}
        ]

    def get_user_tokens(self, client_id):
        """Get WebSocket tokens for market data streaming"""
        try:
            # Try Redis first
            user_data = redis_client.hgetall(f"user:{client_id}")
            
            if user_data and user_data.get('feed_token'):
                return {
                    'feed_token': user_data['feed_token'],
                    'api_key': user_data['api_key'],
                    'client_code': client_id
                }
            
            # Fallback to database
            user = User.query.filter_by(client_id=client_id).first()
            if not user or not user.feed_token:
                return {'error': 'Tokens not available', 'code': 404}
                
            return {
                'feed_token': user.feed_token,
                'api_key': user.api_key,
                'client_code': client_id
            }
            
        except Exception as e:
            return {'error': str(e), 'code': 500}

    def get_watchlist_tokens(self, client_id):
        """Get all watchlist tokens for WebSocket subscription"""
        try:
            user = User.query.filter_by(client_id=client_id).first()
            if not user:
                return {'error': 'User not found', 'code': 404}

            redis_key = cache_key('user', f'{user.id}:watchlists')
            watchlists_data = get_cached_data(redis_key)

            if not watchlists_data:
                # Update Redis cache from database
                watchlists = Watchlist.query.filter_by(user_id=user.id).all()
                watchlists_data = self._format_watchlist_data(watchlists)
                set_cached_data(redis_key, watchlists_data)

            # Add index tokens to subscription data
            subscription_data = self._prepare_subscription_data(watchlists_data, include_indices=True)
            return {'status': 'success', 'subscription_data': subscription_data}

        except Exception as e:
            return {'error': str(e), 'code': 500}

    def get_market_indices(self):
        """Get market indices with caching"""
        try:
            indices_key = cache_key('market', 'indices')
            cached_data = get_cached_data(indices_key)
            
            if cached_data:
                return cached_data

            # Return structure for real-time data
            return {
                'nifty': {
                    'token': '99926000',
                    'value': '--',
                    'change': '--',
                    'change_percent': '--'
                },
                'sensex': {
                    'token': '99919000',
                    'value': '--',
                    'change': '--',
                    'change_percent': '--'
                },
                'last_updated': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error fetching indices: {str(e)}")
            return self._get_fallback_indices()

    def update_market_indices(self, new_data):
        """Update market indices in cache"""
        try:
            indices_key = cache_key('market', 'indices')
            current_data = get_cached_data(indices_key, {})
            
            if current_data:
                current_data.update(new_data)
            else:
                current_data = new_data
                
            current_data['last_updated'] = datetime.now().isoformat()
            set_cached_data(indices_key, current_data, expire=60)
            return True
            
        except Exception as e:
            print(f"Error updating indices cache: {str(e)}")
            return False

    def _format_watchlist_data(self, watchlists):
        """Format watchlist data for caching"""
        return [{
            'id': watchlist.id,
            'name': watchlist.name,
            'items_list': [{
                'id': item.id,
                'symbol': item.symbol,
                'token': item.token,
                'exch_seg': item.exch_seg
            } for item in watchlist.items]
        } for watchlist in watchlists]

    def _prepare_subscription_data(self, watchlists, include_indices=False):
        """Prepare WebSocket subscription data"""
        exchange_tokens = {}
        
        # Add watchlist tokens
        for watchlist in watchlists:
            for item in watchlist.get('items_list', []):
                exch_type = self.exchange_map.get(item['exch_seg'])
                if exch_type:
                    if exch_type not in exchange_tokens:
                        exchange_tokens[exch_type] = []
                    if item['token'] not in exchange_tokens[exch_type]:
                        exchange_tokens[exch_type].append(item['token'])

        # Add index tokens
        if include_indices:
            for index in self.index_tokens:
                exch_type = self.exchange_map.get(index['exch_seg'])
                if exch_type:
                    if exch_type not in exchange_tokens:
                        exchange_tokens[exch_type] = []
                    if index['token'] not in exchange_tokens[exch_type]:
                        exchange_tokens[exch_type].append(index['token'])

        return {
            "action": 1,
            "params": {
                "mode": 3,
                "tokenList": [
                    {
                        "exchangeType": exchange_type,
                        "tokens": tokens
                    }
                    for exchange_type, tokens in exchange_tokens.items()
                ]
            }
        }

    def _get_fallback_indices(self):
        """Return fallback data when unable to fetch indices"""
        return {
            'nifty': {
                'token': '99926000',
                'value': '--',
                'change': '--',
                'change_percent': '--'
            },
            'sensex': {
                'token': '99919000',
                'value': '--',
                'change': '--',
                'change_percent': '--'
            },
            'last_updated': datetime.now().isoformat()
        }
