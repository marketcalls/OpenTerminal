from extensions import redis_client
from .utils import cache_key, get_cached_data, set_cached_data

class SettingsService:
    def get_user_settings(self, user_id):
        """Get user's watchlist display settings"""
        settings_key = cache_key('user', f'{user_id}:watchlist_settings')
        settings = redis_client.hgetall(settings_key)
        
        if not settings:
            settings = self._set_default_settings(user_id)
        
        return settings

    def update_settings(self, user_id, settings_data):
        """Update user's watchlist settings"""
        try:
            settings_key = cache_key('user', f'{user_id}:watchlist_settings')
            settings = {
                'show_ltp_change': str(settings_data.get('show_ltp_change', True)).lower(),
                'show_ltp_change_percent': str(settings_data.get('show_ltp_change_percent', True)).lower(),
                'show_holdings': str(settings_data.get('show_holdings', True)).lower()
            }
            
            redis_client.hmset(settings_key, settings)
            return {'status': 'success'}
            
        except Exception as e:
            return {'error': str(e), 'code': 500}

    def _set_default_settings(self, user_id):
        """Set and return default settings"""
        default_settings = {
            'show_ltp_change': 'true',
            'show_ltp_change_percent': 'true',
            'show_holdings': 'true'
        }
        
        settings_key = cache_key('user', f'{user_id}:watchlist_settings')
        redis_client.hmset(settings_key, default_settings)
        return default_settings

    def cleanup_settings(self, user_id):
        """Remove user settings from cache"""
        try:
            settings_key = cache_key('user', f'{user_id}:watchlist_settings')
            redis_client.delete(settings_key)
            return True
        except Exception:
            return False