from flask import render_template, request, jsonify, session, redirect, url_for
from models import User, UserSettings
from .services.voice_service import VoiceService
from .utils.helpers import is_market_open
import logging

voice_service = VoiceService()
logger = logging.getLogger('voice')

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

def voice_settings():
    """Handle voice trading settings"""
    if 'client_id' not in session:
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()
    if not user:
        return redirect(url_for('auth.login'))

    if request.method == 'POST':
        try:
            # Update settings
            result = voice_service.update_settings(user.id, request.get_json())
            if 'error' in result:
                return jsonify(result), 400
            return jsonify({'status': 'success', 'message': 'Settings updated successfully'})
        except Exception as e:
            logger.error(f"Error updating settings: {str(e)}")
            return jsonify({'error': 'Failed to update settings'}), 500

    # GET request - return current settings
    settings = user.settings
    if not settings:
        # Create default settings if none exist
        settings = voice_service.create_default_settings(user.id)

    return render_template('voice_settings.html',
                         settings=settings,
                         title='Voice Trading Settings')
