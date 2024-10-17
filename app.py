from flask import Flask
from extensions import db
from routes import app
from apscheduler.schedulers.background import BackgroundScheduler
from master_contract import download_and_store_json
from datetime import datetime
import pytz

# Function to schedule the daily download
def schedule_task(app):
    scheduler = BackgroundScheduler()
    # Set time zone for IST
    ist = pytz.timezone('Asia/Kolkata')
    scheduler.add_job(func=lambda: download_and_store_json(app), trigger='cron', hour=20, minute=14, timezone=ist)
    scheduler.start()

# Ensure the tables are created before the first request
with app.app_context():
    db.create_all()



# Schedule the task with app context
schedule_task(app)

# Debug Enabled
if __name__ == "__main__":
    app.run(debug=True)
