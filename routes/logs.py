from flask import Blueprint, render_template, jsonify, session, redirect, url_for, flash
from models import User, OrderLog
from extensions import db

logs_bp = Blueprint('logs', __name__)

@logs_bp.route('/')
def order_logs():
    """Display order logs"""
    if 'client_id' not in session:
        flash('Please login to access logs.', 'warning')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()
    if not user:
        flash('User not found.', 'error')
        return redirect(url_for('auth.login'))

    # Get all orders for the user
    orders = OrderLog.query.filter_by(
        user_id=user.id
    ).order_by(OrderLog.timestamp.desc()).all()

    # Group orders by source
    grouped_orders = {}
    for order in orders:
        source = order.order_source
        if source not in grouped_orders:
            grouped_orders[source] = []
        grouped_orders[source].append(order)

    # Calculate statistics
    stats = {
        'total': len(orders),
        'by_source': {},
        'by_type': {
            'BUY': len([o for o in orders if o.transaction_type == 'BUY']),
            'SELL': len([o for o in orders if o.transaction_type == 'SELL'])
        }
    }

    # Calculate stats by source
    for source in grouped_orders:
        source_orders = grouped_orders[source]
        stats['by_source'][source] = {
            'total': len(source_orders),
            'BUY': len([o for o in source_orders if o.transaction_type == 'BUY']),
            'SELL': len([o for o in source_orders if o.transaction_type == 'SELL'])
        }

    return render_template('logs.html', 
                         orders=grouped_orders,
                         stats=stats,
                         title='Order Logs')
