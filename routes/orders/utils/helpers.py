# routes/orders/utils/helpers.py
from typing import Dict, Optional
import json
from datetime import datetime
from extensions import redis_client

def calculate_order_value(quantity: int, price: float) -> float:
    """Calculate total order value"""
    return quantity * price

def is_market_open() -> bool:
    """Check if market is currently open"""
    # Implement market timing logic
    now = datetime.now()
    # Example: Market hours 9:15 AM to 3:30 PM
    market_start = now.replace(hour=0, minute=00, second=0)
    market_end = now.replace(hour=23, minute=59, second=0)
    return market_start <= now <= market_end

def get_cached_token(user_id: str) -> Optional[Dict]:
    """Get cached auth token from Redis"""
    try:
        token_data = redis_client.get(f"auth_token:{user_id}")
        return json.loads(token_data) if token_data else None
    except Exception:
        return None

def format_log_message(
    action: str,
    user_id: str,
    order_data: Dict,
    status: str,
    error: Optional[str] = None
) -> Dict:
    """Format log message for order actions"""
    return {
        'timestamp': datetime.now().isoformat(),
        'action': action,
        'user_id': user_id,
        'order_data': order_data,
        'status': status,
        'error': error
    }


def handle_broker_error(error_response):
    """Handle broker API error responses"""
    error_codes = {
        'E001': 'Invalid quantity',
        'E002': 'Invalid price',
        'E003': 'Invalid trigger price',
        'E004': 'Session expired',
        'E005': 'Market closed',
        # Add more error codes as needed
    }
    
    error_code = error_response.get('errorcode', 'UNKNOWN')
    return {
        'status': 'error',
        'code': error_code,
        'message': error_codes.get(error_code, 'Unknown error occurred')
    }