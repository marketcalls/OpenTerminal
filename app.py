from flask import Flask
from extensions import db
from routes import app

# Ensure the tables are created before the first request
with app.app_context():
    db.create_all()

if __name__ == "__main__":
    app.run(debug=True)
