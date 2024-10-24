from .routes import dashboard_bp

# This allows other parts of the app to continue importing dashboard_bp as before
__all__ = ['dashboard_bp']