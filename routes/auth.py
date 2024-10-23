from flask import Blueprint, render_template, redirect, url_for, flash, request, session
from extensions import db, redis_client
from models import User, Watchlist, WatchlistItem, Instrument
import http.client
import json
from datetime import datetime, timedelta  # Add this import

# Define the blueprint for authentication-related routes
auth_bp = Blueprint('auth', __name__)

# Store user details in Redis
def store_user_in_redis(user):
    """Updated to include token expiry and better structure"""
    from datetime import datetime, timedelta
    
    # Calculate token expiry (24 hours from now)
    token_expiry = (datetime.now() + timedelta(days=1)).timestamp()
    
    redis_client.hset(f"user:{user.client_id}", mapping={
        "username": user.username,
        "client_id": user.client_id,
        "api_key": user.api_key,
        "access_token": user.access_token,
        "feed_token": user.feed_token,
        "token_expiry": str(token_expiry)
    })
    # Set expiry for the entire hash
    redis_client.expire(f"user:{user.client_id}", 86400)  # 24 hours

# Update store_watchlist_in_redis function
def store_watchlist_in_redis(watchlist, items, client_id=None):
    """
    Store watchlist data in Redis
    Args:
        watchlist: Watchlist object
        items: List of WatchlistItem objects
        client_id: Optional client_id for registration flow
    """
    try:
        # Get client_id either from parameter or session
        current_client_id = client_id or session.get('client_id')
        if not current_client_id:
            return False

        watchlist_data = {
            'id': watchlist.id,
            'name': watchlist.name,
            'symbols': [{
                'symbol': item.symbol,
                'token': item.token,
                'expiry': item.expiry,
                'strike': item.strike,
                'lotsize': item.lotsize,
                'instrumenttype': item.instrumenttype,
                'exch_seg': item.exch_seg,
                'tick_size': item.tick_size
            } for item in items]
        }
        
        # Store watchlist data
        redis_client.set(f"watchlist:{watchlist.id}", json.dumps(watchlist_data))
        
        # Store token mapping for quick lookups
        for item in items:
            redis_client.hset(
                f"user:{current_client_id}:tokens",
                item.token,
                json.dumps({
                    'symbol': item.symbol,
                    'exch_seg': item.exch_seg
                })
            )
        return True
    except Exception as e:
        print(f"Error storing watchlist in Redis: {str(e)}")
        return False

def remove_user_from_redis(client_id):
    """Updated to clean up all user-related data"""
    keys_to_delete = [
        f"user:{client_id}",
        f"user:{client_id}:tokens",
        f"user:{client_id}:watchlists"
    ]
    for key in keys_to_delete:
        redis_client.delete(key)

# Register route with default watchlist and symbol
# Update the register route to pass client_id
@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        client_id = request.form['client_id']
        api_key = request.form['api_key']

        try:
            # Create new user instance and save to the database
            new_user = User(username=username, client_id=client_id, api_key=api_key)
            db.session.add(new_user)
            db.session.commit()

            # Create default watchlist
            default_watchlist = Watchlist(name='Watchlist 1', user_id=new_user.id)
            db.session.add(default_watchlist)
            db.session.commit()

            # Check if RELIANCE-EQ exists in the Instrument table
            instrument = Instrument.query.filter_by(symbol='RELIANCE-EQ', exch_seg='NSE').first()
            if not instrument:
                instrument = Instrument(
                    symbol='RELIANCE-EQ',
                    name='Reliance Industries',
                    token='2885',
                    exch_seg='NSE',
                    lotsize=1,
                    tick_size=0.05
                )
                db.session.add(instrument)
                db.session.commit()

            # Add RELIANCE-EQ as a default item
            default_item = WatchlistItem(
                watchlist_id=default_watchlist.id,
                symbol=instrument.symbol,
                name=instrument.name,
                token=instrument.token,
                exch_seg=instrument.exch_seg,
                lotsize=instrument.lotsize,
                tick_size=instrument.tick_size
            )
            db.session.add(default_item)
            db.session.commit()

            # Fetch items and store in Redis
            items = WatchlistItem.query.filter_by(watchlist_id=default_watchlist.id).all()
            store_watchlist_in_redis(default_watchlist, items, client_id)

            flash('Registration successful! Please login.', 'success')
            return redirect(url_for('auth.login'))

        except Exception as e:
            db.session.rollback()
            print(f"Registration error: {str(e)}")
            flash('Error during registration. Please try again.', 'danger')
            return render_template('register.html')

    return render_template('register.html')

