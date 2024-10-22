from flask import Flask
from extensions import db
from master_contract import download_and_store_json
from config import Config

# Create a Flask application with configuration
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)

    return app

if __name__ == '__main__':
    # Set up the app context
    app = create_app()

    # Trigger the master contract download manually
    with app.app_context():
        download_and_store_json(app)

    print("Master Contract download manually triggered.")
