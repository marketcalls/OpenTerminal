# routes/orders/utils/formatters.py
from typing import Dict, Any
from datetime import datetime

def format_order_response(response: Dict) -> Dict:
    """Format broker response for client"""
    try:
        return {
            'status': response.get('status'),
            'order_id': response.get('data', {}).get('orderid'),
            'message': response.get('message'),
            'timestamp': datetime.now().isoformat()
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }

def format_price(price: Any) -> str:
    """Format price for display"""
    try:
        return f"{float(price):.2f}"
    except (ValueError, TypeError):
        return "0.00"

def format_quantity(quantity: Any) -> str:
    """Format quantity for display"""
    try:
        return str(int(quantity))
    except (ValueError, TypeError):
        return "0"