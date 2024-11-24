from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from models import User, UserSettings
from .services.voice_service import VoiceService
from .utils.helpers import is_market_open
import logging
import json

voice_bp = Blueprint('voice', __name__)
voice_service = VoiceService()
logger = logging.getLogger('voice')

@voice_bp.route('/voice')
def voice_trading():
    """Render voice trading interface"""
    if 'client_id' not in session:
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()
    if not user or not user.settings:
        settings = voice_service.create_default_settings(user.id)
    else:
        settings = user.settings

    return render_template('voice.html',
                         settings=settings,
                         title='Voice Trading')

@voice_bp.route('/voice/transcribe', methods=['POST'])
async def transcribe():
    """Handle voice transcription and order placement"""
    if 'client_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401

    if 'file' not in request.files:
        logger.error("No file part in the request")
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        logger.error("No selected file")
        return jsonify({"error": "No selected file"}), 400

    if file.mimetype not in ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/flac']:
        logger.error(f"Unsupported audio format: {file.mimetype}")
        return jsonify({"error": "Unsupported audio format"}), 400

    try:
        # Check if market is open
        if not is_market_open():
            return jsonify({
                'status': 'error',
                'message': 'Market is closed'
            }), 400

        # Get user and settings
        user = User.query.filter_by(client_id=session['client_id']).first()
        if not user or not user.settings:
            return jsonify({'error': 'User settings not found'}), 404

        settings = user.settings

        # Process audio and place order
        file_data = file.read()
        result = await voice_service.process_voice_order(
            file_data=file_data,
            user_id=user.id,
            client_id=user.client_id,
            settings=settings
        )

        return jsonify(result)

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error processing voice order: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@voice_bp.route('/voice/settings', methods=['GET', 'POST'])
def voice_settings():
    """Handle voice trading settings"""
    if 'client_id' not in session:
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()
    if not user:
        return redirect(url_for('auth.login'))

    if request.method == 'POST':
        try:
            # Get JSON data from request
            settings_data = request.get_json()
            if not settings_data:
                return jsonify({'error': 'No settings data provided'}), 400

            # Update settings
            result = voice_service.update_settings(user.id, settings_data)
            if 'error' in result:
                return jsonify(result), 400

            # Get updated settings for response
            updated_settings = UserSettings.query.filter_by(user_id=user.id).first()
            if not updated_settings:
                return jsonify({'error': 'Failed to retrieve updated settings'}), 500

            return jsonify({
                'status': 'success',
                'message': 'Settings updated successfully',
                'settings': {
                    'groq_api_key': updated_settings.groq_api_key,
                    'voice_activate_commands': json.loads(updated_settings.voice_activate_commands),
                    'preferred_exchange': updated_settings.preferred_exchange,
                    'preferred_product_type': updated_settings.preferred_product_type,
                    'preferred_model': updated_settings.preferred_model,
                    'trading_symbols_mapping': json.loads(updated_settings.trading_symbols_mapping)
                }
            })

        except json.JSONDecodeError:
            logger.error("Invalid JSON in request")
            return jsonify({'error': 'Invalid JSON data'}), 400
        except Exception as e:
            logger.error(f"Error updating settings: {str(e)}")
            return jsonify({'error': 'Failed to update settings'}), 500

    # GET request - return current settings
    try:
        settings = user.settings
        if not settings:
            # Create default settings if none exist
            settings = voice_service.create_default_settings(user.id)

        # Parse JSON fields for template
        try:
            voice_commands = json.loads(settings.voice_activate_commands)
        except (json.JSONDecodeError, TypeError):
            voice_commands = ["MILO"]

        try:
            trading_symbols = json.loads(settings.trading_symbols_mapping)
        except (json.JSONDecodeError, TypeError):
            trading_symbols = {}

        return render_template('voice_settings.html',
                            settings=settings,
                            voice_commands=voice_commands,
                            trading_symbols=trading_symbols,
                            title='Voice Trading Settings')

    except Exception as e:
        logger.error(f"Error retrieving settings: {str(e)}")
        flash('Error loading settings', 'error')
        return redirect(url_for('voice.voice_trading'))
