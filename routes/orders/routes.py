# routes/orders/routes.py
from flask import Blueprint, request, jsonify
from .services.order_service import OrderService
from .utils.helpers import is_market_open, format_log_message
import logging

orders_bp = Blueprint('orders', __name__)
order_service = OrderService()
logger = logging.getLogger('orders')

@orders_bp.route('/api/orders/place', methods=['POST'])
async def place_order():
    """Place a new order"""
    try:
        # Check if market is open
        if not is_market_open():
            return jsonify({
                'status': 'error',
                'message': 'Market is closed'
            }), 400

        # Get user ID from session
        user_id = request.user_id  # Implement your auth logic
        
        # Get order data
        order_data = request.get_json()

        # Log order request
        logger.info(format_log_message(
            'PLACE_ORDER_REQUEST',
            user_id,
            order_data,
            'PENDING'
        ))

        # Place order
        response = await order_service.place_order(user_id, order_data)

        # Log success
        logger.info(format_log_message(
            'PLACE_ORDER_SUCCESS',
            user_id,
            order_data,
            'SUCCESS'
        ))

        return jsonify(response)

    except ValueError as e:
        # Log validation error
        logger.warning(format_log_message(
            'PLACE_ORDER_VALIDATION_ERROR',
            user_id,
            order_data,
            'ERROR',
            str(e)
        ))
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

    except Exception as e:
        # Log unexpected error
        logger.error(format_log_message(
            'PLACE_ORDER_ERROR',
            user_id,
            order_data,
            'ERROR',
            str(e)
        ))
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500

# Add more routes as needed (modify, cancel, etc.)