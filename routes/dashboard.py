from flask import Blueprint, render_template, session, redirect, url_for, flash, request, jsonify
from models import User, Watchlist, WatchlistItem, Instrument
from extensions import db, redis_client
import json

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/dashboard')
def dashboard():
    if 'client_id' not in session:
        flash('Please log in to access this page.', 'danger')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()

    # Fetch watchlist data from Redis
    redis_key = f'user:{user.id}:watchlists'
    watchlists_data = redis_client.get(redis_key)
    
    if watchlists_data is None:
        # If data is not in Redis, fetch from database and store in Redis
        watchlists = Watchlist.query.filter_by(user_id=user.id).all()
        watchlists_data = []
        for watchlist in watchlists:
            items = WatchlistItem.query.filter_by(watchlist_id=watchlist.id).all()
            items_data = []
            for item in items:
                items_data.append({
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
                })
            watchlists_data.append({
                'id': watchlist.id,
                'name': watchlist.name,
                'items': items_data  # Ensure this is a list
            })
        redis_client.set(redis_key, json.dumps(watchlists_data))
    else:
        watchlists_data = json.loads(watchlists_data)

    # Ensure items is a list for each watchlist (to avoid method error)
    for watchlist in watchlists_data:
        if not isinstance(watchlist['items'], list):
            watchlist['items'] = []

    # Print the structure of watchlists_data for debugging
    print("Watchlists data structure:")
    print(json.dumps(watchlists_data, indent=2))

    return render_template('dashboard.html', watchlists=watchlists_data)

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
    new_watchlist = Watchlist(name=name, user_id=user.id)
    db.session.add(new_watchlist)
    db.session.commit()
    return jsonify({'status': 'success', 'watchlist_id': new_watchlist.id})

@dashboard_bp.route('/delete_watchlist', methods=['POST'])
def delete_watchlist():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    data = request.get_json()
    watchlist_id = data.get('watchlist_id')
    watchlist = Watchlist.query.filter_by(id=watchlist_id).first()
    if not watchlist:
        return jsonify({'status': 'error', 'message': 'Watchlist not found'}), 404
    db.session.delete(watchlist)
    db.session.commit()
    return jsonify({'status': 'success'})

@dashboard_bp.route('/add_watchlist_item', methods=['POST'])
def add_watchlist_item():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    data = request.get_json()
    watchlist_id = data.get('watchlist_id')
    symbol = data.get('symbol')
    exch_seg = data.get('exch_seg')
    if not symbol or not exch_seg:
        return jsonify({'status': 'error', 'message': 'Symbol and Exchange Segment are required'}), 400
    instrument = Instrument.query.filter_by(symbol=symbol, exch_seg=exch_seg).first()
    if not instrument:
        return jsonify({'status': 'error', 'message': 'Instrument not found'}), 404
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
    return jsonify({'status': 'success', 'item_id': new_item.id})

@dashboard_bp.route('/remove_watchlist_item', methods=['POST'])
def remove_watchlist_item():
    if 'client_id' not in session:
        return jsonify({'status': 'error', 'message': 'Not logged in'}), 401
    data = request.get_json()
    item_id = data.get('item_id')
    item = WatchlistItem.query.filter_by(id=item_id).first()
    if not item:
        return jsonify({'status': 'error', 'message': 'Item not found'}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({'status': 'success'})

@dashboard_bp.route('/search_symbols', methods=['GET'])
def search_symbols():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'results': []})
    instruments = Instrument.query.filter(
        (Instrument.symbol.ilike(f'%{query}%')) | (Instrument.name.ilike(f'%{query}%'))
    ).limit(10).all()
    results = []
    for instrument in instruments:
        results.append({
            'symbol': instrument.symbol,
            'name': instrument.name,
            'exch_seg': instrument.exch_seg
        })
    return jsonify({'results': results})

@dashboard_bp.route('/get_indices')
def get_indices():
    # Fetch real-time data for NIFTY and SENSEX (Placeholder values used here)
    data = {
        'nifty': '24,854',
        'sensex': '81,224'
    }
    return jsonify(data)
