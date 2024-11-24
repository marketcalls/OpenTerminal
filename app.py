from flask import Flask
from extensions import db
from routes import (
    auth_bp, home_bp, funds_bp, books_bp,
    dashboard_bp, orders_bp, voice_bp
)
from apscheduler.schedulers.background import BackgroundScheduler
from master_contract import download_and_store_json
import pytz
from flask_wtf.csrf import CSRFProtect
from flask_session import Session
from werkzeug.middleware.proxy_fix import ProxyFix
import logging

logger = logging.getLogger(__name__)

def create_app():
    app = Flask(__name__, static_folder='static')
    app.config.from_object('config.Config')

    # Apply ProxyFix middleware
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    # Initialize extensions
    Session(app)
    db.init_app(app)
    csrf = CSRFProtect(app)

    # Register blueprints
    blueprints = [
        (auth_bp, None),
        (dashboard_bp, None),
        (home_bp, None),
        (funds_bp, None),
        (books_bp, None),
        (orders_bp, '/api'),
        (voice_bp, '/voice'),  # Keep the /voice prefix
    ]

    for blueprint, url_prefix in blueprints:
        app.register_blueprint(blueprint, url_prefix=url_prefix)

    # Initialize the database
    with app.app_context():
        db.create_all()

    return app

def schedule_task(app):
    with app.app_context():
        scheduler = BackgroundScheduler()
        ist = pytz.timezone('Asia/Kolkata')
        scheduler.add_job(
            func=lambda: download_and_store_json(app),
            trigger='cron',
            hour=12,
            minute=28,
            timezone=ist
        )
        scheduler.start()
        app.logger.info("Scheduler started.")

if __name__ == "__main__":
    app = create_app()
    # Do not start the scheduler here in production deployment
    schedule_task(app)
    app.run(debug=True)
