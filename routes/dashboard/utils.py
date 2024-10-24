from extensions import redis_client
import json
from typing import Optional, Any, Dict, Union

def cache_key(prefix: str, identifier: str) -> str:
    """Generate a consistent cache key format
    
    Args:
        prefix: The prefix for the key (e.g., 'user', 'market')
        identifier: The unique identifier (e.g., '123:watchlists')
    
    Returns:
        str: Formatted cache key
    """
    return f"{prefix}:{identifier}"

def get_cached_data(key: str, default: Any = None) -> Any:
    """Safely retrieve and parse cached JSON data
    
    Args:
        key: Redis key to retrieve
        default: Default value if key doesn't exist
    
    Returns:
        Parsed JSON data or default value
    """
    try:
        data = redis_client.get(key)
        return json.loads(data) if data else default
    except (json.JSONDecodeError, TypeError):
        return default
    except Exception as e:
        print(f"Error retrieving cached data: {str(e)}")
        return default

def set_cached_data(key: str, data: Any, expire: Optional[int] = None) -> bool:
    """Safely cache JSON serializable data
    
    Args:
        key: Redis key to set
        data: Data to cache (must be JSON serializable)
        expire: Optional expiration time in seconds
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        json_data = json.dumps(data)
        if expire:
            redis_client.setex(key, expire, json_data)
        else:
            redis_client.set(key, json_data)
        return True
    except Exception as e:
        print(f"Error setting cached data: {str(e)}")
        return False

def format_number(value: Union[int, float], decimal_places: int = 2) -> str:
    """Format numbers consistently
    
    Args:
        value: Number to format
        decimal_places: Number of decimal places to show
    
    Returns:
        str: Formatted number string
    """
    try:
        return f"{float(value):,.{decimal_places}f}"
    except (ValueError, TypeError):
        return str(value)

def validate_user_watchlist(watchlist_id: int, user_id: int) -> bool:
    """Validate that a watchlist belongs to a user
    
    Args:
        watchlist_id: ID of the watchlist
        user_id: ID of the user
    
    Returns:
        bool: True if watchlist belongs to user, False otherwise
    """
    key = cache_key('user', f'{user_id}:watchlists')
    watchlists = get_cached_data(key, [])
    
    return any(w.get('id') == watchlist_id for w in watchlists)

def cleanup_user_cache(user_id: int) -> bool:
    """Clean up all cached data for a user
    
    Args:
        user_id: ID of the user
    
    Returns:
        bool: True if cleanup successful, False otherwise
    """
    try:
        pattern = f"user:{user_id}:*"
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
        return True
    except Exception as e:
        print(f"Error cleaning up user cache: {str(e)}")
        return False

def parse_exchange_code(exchange: str) -> Optional[int]:
    """Parse exchange string to numeric code
    
    Args:
        exchange: Exchange string (e.g., 'NSE', 'BSE')
    
    Returns:
        Optional[int]: Exchange code or None if invalid
    """
    exchange_map = {
        'NSE': 1,
        'NFO': 2,
        'BSE': 3,
        'BFO': 4,
        'MCX': 5,
        'NCX': 7,
        'CDS': 13
    }
    return exchange_map.get(exchange.upper())