# Login route
# Login route with WebSocket token handling and improved error management
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        client_id = request.form['client_id']
        pin = request.form['pin']
        totp = request.form['totp']

        # Find the user in the database
        user = User.query.filter_by(client_id=client_id).first()

        if not user:
            flash('User not found. Please register first.', 'danger')
            return render_template('login.html')

        try:
            # AngelOne API Authentication
            conn = http.client.HTTPSConnection("apiconnect.angelone.in")
            
            # Prepare login payload
            payload = json.dumps({
                "clientcode": client_id,
                "password": pin,
                "totp": totp
            })

            # Get client IP
            client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            if ',' in client_ip:
                client_ip = client_ip.split(',')[0].strip()

            # Prepare headers
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-UserType': 'USER',
                'X-SourceID': 'WEB',
                'X-ClientLocalIP': request.remote_addr,
                'X-ClientPublicIP': client_ip,
                'X-MACAddress': request.headers.get('X-MAC-Address', ''),
                'X-PrivateKey': user.api_key
            }

            try:
                # Make the API request
                conn.request(
                    "POST", 
                    "/rest/auth/angelbroking/user/v1/loginByPassword",
                    payload,
                    headers
                )
                res = conn.getresponse()
                data = res.read()
                response_json = json.loads(data.decode("utf-8"))

                # Log API response for debugging
                print(f"Login API Response for {client_id}: {response_json}")

                # Validate API response
                if not response_json.get('status'):
                    error_msg = response_json.get('message', 'Authentication failed')
                    flash(f'API Error: {error_msg}', 'danger')
                    return render_template('login.html')

                # Extract tokens
                if 'data' not in response_json:
                    flash('Invalid API response structure', 'danger')
                    return render_template('login.html')

                token_data = response_json['data']
                access_token = token_data.get('jwtToken')
                feed_token = token_data.get('feedToken')
                refresh_token = token_data.get('refreshToken')

                # Validate required tokens
                if not access_token or not feed_token:
                    flash('Required authentication tokens not received', 'danger')
                    return render_template('login.html')

                try:
                    # Update user model
                    user.access_token = access_token
                    user.feed_token = feed_token
                    user.last_login = datetime.now()
                    db.session.commit()

                    # Store in Redis with structured data
                    store_user_in_redis(user)

                    # Update watchlist data in Redis
                    watchlists = Watchlist.query.filter_by(user_id=user.id).all()
                    watchlists_data = []

                    for watchlist in watchlists:
                        items = WatchlistItem.query.filter_by(watchlist_id=watchlist.id).all()
                        
                        # Store individual watchlist data
                        store_watchlist_in_redis(watchlist, items)

                        # Prepare combined watchlist data
                        watchlist_dict = {
                            'id': watchlist.id,
                            'name': watchlist.name,
                            'items_list': [{
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
                        }
                        watchlists_data.append(watchlist_dict)

                    # Store combined watchlist data
                    redis_client.set(
                        f'user:{user.id}:watchlists',
                        json.dumps(watchlists_data),
                        ex=86400  # 24 hours expiry
                    )

                    # Set session data
                    session['client_id'] = client_id
                    session['login_time'] = datetime.now().timestamp()
                    session['permissions'] = token_data.get('permissions', [])

                    # Store default settings if not exists
                    settings_key = f'user:{user.id}:watchlist_settings'
                    if not redis_client.exists(settings_key):
                        redis_client.hmset(settings_key, {
                            'show_ltp_change': 'true',
                            'show_ltp_change_percent': 'true',
                            'show_holdings': 'true'
                        })

                    flash('Login successful!', 'success')
                    return redirect(url_for('dashboard.dashboard'))

                except Exception as db_error:
                    db.session.rollback()
                    print(f"Database/Redis Error: {str(db_error)}")
                    flash('Error storing user data. Please try again.', 'danger')
                    return render_template('login.html')

            except json.JSONDecodeError as json_error:
                print(f"JSON Parse Error: {str(json_error)}")
                flash('Error processing API response', 'danger')
                return render_template('login.html')

            except http.client.HTTPException as http_error:
                print(f"HTTP Error: {str(http_error)}")
                flash('Error connecting to authentication service', 'danger')
                return render_template('login.html')

        except Exception as e:
            print(f"Unexpected Error: {str(e)}")
            flash('An unexpected error occurred', 'danger')
            return render_template('login.html')

    # GET request - render login form
    return render_template('login.html')

# Logout route
@auth_bp.route('/logout')
def logout():
    client_id = session.get('client_id')

    if client_id:
        # Find the user in the database
        user = User.query.filter_by(client_id=client_id).first()

        if user:
            # Remove the access token from the user record
            user.access_token = None
            db.session.commit()

            # Remove user details from Redis
            remove_user_from_redis(client_id)

        # Clear the session
        session.pop('client_id', None)
        flash('You have been logged out and access token removed.', 'success')
 
    return redirect(url_for('auth.login'))


