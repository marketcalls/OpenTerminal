from flask import Flask, render_template, request, jsonify

# Initialize Flask app
app = Flask(__name__)

# Route for homepage (GET request)
@app.route('/')
def home():
    return render_template('index.html')

# Route for about page (GET request)
@app.route('/about')
def about():
    return render_template('about.html')

# Route for the order page
@app.route('/order')
def order():
    return render_template('order.html')

# Simple GET request example with query parameters
@app.route('/get_example', methods=['GET'])
def get_example():
    # Get query parameters (e.g., ?name=Rajandran&age=30)
    name = request.args.get('name', 'Guest')  # Default to 'Guest' if not provided
    age = request.args.get('age', 'unknown')  # Default to 'unknown' if not provided
    
    # Create a message based on the parameters
    message = f"Hello, {name}! You are {age} years old."
    
    # Return JSON response
    return jsonify({'message': message})

# Simple POST request example with Symbol, Quantity,  Exchange and orderType
@app.route('/post_example', methods=['POST'])
def post_example():
    # Retrieve data from POST request (form submission)
    symbol = request.form.get('symbol')
    quantity = request.form.get('quantity')
    exchange = request.form.get('exchange')
    order_type = request.form.get('order_type')  # Buy or Sell

    # Create a response message
    message = f"Order received: {quantity} units of {symbol} on {exchange} as a {order_type} order."

    # Return the response
    return jsonify({'message': message})

# Run the app
if __name__ == "__main__":
    app.run(debug=True)
