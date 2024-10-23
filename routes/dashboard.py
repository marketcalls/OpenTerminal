from flask import Blueprint, render_template, session, redirect, url_for, flash, request, jsonify
from models import User, Watchlist, WatchlistItem, Instrument
from extensions import db, redis_client
import json
from datetime import datetime

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard')
def dashboard():
    if 'client_id' not in session:
        flash('Please log in to access this page.', 'danger')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()

    # Get watchlists directly from the database
    watchlists = Watchlist.query.filter_by(user_id=user.id).all()
    watchlists_data = []

    for watchlist in watchlists:
        # Get items for this watchlist
        watchlist_items = WatchlistItem.query.filter_by(watchlist_id=watchlist.id).all()
        
        # Create watchlist data with items list
        watchlist_dict = {
            'id': watchlist.id,
            'name': watchlist.name,
            'items_list': [{  # Changed from 'items' to 'items_list'
                'id': item.id,
                'symbol': item.symbol,
                'name': item.name,
                'token': item.token,
                'expiry': item.expiry,
                'strike': item.strike,
                'lotsize': item.lotsize,
                'instrumenttype': item.instrumenttype,
                'exch_seg': item.exch_seg,
                'tick_size': item.tick_size
            } for item in watchlist_items]
        }
        watchlists_data.append(watchlist_dict)

    # Update Redis with fresh data
    redis_key = f'user:{user.id}:watchlists'
    redis_client.set(redis_key, json.dumps(watchlists_data))

    # Get watchlist settings
    settings_key = f'user:{user.id}:watchlist_settings'
    settings = redis_client.hgetall(settings_key) or {
        'show_ltp_change': 'true',
        'show_ltp_change_percent': 'true',
        'show_holdings': 'true'
    }

    return render_template('dashboard.html', 
                         watchlists=watchlists_data, 
                         settings=settings)

