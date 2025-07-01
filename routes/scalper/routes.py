from flask import Blueprint, render_template, jsonify, session, redirect, url_for, flash, request, current_app
from models import User, OrderLog
from ..dashboard.watchlist_service import WatchlistService
from .services.scalper_service import ScalperService
from ..voice.utils.helpers import validate_product_type, is_market_open
from extensions import db
import logging
import json

scalper_bp = Blueprint('scalper', __name__)
watchlist_service = WatchlistService()
scalper_service = ScalperService()
logger = logging.getLogger('scalper')

@scalper_bp.route('/')
def scalper():
    """Render scalping interface"""
    if 'client_id' not in session:
        flash('Please login to access scalping.', 'warning')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('auth.login'))

    return render_template('scalper.html', title='Scalping Terminal')

@scalper_bp.route('/search', methods=['GET'])
def search_symbols():
    """Search for trading symbols"""
    if 'client_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    query = request.args.get('q', '')
    results = watchlist_service.search_symbols(query)
    return jsonify(results)

@scalper_bp.route('/place_order', methods=['POST'])
def place_order():
    """Place a scalping order"""
    try:
        # Authentication check
        if 'client_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        user = User.query.filter_by(client_id=session['client_id']).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Check if market is open
        if not is_market_open():
            return jsonify({"error": "Market is closed"}), 400

        # Get and validate request data
        try:
            if not request.is_json:
                logger.error("Request is not JSON")
                return jsonify({'error': 'Request must be JSON'}), 400

            data = request.get_json()
            if not data:
                logger.error("No JSON data in request")
                return jsonify({'error': 'No data provided'}), 400
            
            # Log request details
            logger.info(f"Received order request: {json.dumps(data)}")
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return jsonify({'error': 'Invalid JSON data'}), 400

        # Extract order details
        action = data.get('action')
        quantity = data.get('quantity')
        symbol = data.get('symbol')
        exchange = data.get('exchange')
        product_type = data.get('product_type', 'MIS')  # Default to MIS if not provided

        # Validate inputs
        if not all([action, quantity, symbol, exchange]):
            missing = [k for k in ['action', 'quantity', 'symbol', 'exchange'] 
                      if not data.get(k)]
            return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

        if action not in ['BUY', 'SELL']:
            return jsonify({'error': 'Invalid action'}), 400

        try:
            quantity = int(quantity)
            if quantity <= 0:
                return jsonify({'error': 'Invalid quantity'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid quantity'}), 400

        # Validate product type
        if not validate_product_type(product_type):
            return jsonify({'error': f'Invalid product type: {product_type}'}), 400

        # Place the order using scalper service
        logger.info(f"Placing order: {action} {quantity} {symbol} {product_type}")
        result = scalper_service.place_order(
            action=action,
            quantity=quantity,
            tradingsymbol=symbol,
            exchange=exchange,
            product_type=product_type,
            client_id=session['client_id']
        )

        if 'error' in result:
            logger.error(f"Order placement failed: {result['error']}")
            return jsonify({'error': result['error']}), 400

        logger.info(f"Order placed successfully: {result}")
        return jsonify(result)

    except Exception as e:
        logger.error(f"Unexpected error in place_order: {str(e)}")
        return jsonify({'error': str(e)}), 500

@scalper_bp.route('/orders', methods=['GET'])
def get_orders():
    """Get recent orders for the user"""
    if 'client_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    try:
        orders = OrderLog.query.filter_by(
            user_id=user.id,
            order_source='SCALPER'
        ).order_by(OrderLog.timestamp.desc()).limit(50).all()

        return jsonify([order.to_dict() for order in orders])
    except Exception as e:
        logger.error(f"Error fetching orders: {str(e)}")
        return jsonify({'error': 'Failed to fetch orders'}), 500
