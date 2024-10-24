from flask import Flask
from extensions import db
from routes import auth_bp, home_bp, funds_bp, orders_bp
from routes.dashboard import dashboard_bp
from apscheduler.schedulers.background import BackgroundScheduler
from master_contract import download_and_store_json
from datetime import datetime
import pytz
from flask_wtf.csrf import CSRFProtect

def create_app():
    app = Flask(__name__, static_folder='static')
    app.config.from_object('config.Config')

    # Initialize extensions
    db.init_app(app)
    csrf = CSRFProtect(app)

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)  # This now uses the modularized dashboard
    app.register_blueprint(home_bp)
    app.register_blueprint(funds_bp)
    app.register_blueprint(orders_bp)

    return app

def schedule_task(app):
    scheduler = BackgroundScheduler()
    ist = pytz.timezone('Asia/Kolkata')
    scheduler.add_job(func=lambda: download_and_store_json(app), trigger='cron', hour=19, minute=20, timezone=ist)
    scheduler.start()

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        db.create_all()
    schedule_task(app)
    app.run(debug=True)