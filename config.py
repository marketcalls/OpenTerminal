import os

class Config:
    # Add these configurations
    BROKER_API_URL = os.environ.get('BROKER_API_URL', 'https://apiconnect.angelone.in')
    BROKER_API_VERSION = 'v1'
    WEBSOCKET_URL = os.environ.get('WEBSOCKET_URL', 'wss://smartapisocket.angelone.in/smart-stream')
    
    # Order related configurations
    MAX_ORDER_VALUE = 10000000  # 1 Crore
    MIN_ORDER_VALUE = 0
    MAX_QUANTITY = 500000
    DEFAULT_TICK_SIZE = 0.05

    # Database configuration
    SQLALCHEMY_DATABASE_URI = 'sqlite:///open_terminal.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Secret key for CSRF protection
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')
