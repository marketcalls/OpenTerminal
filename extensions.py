# extensions.py

from flask_sqlalchemy import SQLAlchemy
from redis import Redis
from datetime import datetime, timedelta
import json

# Initialize SQLAlchemy
db = SQLAlchemy()

# Initialize Redis with connection pool
redis_client = Redis(
    host='localhost',  # or your Redis host
    port=6379,        # default Redis port
    db=0,             # database number
    decode_responses=True,  # automatically decode responses to Python strings
    socket_timeout=5  # timeout in seconds
)

class RedisTokenManager:
    """Helper class for managing tokens in Redis"""
    
    @staticmethod
    def store_tokens(client_id, access_token, feed_token, expiry=86400):
        """Store user tokens in Redis with expiration"""
        try:
            user_key = f"user:{client_id}"
            token_data = {
                "access_token": access_token,
                "feed_token": feed_token,
                "created_at": datetime.now().timestamp()
            }
            
            # Store tokens
            redis_client.hmset(user_key, token_data)
            redis_client.expire(user_key, expiry)
            
            return True
        except Exception as e:
            print(f"Error storing tokens in Redis: {str(e)}")
            return False

    @staticmethod
    def get_tokens(client_id):
        """Get user tokens from Redis"""
        try:
            user_key = f"user:{client_id}"
            token_data = redis_client.hgetall(user_key)
            
            if not token_data:
                return None
                
            return {
                "access_token": token_data.get("access_token"),
                "feed_token": token_data.get("feed_token")
            }
        except Exception as e:
            print(f"Error getting tokens from Redis: {str(e)}")
            return None

    @staticmethod
    def clear_tokens(client_id):
        """Clear user tokens from Redis"""
        try:
            user_key = f"user:{client_id}"
            redis_client.delete(user_key)
            return True
        except Exception as e:
            print(f"Error clearing tokens from Redis: {str(e)}")
            return False

class RedisWatchlistManager:
    """Helper class for managing watchlist data in Redis"""
    
    @staticmethod
    def store_watchlist(user_id, watchlist_data, expiry=86400):
        """Store watchlist data in Redis"""
        try:
            key = f"user:{user_id}:watchlists"
            redis_client.set(key, json.dumps(watchlist_data))
            redis_client.expire(key, expiry)
            return True
        except Exception as e:
            print(f"Error storing watchlist in Redis: {str(e)}")
            return False

    @staticmethod
    def get_watchlist(user_id):
        """Get watchlist data from Redis"""
        try:
            key = f"user:{user_id}:watchlists"
            data = redis_client.get(key)
            return json.loads(data) if data else None
        except Exception as e:
            print(f"Error getting watchlist from Redis: {str(e)}")
            return None

def init_extensions(app):
    """Initialize all extensions"""
    db.init_app(app)
    
    # Test Redis connection
    try:
        redis_client.ping()
        print("Redis connection successful")
    except Exception as e:
        print(f"Redis connection failed: {str(e)}")
        # You might want to handle this based on your needs
        # For example, fallback to a different cache or raise an error
        pass

def cleanup_expired_sessions():
    """Cleanup expired sessions from Redis"""
    try:
        pattern = "user:*"
        for key in redis_client.scan_iter(match=pattern):
            if redis_client.ttl(key) <= 0:
                redis_client.delete(key)
    except Exception as e:
        print(f"Error cleaning up sessions: {str(e)}")

def get_market_status():
    """Get market status from Redis"""
    try:
        status = redis_client.get('market_status')
        return json.loads(status) if status else None
    except Exception as e:
        print(f"Error getting market status: {str(e)}")
        return None

# Error handler for Redis operations
class RedisError(Exception):
    """Custom exception for Redis operations"""
    pass

# Redis health check
def check_redis_health():
    """Check Redis connection and return status"""
    try:
        redis_client.ping()
        return {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }