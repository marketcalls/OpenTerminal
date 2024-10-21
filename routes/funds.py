from flask import Blueprint, render_template, session, flash, redirect, url_for
from extensions import db, redis_client
from models import User
import http.client
import json

# Define the blueprint for funds-related routes
funds_bp = Blueprint('funds', __name__)

# Helper function to retrieve the auth token
def get_auth_token(user):
    auth_token = redis_client.hget(f"user:{user.client_id}", "access_token")
    print("Getting Access Token from Redis")
    if not auth_token:
        # Fetch from the database if not in Redis
        auth_token = user.access_token
        print("Getting Access Token from Sqlite DB")
    return auth_token

# Route to display fund details
@funds_bp.route('/funds')
def funds():
    client_id = session.get('client_id')
    if not client_id:
        flash('Please login to access fund details.', 'danger')
        return redirect(url_for('auth.login'))

    # Find the user in the database
    user = User.query.filter_by(client_id=client_id).first()
    if not user:
        flash('User not found.', 'danger')
        return redirect(url_for('auth.login'))

    auth_token = get_auth_token(user)
    if not auth_token:
        flash('Authentication token not found.', 'danger')
        return redirect(url_for('auth.login'))

    try:
        # Make the API request to fetch fund details
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
        conn.request("GET", "/rest/secure/angelbroking/user/v1/getRMS", '', headers)
        res = conn.getresponse()
        data = res.read()
        response_json = json.loads(data.decode("utf-8"))

        if response_json.get('status') and response_json['status'] == True:
            fund_data = response_json['data']
            return render_template('funds.html', fund_data=fund_data)
        else:
            flash('Failed to retrieve fund details.', 'danger')

    except Exception as e:
        flash(f'An error occurred: {str(e)}', 'danger')

    return redirect(url_for('dashboard.dashboard'))
