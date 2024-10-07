from flask import Flask, render_template

# Initialize Flask app
app = Flask(__name__)

# Route for homepage
@app.route('/')
def home():
    return render_template('index.html')

# Route for about page
@app.route('/about')
def about():
    return render_template('about.html')


# Run the app
if __name__ == "__main__":
    app.run(debug=True)
