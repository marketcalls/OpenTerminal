from .auth import auth_bp
from .home import home_bp
from .funds import funds_bp
from .books import books_bp
from .dashboard import dashboard_bp
from .orders import orders_bp
from .voice import voice_bp
from .scalper import scalper_bp

__all__ = [
    'auth_bp',
    'home_bp',
    'funds_bp',
    'books_bp',
    'dashboard_bp',
    'orders_bp',
    'voice_bp',
    'scalper_bp'
]
