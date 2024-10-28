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

# No changes needed to Watchlist model
class Watchlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    items = db.relationship('WatchlistItem', backref='watchlist', lazy=True)

    def __repr__(self):
        return f'<Watchlist {self.name}>'

# No changes needed to WatchlistItem model
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

# No changes needed to Instrument model
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
    

    # Add new model for Order Logs
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
            'message': self.message
        }