@dashboard_bp.route('/create_watchlist', methods=['POST'])
def create_watchlist():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({'status': 'error', 'message': 'Watchlist name is required'}), 400

    watchlist_count = Watchlist.query.filter_by(user_id=user.id).count()
    if watchlist_count >= 5:
        return jsonify({'status': 'error', 'message': 'Maximum 5 watchlists allowed'}), 400

    try:
        # Create new watchlist
        new_watchlist = Watchlist(name=name, user_id=user.id)
        db.session.add(new_watchlist)
        db.session.commit()

        # Prepare response data
        watchlist_data = {
            'id': new_watchlist.id,
            'name': new_watchlist.name,
            'items': []
        }

        # Update Redis
        redis_key = f'user:{user.id}:watchlists'
        existing_data = redis_client.get(redis_key)
        if existing_data:
            watchlists_data = json.loads(existing_data)
            watchlists_data.append(watchlist_data)
            redis_client.set(redis_key, json.dumps(watchlists_data))

        return jsonify({
            'status': 'success',
            'watchlist_id': new_watchlist.id,
            'data': watchlist_data
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@dashboard_bp.route('/update_watchlist', methods=['POST'])
def update_watchlist():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    watchlist_id = data.get('watchlist_id')
    new_name = data.get('name')

    if not new_name:
        return jsonify({'status': 'error', 'message': 'Watchlist name is required'}), 400

    try:
        watchlist = Watchlist.query.filter_by(id=watchlist_id, user_id=user.id).first()
        if not watchlist:
            return jsonify({'status': 'error', 'message': 'Watchlist not found'}), 404

        # Update watchlist name
        watchlist.name = new_name
        db.session.commit()

        # Update Redis
        redis_key = f'user:{user.id}:watchlists'
        existing_data = redis_client.get(redis_key)
        if existing_data:
            watchlists_data = json.loads(existing_data)
            for watchlist_data in watchlists_data:
                if watchlist_data['id'] == watchlist_id:
                    watchlist_data['name'] = new_name
                    break
            redis_client.set(redis_key, json.dumps(watchlists_data))

        return jsonify({'status': 'success'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@dashboard_bp.route('/delete_watchlist', methods=['POST'])
def delete_watchlist():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    watchlist_id = data.get('watchlist_id')

    try:
        watchlist = Watchlist.query.filter_by(id=watchlist_id, user_id=user.id).first()
        if not watchlist:
            return jsonify({'status': 'error', 'message': 'Watchlist not found'}), 404

        # Delete watchlist and all its items
        db.session.delete(watchlist)
        db.session.commit()

        # Update Redis
        redis_key = f'user:{user.id}:watchlists'
        existing_data = redis_client.get(redis_key)
        if existing_data:
            watchlists_data = json.loads(existing_data)
            watchlists_data = [w for w in watchlists_data if w['id'] != watchlist_id]
            redis_client.set(redis_key, json.dumps(watchlists_data))

        return jsonify({'status': 'success'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@dashboard_bp.route('/add_watchlist_item', methods=['POST'])
def add_watchlist_item():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    watchlist_id = data.get('watchlist_id')
    symbol = data.get('symbol')
    exch_seg = data.get('exch_seg')

    if not symbol or not exch_seg:
        return jsonify({'status': 'error', 'message': 'Symbol and Exchange Segment are required'}), 400

    try:
        # Verify watchlist belongs to user
        watchlist = Watchlist.query.filter_by(id=watchlist_id, user_id=user.id).first()
        if not watchlist:
            return jsonify({'status': 'error', 'message': 'Watchlist not found'}), 404

        # Get instrument details
        instrument = Instrument.query.filter_by(symbol=symbol, exch_seg=exch_seg).first()
        if not instrument:
            return jsonify({'status': 'error', 'message': 'Instrument not found'}), 404

        # Check if item already exists in watchlist
        existing_item = WatchlistItem.query.filter_by(
            watchlist_id=watchlist_id,
            symbol=symbol,
            exch_seg=exch_seg
        ).first()

        if existing_item:
            return jsonify({'status': 'error', 'message': 'Item already exists in watchlist'}), 400

        # Create new watchlist item
        new_item = WatchlistItem(
            watchlist_id=watchlist_id,
            symbol=instrument.symbol,
            name=instrument.name,
            token=instrument.token,
            expiry=instrument.expiry,
            strike=instrument.strike,
            lotsize=instrument.lotsize,
            instrumenttype=instrument.instrumenttype,
            exch_seg=instrument.exch_seg,
            tick_size=instrument.tick_size
        )
        db.session.add(new_item)
        db.session.commit()

        # Update Redis
        item_data = {
            'id': new_item.id,
            'symbol': new_item.symbol,
            'name': new_item.name,
            'token': new_item.token,
            'expiry': new_item.expiry,
            'strike': new_item.strike,
            'lotsize': new_item.lotsize,
            'instrumenttype': new_item.instrumenttype,
            'exch_seg': new_item.exch_seg,
            'tick_size': new_item.tick_size
        }

        redis_key = f'user:{user.id}:watchlists'
        existing_data = redis_client.get(redis_key)
        if existing_data:
            watchlists_data = json.loads(existing_data)
            for watchlist_data in watchlists_data:
                if watchlist_data['id'] == watchlist_id:
                    watchlist_data['items'].append(item_data)
                    break
            redis_client.set(redis_key, json.dumps(watchlists_data))

        return jsonify({
            'status': 'success',
            'item_id': new_item.id,
            'data': item_data
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@dashboard_bp.route('/remove_watchlist_item', methods=['POST'])
def remove_watchlist_item():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()
    item_id = data.get('item_id')

    try:
        # Get the item and verify it belongs to user's watchlist
        item = WatchlistItem.query.join(Watchlist).filter(
            WatchlistItem.id == item_id,
            Watchlist.user_id == user.id
        ).first()

        if not item:
            return jsonify({'status': 'error', 'message': 'Item not found'}), 404

        # Delete the item
        watchlist_id = item.watchlist_id
        db.session.delete(item)
        db.session.commit()

        # Update Redis
        redis_key = f'user:{user.id}:watchlists'
        existing_data = redis_client.get(redis_key)
        if existing_data:
            watchlists_data = json.loads(existing_data)
            for watchlist_data in watchlists_data:
                if watchlist_data['id'] == watchlist_id:
                    watchlist_data['items'] = [i for i in watchlist_data['items'] if i['id'] != item_id]
                    break
            redis_client.set(redis_key, json.dumps(watchlists_data))

        return jsonify({'status': 'success'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@dashboard_bp.route('/update_watchlist_settings', methods=['POST'])
def update_watchlist_settings():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401

    user = User.query.filter_by(client_id=session['client_id']).first()
    data = request.get_json()

    try:
        # Update settings in Redis
        settings_key = f'user:{user.id}:watchlist_settings'
        redis_client.hmset(settings_key, {
            'show_ltp_change': str(data.get('show_ltp_change', True)).lower(),
            'show_ltp_change_percent': str(data.get('show_ltp_change_percent', True)).lower(),
            'show_holdings': str(data.get('show_holdings', True)).lower()
        })

        return jsonify({'status': 'success'})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@dashboard_bp.route('/search_symbols', methods=['GET'])
def search_symbols():
    query = request.args.get('q', '')
    if not query or len(query) < 2:
        return jsonify({'results': []})

    try:
        # Search in both symbol and name fields
        instruments = Instrument.query.filter(
            (Instrument.symbol.ilike(f'%{query}%')) | 
            (Instrument.name.ilike(f'%{query}%'))
        ).limit(10).all()

        results = [{
            'symbol': instrument.symbol,
            'name': instrument.name,
            'exch_seg': instrument.exch_seg,
            'token': instrument.token
        } for instrument in instruments]

        return jsonify({'results': results})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# Add to dashboard.py

@dashboard_bp.route('/get_indices')
def get_indices():
    """Get dummy index data with Redis caching"""
    try:
        # Try to get from Redis first
        indices_key = "market:indices"
        cached_data = redis_client.get(indices_key)
        
        if cached_data:
            return jsonify(json.loads(cached_data))

        # Dummy data (to be replaced with real API integration later)
        data = {
            'nifty': {
                'value': '24,435.50',
                'change': '-36.60',
                'change_percent': '(-0.15%)'
            },
            'sensex': {
                'value': '51,244.50',
                'change': '-12.65',
                'change_percent': '(-0.02%)'
            },
            'last_updated': datetime.now().isoformat()
        }
        
        # Cache for 1 minute
        redis_client.setex(
            indices_key,
            60,  # 60 seconds
            json.dumps(data)
        )
        
        return jsonify(data)
        
    except Exception as e:
        print(f"Error fetching indices: {str(e)}")
        # Return dummy data even on error
        return jsonify({
            'nifty': {
                'value': '24,435.50',
                'change': '-36.60',
                'change_percent': '(-0.15%)'
            },
            'sensex': {
                'value': '51,244.50',
                'change': '-12.65',
                'change_percent': '(-0.02%)'
            },
            'last_updated': datetime.now().isoformat()
        })

# Add helper function to update indices (for future real-time updates)
def update_indices_cache(new_data):
    """Update indices data in Redis cache"""
    try:
        indices_key = "market:indices"
        current_data = redis_client.get(indices_key)
        
        if current_data:
            current_data = json.loads(current_data)
            current_data.update(new_data)
        else:
            current_data = new_data
            
        current_data['last_updated'] = datetime.now().isoformat()
        
        redis_client.setex(
            indices_key,
            60,
            json.dumps(current_data)
        )
        
        return True
    except Exception as e:
        print(f"Error updating indices cache: {str(e)}")
        return False


# Add these helper functions at the end of dashboard.py

def update_redis_watchlist(user_id):
    """
    Helper function to fetch watchlist data from database and update Redis.
    
    Args:
        user_id (int): The user ID whose watchlist needs to be updated
    """
    try:
        watchlists = Watchlist.query.filter_by(user_id=user_id).all()
        watchlists_data = []

        for watchlist in watchlists:
            items = WatchlistItem.query.filter_by(watchlist_id=watchlist.id).all()
            items_data = [{
                'id': item.id,
                'symbol': item.symbol,
                'name': item.name,
                'token': item.token,
                'expiry': item.expiry,
                'strike': item.strike,
                'lotsize': item.lotsize,
                'instrumenttype': item.instrumenttype,
                'exch_seg': item.exch_seg,
                'tick_size': item.tick_size
            } for item in items]

            watchlists_data.append({
                'id': watchlist.id,
                'name': watchlist.name,
                'items': items_data
            })

        # Update Redis with the fresh data
        redis_key = f'user:{user_id}:watchlists'
        redis_client.set(redis_key, json.dumps(watchlists_data))
        return True

    except Exception as e:
        print(f"Error updating Redis watchlist: {str(e)}")
        return False

def get_user_watchlist_settings(user_id):
    """
    Get user's watchlist display settings from Redis.
    
    Args:
        user_id (int): The user ID whose settings need to be retrieved
        
    Returns:
        dict: The user's watchlist settings
    """
    settings_key = f'user:{user_id}:watchlist_settings'
    settings = redis_client.hgetall(settings_key)
    
    if not settings:
        # Set default settings if none exist
        default_settings = {
            'show_ltp_change': 'true',
            'show_ltp_change_percent': 'true',
            'show_holdings': 'true'
        }
        redis_client.hmset(settings_key, default_settings)
        return default_settings
    
    return settings

def validate_watchlist_limit(user_id):
    """
    Check if user has reached the maximum watchlist limit.
    
    Args:
        user_id (int): The user ID to check
        
    Returns:
        bool: True if user can create more watchlists, False otherwise
    """
    watchlist_count = Watchlist.query.filter_by(user_id=user_id).count()
    return watchlist_count < 5

def cleanup_user_data(user_id):
    """
    Clean up all Redis data for a user.
    Used when logging out or deactivating account.
    
    Args:
        user_id (int): The user ID whose data needs to be cleaned
    """
    try:
        # Remove watchlist data
        redis_client.delete(f'user:{user_id}:watchlists')
        # Remove settings
        redis_client.delete(f'user:{user_id}:watchlist_settings')
        return True
    except Exception as e:
        print(f"Error cleaning up user data: {str(e)}")
        return False

def get_watchlist_summary(watchlist_id):
    """
    Get a summary of watchlist items including total items and market segments.
    
    Args:
        watchlist_id (int): The watchlist ID to summarize
        
    Returns:
        dict: Summary information about the watchlist
    """
    try:
        items = WatchlistItem.query.filter_by(watchlist_id=watchlist_id).all()
        
        # Count items by exchange segment
        segment_counts = {}
        for item in items:
            segment_counts[item.exch_seg] = segment_counts.get(item.exch_seg, 0) + 1
            
        return {
            'total_items': len(items),
            'segment_breakdown': segment_counts
        }
    except Exception as e:
        print(f"Error getting watchlist summary: {str(e)}")
        return None

def validate_watchlist_item(watchlist_id, symbol, exch_seg):
    """
    Validate if an item can be added to a watchlist.
    
    Args:
        watchlist_id (int): The watchlist ID
        symbol (str): The symbol to add
        exch_seg (str): The exchange segment
        
    Returns:
        tuple: (bool, str) - (is_valid, error_message)
    """
    try:
        # Check if item already exists
        existing_item = WatchlistItem.query.filter_by(
            watchlist_id=watchlist_id,
            symbol=symbol,
            exch_seg=exch_seg
        ).first()
        
        if existing_item:
            return False, "Item already exists in watchlist"
            
        # Verify instrument exists
        instrument = Instrument.query.filter_by(
            symbol=symbol,
            exch_seg=exch_seg
        ).first()
        
        if not instrument:
            return False, "Invalid symbol or exchange segment"
            
        return True, ""
        
    except Exception as e:
        return False, str(e)
    
    
@dashboard_bp.route('/api/get_tokens', methods=['POST'])
def get_tokens():
    """Get WebSocket tokens for market data streaming"""
    if 'client_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        client_id = session['client_id']
        
        # First try to get from Redis
        user_data = redis_client.hgetall(f"user:{client_id}")
        
        if user_data and user_data.get('feed_token'):
            return jsonify({
                'feed_token': user_data['feed_token'],
                'api_key': user_data['api_key'],
                'client_code': client_id
            })
        
        # If not in Redis, get from database
        user = User.query.filter_by(client_id=client_id).first()
        if not user or not user.feed_token:
            return jsonify({'error': 'Tokens not available'}), 404
            
        return jsonify({
            'feed_token': user.feed_token,
            'api_key': user.api_key,
            'client_code': client_id
        })
        
    except Exception as e:
        print(f"Error fetching tokens: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
    

# Update the exchange mapping in get_watchlist_tokens route

@dashboard_bp.route('/api/get_watchlist_tokens', methods=['GET'])
def get_watchlist_tokens():
    """Get all watchlist tokens for WebSocket subscription"""
    if 'client_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    try:
        user = User.query.filter_by(client_id=session['client_id']).first()
        
        # Get from Redis first
        redis_key = f'user:{user.id}:watchlists'
        cached_data = redis_client.get(redis_key)
        
        if not cached_data:
            # Update Redis cache from database
            watchlists = Watchlist.query.filter_by(user_id=user.id).all()
            watchlists_data = []
            
            for watchlist in watchlists:
                items = WatchlistItem.query.filter_by(watchlist_id=watchlist.id).all()
                watchlist_dict = {
                    'id': watchlist.id,
                    'name': watchlist.name,
                    'items_list': [{
                        'id': item.id,
                        'symbol': item.symbol,
                        'token': item.token,
                        'exch_seg': item.exch_seg
                    } for item in items]
                }
                watchlists_data.append(watchlist_dict)
            
            # Cache the data
            redis_client.set(redis_key, json.dumps(watchlists_data))
            cached_data = json.dumps(watchlists_data)

        watchlists = json.loads(cached_data)

        # Updated exchange mapping as per Smart API WebSocket 2.0
        exch_map = {
            'NSE': 1,     # nse_cm
            'NFO': 2,     # nse_fo
            'BSE': 3,     # bse_cm
            'BFO': 4,     # bse_fo
            'MCX': 5,     # mcx_fo
            'NCX': 7,     # ncx_fo
            'CDS': 13     # cde_fo
        }
        
        # Format tokens by exchange
        exchange_tokens = {}
        for watchlist in watchlists:
            for item in watchlist.get('items_list', []):
                exch_type = exch_map.get(item['exch_seg'])
                if exch_type:
                    if exch_type not in exchange_tokens:
                        exchange_tokens[exch_type] = []
                    if item['token'] not in exchange_tokens[exch_type]:
                        exchange_tokens[exch_type].append(item['token'])

        # Create subscription message format
        subscription_data = {
            "action": 1,  # 1 for subscribe
            "params": {
                "mode": 3,  # Snap Quote mode
                "tokenList": [
                    {
                        "exchangeType": exchange_type,
                        "tokens": tokens
                    }
                    for exchange_type, tokens in exchange_tokens.items()
                ]
            }
        }

        return jsonify({
            'status': 'success',
            'subscription_data': subscription_data
        })

    except Exception as e:
        print(f"Error getting watchlist tokens: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
    
