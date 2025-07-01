from flask import Blueprint

voice_bp = Blueprint('voice', __name__)

# Import routes after blueprint creation to avoid circular imports
from .routes import voice_trading, voice_settings, transcribe

# Register routes using decorators
voice_bp.route('/')(voice_trading)
voice_bp.route('/settings', methods=['GET', 'POST'])(voice_settings)
voice_bp.route('/transcribe', methods=['POST'])(transcribe)
