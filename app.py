from flask import Flask, request  # Include request
from extensions import db
from routes import auth_bp, home_bp, funds_bp, books_bp
from routes.orders import orders_bp
from routes.dashboard import dashboard_bp
from apscheduler.schedulers.background import BackgroundScheduler
from master_contract import download_and_store_json
import pytz
from flask_wtf.csrf import CSRFProtect
from flask_session import Session
from werkzeug.middleware.proxy_fix import ProxyFix

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
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(home_bp)
    app.register_blueprint(funds_bp)
    app.register_blueprint(books_bp)
    app.register_blueprint(orders_bp, url_prefix='/api')

    # Initialize the database
    with app.app_context():
        db.create_all()

    # Do not start the scheduler here
    # schedule_task(app)

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
