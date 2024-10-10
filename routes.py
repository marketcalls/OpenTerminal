from flask import Flask, render_template, redirect, url_for, flash, request, session
from extensions import db
from models import User
import requests
import json
import http.client

app = Flask(__name__)
app.config.from_object('config.Config')

# Initialize DB
db.init_app(app)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        client_id = request.form['client_id']
        api_key = request.form['api_key']

        new_user = User(username=username, client_id=client_id, api_key=api_key)
        db.session.add(new_user)
        db.session.commit()

        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        client_id = request.form['client_id']
        pin = request.form['pin']
        totp = request.form['totp']

        # Find the user in the database
        user = User.query.filter_by(client_id=client_id).first()

        if user:
            try:
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
                        db.session.commit()

                        session['client_id'] = client_id  # Set session for login

                        flash('Login successful!', 'success')
                        return redirect(url_for('dashboard'))
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



@app.route('/dashboard')
def dashboard():
    if 'client_id' not in session:
        flash('Please log in to access this page.', 'danger')
        return redirect(url_for('login'))

    return render_template('dashboard.html')


@app.route('/logout')
def logout():
    client_id = session.get('client_id')

    if client_id:
        # Find the user in the database
        user = User.query.filter_by(client_id=client_id).first()

        if user:
            # Remove the access token from the user record
            user.access_token = None  # or you can use an empty string ''
            db.session.commit()

        # Clear the session
        session.pop('client_id', None)
        flash('You have been logged out and access token removed.', 'success')

    return redirect(url_for('login'))

