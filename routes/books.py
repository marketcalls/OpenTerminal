from flask import Blueprint, render_template, session, flash, redirect, url_for
from extensions import db, redis_client
from models import User
import http.client
import json

# Define the blueprint for order-related routes
books_bp = Blueprint('books', __name__)

# Helper function to retrieve the auth token
def get_auth_token(user):
    auth_token = redis_client.hget(f"user:{user.client_id}", "access_token")
    if not auth_token:
        # Fetch from the database if not in Redis
        auth_token = user.access_token
    return auth_token

# Route to display order book
@books_bp.route('/orderbook')
def orderbook():
    client_id = session.get('client_id')
    if not client_id:
        flash('Please login to access the order book.', 'danger')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=client_id).first()
    if not user:
        flash('User not found.', 'danger')
        return redirect(url_for('auth.login'))

    auth_token = get_auth_token(user)
    if not auth_token:
        flash('Authentication token not found.', 'danger')
        return redirect(url_for('auth.login'))

    try:
        # Make the API request to fetch the order book
        conn = http.client.HTTPSConnection("apiconnect.angelone.in")
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
            'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
            'X-MACAddress': 'MAC_ADDRESS',
            'X-PrivateKey': user.api_key
        }
        conn.request("GET", "/rest/secure/angelbroking/order/v1/getOrderBook", '', headers)
        res = conn.getresponse()
        data = res.read()
        response_json = json.loads(data.decode("utf-8"))
        print(response_json)

        if response_json.get('status') and response_json['status'] == True:
            order_data = response_json.get('data', [])
            if order_data is None:
                order_data = []
            return render_template('orderbook.html', order_data=order_data)
        else:
            flash('Failed to retrieve order book.', 'danger')

    except Exception as e:
        flash(f'An error occurred: {str(e)}', 'danger')

    return redirect(url_for('dashboard.dashboard'))

# Route to display trade book
@books_bp.route('/tradebook')
def tradebook():
    client_id = session.get('client_id')
    if not client_id:
        flash('Please login to access the trade book.', 'danger')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=client_id).first()
    if not user:
        flash('User not found.', 'danger')
        return redirect(url_for('auth.login'))

    auth_token = get_auth_token(user)
    if not auth_token:
        flash('Authentication token not found.', 'danger')
        return redirect(url_for('auth.login'))

    try:
        # Make the API request to fetch the trade book
        conn = http.client.HTTPSConnection("apiconnect.angelone.in")
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
            'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
            'X-MACAddress': 'MAC_ADDRESS',
            'X-PrivateKey': user.api_key
        }
        conn.request("GET", "/rest/secure/angelbroking/order/v1/getTradeBook", '', headers)
        res = conn.getresponse()
        data = res.read()
        response_json = json.loads(data.decode("utf-8"))

        if response_json.get('status') and response_json['status'] == True:
            trade_data = response_json.get('data', [])
            if trade_data is None:
                trade_data = []
            print(trade_data)
            return render_template('tradebook.html', trade_data=trade_data)
        else:
            flash('Failed to retrieve trade book.', 'danger')

    except Exception as e:
        flash(f'An error occurred: {str(e)}', 'danger')

    return redirect(url_for('dashboard.dashboard'))

# Route to display positions
@books_bp.route('/positions')
def positions():
    client_id = session.get('client_id')
    if not client_id:
        flash('Please login to access positions.', 'danger')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=client_id).first()
    if not user:
        flash('User not found.', 'danger')
        return redirect(url_for('auth.login'))

    auth_token = get_auth_token(user)
    if not auth_token:
        flash('Authentication token not found.', 'danger')
        return redirect(url_for('auth.login'))

    try:
        # Make the API request to fetch positions
        conn = http.client.HTTPSConnection("apiconnect.angelone.in")
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
            'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
            'X-MACAddress': 'MAC_ADDRESS',
            'X-PrivateKey': user.api_key
        }
        conn.request("GET", "/rest/secure/angelbroking/order/v1/getPosition", '', headers)
        res = conn.getresponse()
        data = res.read()
        response_json = json.loads(data.decode("utf-8"))

        if response_json.get('status') and response_json['status'] == True:
            positions_data = response_json.get('data', [])
            if positions_data is None:
                positions_data = []
            print(positions_data)
            return render_template('positions.html', positions_data=positions_data)
        else:
            flash('Failed to retrieve positions.', 'danger')

    except Exception as e:
        flash(f'An error occurred: {str(e)}', 'danger')

    return redirect(url_for('dashboard.dashboard'))

# Route to display holdings
@books_bp.route('/holdings')
def holdings():
    client_id = session.get('client_id')
    if not client_id:
        flash('Please login to access holdings.', 'danger')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=client_id).first()
    if not user:
        flash('User not found.', 'danger')
        return redirect(url_for('auth.login'))

    auth_token = get_auth_token(user)
    if not auth_token:
        flash('Authentication token not found.', 'danger')
        return redirect(url_for('auth.login'))

    try:
        # Make the API request to fetch holdings
        conn = http.client.HTTPSConnection("apiconnect.angelone.in")
        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
            'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
            'X-MACAddress': 'MAC_ADDRESS',
            'X-PrivateKey': user.api_key
        }
        conn.request("GET", "/rest/secure/angelbroking/portfolio/v1/getAllHolding", '', headers)
        res = conn.getresponse()
        data = res.read()
        response_json = json.loads(data.decode("utf-8"))

        if response_json.get('status') and response_json['status'] == True:
            holdings_data = response_json['data']['holdings']
            totalholding_data = response_json['data']['totalholding']
            return render_template('holdings.html', holdings_data=holdings_data, totalholding_data=totalholding_data)
        else:
            flash('Failed to retrieve holdings.', 'danger')

    except Exception as e:
        flash(f'An error occurred: {str(e)}', 'danger')

    return redirect(url_for('dashboard.dashboard'))
