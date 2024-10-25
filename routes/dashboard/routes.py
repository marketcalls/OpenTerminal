from flask import Blueprint, render_template, session, redirect, url_for, flash, request, jsonify
from models import User, Watchlist
from .watchlist_service import WatchlistService
from .settings_service import SettingsService
from .market_data_service import MarketDataService

dashboard_bp = Blueprint('dashboard', __name__)
watchlist_service = WatchlistService()
settings_service = SettingsService()
market_data_service = MarketDataService()

@dashboard_bp.route('/dashboard')
def dashboard():
    if 'client_id' not in session:
        flash('Please log in to access this page.', 'danger')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()
    watchlists_data = watchlist_service.get_user_watchlists(user.id)
    settings = settings_service.get_user_settings(user.id)

    return render_template('dashboard.html', 
                         watchlists=watchlists_data, 
                         settings=settings)

@dashboard_bp.route('/create_watchlist', methods=['POST'])
def create_watchlist():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    
    result = watchlist_service.create_watchlist(user.id, data.get('name'))
    if 'error' in result:
        return jsonify({'status': 'error', 'message': result['error']}), result.get('code', 500)
    
    return jsonify({
        'status': 'success',
        'watchlist_id': result['watchlist_id'],
        'data': result['data']
    })

@dashboard_bp.route('/update_watchlist', methods=['POST'])
def update_watchlist():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    
    result = watchlist_service.update_watchlist(
        user.id, 
        data.get('watchlist_id'), 
        data.get('name')
    )
    
    if 'error' in result:
        return jsonify({'status': 'error', 'message': result['error']}), result.get('code', 500)
    
    return jsonify({'status': 'success'})

@dashboard_bp.route('/add_watchlist_item', methods=['POST'])
def add_watchlist_item():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    
    result = watchlist_service.add_watchlist_item(
        user.id,
        data.get('watchlist_id'),
        data.get('symbol'),
        data.get('exch_seg')
    )
    
    if 'error' in result:
        return jsonify({'status': 'error', 'message': result['error']}), result.get('code', 500)
    
    return jsonify({
        'status': 'success',
        'data': result['data']
    })

@dashboard_bp.route('/delete_watchlist', methods=['POST'])
def delete_watchlist():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    watchlist_id = data.get('watchlist_id')

    result = watchlist_service.delete_watchlist(user.id, watchlist_id)
    
    if 'error' in result:
        return jsonify({'status': 'error', 'message': result['error']}), result.get('code', 500)
    
    return jsonify({
        'status': 'success',
        'watchlist_id': result['watchlist_id']
    })

@dashboard_bp.route('/remove_watchlist_item', methods=['POST'])
def remove_watchlist_item():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    
    result = watchlist_service.remove_watchlist_item(user.id, data.get('item_id'))
    if 'error' in result:
        return jsonify({'status': 'error', 'message': result['error']}), result.get('code', 500)
    
    return jsonify({'status': 'success'})

@dashboard_bp.route('/update_watchlist_settings', methods=['POST'])
def update_watchlist_settings():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    result = settings_service.update_settings(user.id, request.get_json())
    
    if 'error' in result:
        return jsonify({'status': 'error', 'message': result['error']}), result.get('code', 500)
    
    return jsonify({'status': 'success'})

@dashboard_bp.route('/search_symbols', methods=['GET'])
def search_symbols():
    query = request.args.get('q', '')
    if not query or len(query) < 2:
        return jsonify({'results': []})
    
    results = watchlist_service.search_symbols(query)
    return jsonify({'results': results})

@dashboard_bp.route('/get_indices')
def get_indices():
    return jsonify(market_data_service.get_market_indices())

@dashboard_bp.route('/api/get_tokens', methods=['POST'])
def get_tokens():
    if 'client_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
        
    result = market_data_service.get_user_tokens(session['client_id'])
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('code', 500)
    
    return jsonify(result)

@dashboard_bp.route('/api/get_watchlist_tokens', methods=['GET'])
def get_watchlist_tokens():
    if 'client_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
        
    result = market_data_service.get_watchlist_tokens(session['client_id'])
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('code', 500)
    
    return jsonify(result)