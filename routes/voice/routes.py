from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for, flash, current_app
from models import User, UserSettings
from .services.voice_service import VoiceService
from .utils.helpers import is_market_open, validate_audio_format, validate_exchange, validate_product_type, validate_model
import logging
import json
import requests

voice_bp = Blueprint('voice', __name__)
voice_service = VoiceService()
logger = logging.getLogger('voice')

@voice_bp.route('/')
def voice_trading():
    """Render voice trading interface"""
    if 'client_id' not in session:
        flash('Please login to access voice trading.', 'warning')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()
    if not user or not user.settings:
        settings = voice_service.create_default_settings(user.id)
        flash('Default voice settings have been created.', 'info')
    else:
        settings = user.settings

    return render_template('voice.html',
                         settings=settings,
                         title='Voice Trading')

@voice_bp.route('/transcribe', methods=['POST'])
def transcribe():
    """Handle voice transcription and order placement"""
    try:
        # Authentication check
        if 'client_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        # Get user and settings
        user = User.query.filter_by(client_id=session['client_id']).first()
        if not user or not user.settings:
            return jsonify({'error': 'User settings not found'}), 404

        settings = user.settings

        # File validation
        if 'file' not in request.files:
            logger.error("No file part in the request")
            return jsonify({"error": "No file part"}), 400

        file = request.files['file']
        if file.filename == '':
            logger.error("No selected file")
            return jsonify({"error": "No selected file"}), 400

        if not validate_audio_format(file.mimetype):
            logger.error(f"Unsupported audio format: {file.mimetype}")
            return jsonify({"error": "Unsupported audio format"}), 400

        # Get exchange and product type from settings if not provided
        exchange = request.form.get('exchange') or settings.preferred_exchange
        product_type = request.form.get('product_type') or settings.preferred_product_type
        model = request.form.get('model') or settings.preferred_model

        # Validate parameters
        if not validate_exchange(exchange):
            return jsonify({"error": f"Invalid exchange: {exchange}"}), 400
        if not validate_product_type(product_type):
            return jsonify({"error": f"Invalid product type: {product_type}"}), 400
        if not validate_model(model):
            return jsonify({"error": f"Invalid model: {model}"}), 400

        # Check if market is open
        if not is_market_open():
            return jsonify({"error": "Market is closed"}), 400

        # Process audio
        try:
            file_data = file.read()
            logger.info(f"Processing audio file: size={len(file_data)} bytes, type={file.mimetype}")

            # Call Groq API
            result = voice_service.call_groq_api(file_data, model, settings.groq_api_key)
            if not isinstance(result, dict):
                raise ValueError("Invalid response from Groq API")

            logger.info(f"Transcription result: {result}")

            # Process the transcription
            transcription = voice_service.remove_punctuation(result.get('text', '').strip())
            logger.debug(f"Transcription after removing punctuation: {transcription}")

            # Parse command using settings
            action, quantity, tradingsymbol = voice_service.parse_command(transcription, settings)

            if all([action, quantity, tradingsymbol]):
                # Place order
                order_response = voice_service.place_order(
                    action=action,
                    quantity=quantity,
                    tradingsymbol=tradingsymbol,
                    exchange=exchange,
                    product_type=product_type,
                    client_id=user.client_id
                )
                result['order_response'] = order_response
                result['action'] = action
                result['quantity'] = quantity
                result['symbol'] = tradingsymbol
            else:
                result['order_response'] = {"error": "Invalid command"}
                result['action'] = None
                result['quantity'] = None
                result['symbol'] = None

            result['text'] = transcription
            return jsonify(result)

        except ValueError as e:
            logger.error(f"Value error: {str(e)}")
            return jsonify({"error": str(e)}), 400
        except requests.exceptions.RequestException as e:
            logger.error(f"API request error: {str(e)}")
            return jsonify({"error": f"API request failed: {str(e)}"}), 500
        except Exception as e:
            logger.error(f"Unexpected error in audio processing: {str(e)}")
            return jsonify({"error": f"Audio processing error: {str(e)}"}), 500

    except Exception as e:
        logger.error(f"Unexpected error in transcribe route: {str(e)}")
        return jsonify({"error": str(e)}), 500

@voice_bp.route('/settings', methods=['GET', 'POST'])
def voice_settings():
    """Handle voice trading settings"""
    if 'client_id' not in session:
        flash('Please login to access voice settings.', 'warning')
        return redirect(url_for('auth.login'))

    user = User.query.filter_by(client_id=session['client_id']).first()
    if not user:
        flash('User not found.', 'error')
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
            flash('Default voice settings have been created.', 'info')

        # Parse JSON fields for template
        try:
            voice_commands = json.loads(settings.voice_activate_commands)
        except (json.JSONDecodeError, TypeError):
            voice_commands = ["MILO"]
            flash('Error loading voice commands, using defaults.', 'warning')

        try:
            trading_symbols = json.loads(settings.trading_symbols_mapping)
        except (json.JSONDecodeError, TypeError):
            trading_symbols = {}
            flash('Error loading trading symbols, using empty set.', 'warning')

        return render_template('voice_settings.html',
                            settings=settings,
                            voice_commands=voice_commands,
                            trading_symbols=trading_symbols,
                            title='Voice Trading Settings')

    except Exception as e:
        logger.error(f"Error retrieving settings: {str(e)}")
        flash('Error loading settings. Please try again.', 'error')
        return redirect(url_for('voice.voice_trading'))
