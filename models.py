# models.py

from extensions import db
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), nullable=False)
    client_id = db.Column(db.String(50), nullable=False, unique=True)
    api_key = db.Column(db.String(100), nullable=False)
    
    # Token fields
    access_token = db.Column(db.String(1000), nullable=True)
    feed_token = db.Column(db.String(1000), nullable=True)
    refresh_token = db.Column(db.String(1000), nullable=True)
    
    # Session tracking
    token_expiry = db.Column(db.DateTime, nullable=True)
    last_login = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)
    last_activity = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    watchlists = db.relationship('Watchlist', backref='user', lazy=True)
    settings = db.relationship('UserSettings', backref='user', uselist=False, lazy=True)

    def __repr__(self):
        return f'<User {self.username}>'

    def to_dict(self):
        """Convert user object to dictionary"""
        return {
            'id': self.id,
            'username': self.username,
            'client_id': self.client_id,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'has_active_session': bool(self.access_token and self.feed_token)
        }

class UserSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, unique=True)
    
    # Voice Trading Settings
    voice_activate_commands = db.Column(db.String(500), nullable=False, default='["MILO"]')
    groq_api_key = db.Column(db.String(100), nullable=True)
    preferred_exchange = db.Column(db.String(10), nullable=False, default='NSE')
    preferred_product_type = db.Column(db.String(10), nullable=False, default='MIS')
    preferred_model = db.Column(db.String(50), nullable=False, default='whisper-large-v3')
    
    # Trading Symbol Mappings stored as JSON string
    trading_symbols_mapping = db.Column(db.Text, nullable=False, default='{}')
    
    # Watchlist Display Settings
    show_ltp_change = db.Column(db.Boolean, default=True)
    show_ltp_change_percent = db.Column(db.Boolean, default=True)
    show_holdings = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f'<UserSettings for user_id {self.user_id}>'

class Watchlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    items = db.relationship('WatchlistItem', backref='watchlist', lazy=True)

    def __repr__(self):
        return f'<Watchlist {self.name}>'

class WatchlistItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    watchlist_id = db.Column(db.Integer, db.ForeignKey('watchlist.id'), nullable=False)
    symbol = db.Column(db.String(150), nullable=False)
    name = db.Column(db.String(150), nullable=True)
    token = db.Column(db.String(50), nullable=True)
    expiry = db.Column(db.String(50), nullable=True)
    strike = db.Column(db.Float, nullable=True)
    lotsize = db.Column(db.Integer, nullable=True)
    instrumenttype = db.Column(db.String(50), nullable=True)
    exch_seg = db.Column(db.String(10), nullable=False)
    tick_size = db.Column(db.Float, nullable=True)

    def __repr__(self):
        return f'<WatchlistItem {self.symbol}>'

class Instrument(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    token = db.Column(db.String(50), nullable=False)
    symbol = db.Column(db.String(150), nullable=False)
    name = db.Column(db.String(150), nullable=True)
    expiry = db.Column(db.String(50), nullable=True)
    strike = db.Column(db.Float, nullable=True)
    lotsize = db.Column(db.Integer, nullable=True)
    instrumenttype = db.Column(db.String(50), nullable=True)
    exch_seg = db.Column(db.String(10), nullable=False)
    tick_size = db.Column(db.Float, nullable=True)

    def __repr__(self):
        return f'<Instrument {self.symbol}>'

class OrderLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    order_id = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    symbol = db.Column(db.String(50), nullable=False)
    exchange = db.Column(db.String(10), nullable=False)
    order_type = db.Column(db.String(20), nullable=False)
    transaction_type = db.Column(db.String(10), nullable=False)
    product_type = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=True)
    trigger_price = db.Column(db.Float, nullable=True)
    status = db.Column(db.String(20), nullable=False)
    message = db.Column(db.String(255), nullable=True)
    order_source = db.Column(db.String(20), nullable=False, default='REGULAR')  # Added field for order source

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'timestamp': self.timestamp.isoformat(),
            'symbol': self.symbol,
            'exchange': self.exchange,
            'order_type': self.order_type,
            'transaction_type': self.transaction_type,
            'product_type': self.product_type,
            'quantity': self.quantity,
            'price': self.price,
            'trigger_price': self.trigger_price,
            'status': self.status,
            'message': self.message,
            'order_source': self.order_source
        }
