from flask_sqlalchemy import SQLAlchemy
import redis
from flask import current_app


db = SQLAlchemy()

# Initialize Redis
redis_client = redis.Redis(
    host='localhost',  # Replace with your Redis host
    port=6379,         # Replace with your Redis port
    db=0,              # Redis DB number, default is 0
    decode_responses=True  # Ensure responses are in a readable string format
)
