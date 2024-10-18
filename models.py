from extensions import db

# User model for storing user-related details
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), nullable=False)
    client_id = db.Column(db.String(50), nullable=False)
    api_key = db.Column(db.String(100), nullable=False)
    access_token = db.Column(db.String(1000), nullable=True)
    feed_token = db.Column(db.String(1000), nullable=True)
    watchlists = db.relationship('Watchlist', backref='user', lazy=True)

    def __repr__(self):
        return f'<User {self.username}>'

# Instrument model for storing instrument data from JSON
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

# Watchlist model
class Watchlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    items = db.relationship('WatchlistItem', backref='watchlist', lazy=True)

    def __repr__(self):
        return f'<Watchlist {self.name}>'

# WatchlistItem model
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
