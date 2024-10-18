from flask import Blueprint, render_template, redirect, url_for, flash, request, session
from extensions import db, redis_client
from models import User, Watchlist, WatchlistItem, Instrument
import http.client
import json

# Define the blueprint for authentication-related routes
auth_bp = Blueprint('auth', __name__)

# Store user details in Redis
def store_user_in_redis(user):
    redis_client.hset(f"user:{user.client_id}", mapping={
        "username": user.username,
        "client_id": user.client_id,
        "api_key": user.api_key,
        "access_token": user.access_token,
        "feed_token": user.feed_token
    })

# Store default watchlist items in Redis
def store_watchlist_in_redis(watchlist, items):
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
    redis_client.set(f"watchlist:{watchlist.id}", json.dumps(watchlist_data))

# Remove user details from Redis
def remove_user_from_redis(client_id):
    redis_client.delete(f"user:{client_id}")

# Register route with default watchlist and symbol
@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        client_id = request.form['client_id']
        api_key = request.form['api_key']

        # Create new user instance and save to the database
        new_user = User(username=username, client_id=client_id, api_key=api_key)
        db.session.add(new_user)
        db.session.commit()

        # Create default watchlist and add RELIANCE-EQ as a default symbol
        default_watchlist = Watchlist(name='Watchlist 1', user_id=new_user.id)
        db.session.add(default_watchlist)
        db.session.commit()

        # Check if RELIANCE-EQ exists in the Instrument table
        instrument = Instrument.query.filter_by(symbol='RELIANCE-EQ', exch_seg='NSE').first()
        if not instrument:
            # Create the RELIANCE-EQ instrument if not available in the database
            instrument = Instrument(
                symbol='RELIANCE-EQ',
                name='Reliance Industries',
                token='500325',  # Example token, update as needed
                exch_seg='NSE',
                lotsize=1,
                tick_size=0.05
            )
            db.session.add(instrument)
            db.session.commit()

        # Add RELIANCE-EQ as a watchlist item for the user
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

        # Fetch the watchlist and watchlist items from the database
        items = WatchlistItem.query.filter_by(watchlist_id=default_watchlist.id).all()

        # Store the watchlist and items in Redis
        store_watchlist_in_redis(default_watchlist, items)

        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('register.html')

# Login route
@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        client_id = request.form['client_id']
        pin = request.form['pin']
        totp = request.form['totp']

        # Find the user in the database
        user = User.query.filter_by(client_id=client_id).first()

        if user:
            try:
                print("User Found")
                # AngelOne API Authentication
                conn = http.client.HTTPSConnection("apiconnect.angelone.in")
                payload = json.dumps({
                    "clientcode": client_id,
                    "password": pin,
                    "totp": totp,
                    "state": "STATE_VARIABLE"  # replace with actual state variable
                })
                headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-UserType': 'USER',
                    'X-SourceID': 'WEB',
                    'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
                    'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
                    'X-MACAddress': 'MAC_ADDRESS',
                    'X-PrivateKey': user.api_key
                }
                conn.request("POST", "/rest/auth/angelbroking/user/v1/loginByPassword", payload, headers)
                res = conn.getresponse()
                data = res.read()

                # Parse the response
                response = data.decode("utf-8")
                response_json = json.loads(response)

                # Log the full response for debugging
                print("API Response: ", response_json)

                # Check if the response contains the expected structure
                if response_json.get('status') and response_json['status'] == True and 'data' in response_json:
                    access_token = response_json['data'].get('jwtToken', '')
                    refresh_token = response_json['data'].get('refreshToken', '')
                    feed_token = response_json['data'].get('feedToken', '')

                    if access_token:
                        # Store access_token in the database
                        user.access_token = access_token
                        user.feed_token = feed_token
                        db.session.commit()

                        # Store user details in Redis
                        store_user_in_redis(user)

                        # Set session for the user
                        session['client_id'] = client_id

                        flash('Login successful!', 'success')
                        return redirect(url_for('dashboard.dashboard'))  # Redirect to the dashboard route
                    else:
                        flash('Authentication failed: Access token not found.', 'danger')
                else:
                    flash('Authentication failed: Invalid response from AngelOne API.', 'danger')
            except Exception as e:
                flash(f'An error occurred: {str(e)}', 'danger')
                print(f"Error: {str(e)}")
        else:
            flash('User not found.', 'danger')

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
