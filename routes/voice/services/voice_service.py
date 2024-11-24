import json
import logging
import requests
from typing import Dict, Optional, Tuple
from models import UserSettings, OrderLog, db
from word2number import w2n
import re
from ..utils.helpers import format_log_message
from ratelimit import limits, sleep_and_retry

logger = logging.getLogger('voice')

# Default trading symbol mappings
DEFAULT_TRADING_SYMBOLS = {
    "BHEL-EQ": ["BHEL", "B H E L"],
    "INFY-EQ": ["INFI", "INFY", "INFE", "I N F Y"],
    "RELIANCE-EQ": ["RELIANCE", "RELIANC", "RILLIANS"],
    "TCS-EQ": ["TCS", "T C S"]
}

class VoiceService:
    def __init__(self):
        self.command_synonyms = {
            "BHai": "BUY",  "BI": "BUY",
            "BY": "BUY",    "BYE": "BUY",
            "BUY": "BUY",   "CELL": "SELL",
            "CEL": "SELL",  "SELF": "SELL",
            "SALE": "SELL", "SEL": "SELL",
            "SELL": "SELL"
        }

    @sleep_and_retry
    @limits(calls=15, period=60)  # 15 calls per minute
    def call_groq_api(self, file_data: bytes, model: str, api_key: str) -> Dict:
        """Call Groq API for transcription"""
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {
            "Authorization": f"Bearer {api_key}"
        }
        
        try:
            files = {
                "file": ("audio.webm", file_data, "audio/webm")
            }
            data = {
                "model": model,
                "language": "en",
                "response_format": "verbose_json"
            }
            
            response = requests.post(url, headers=headers, files=files, data=data)
            response.raise_for_status()
            logger.debug("Successfully received response from Groq API")
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            logger.error(f"Groq API HTTP error: {str(e)} - Response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error when calling Groq API: {str(e)}")
            raise

    def remove_punctuation(self, text: str) -> str:
        """Remove punctuation from text"""
        return re.sub(r'[^\w\s]', '', text)

    def parse_command(self, transcript: str) -> Tuple[Optional[str], Optional[int], Optional[str]]:
        """Parse voice command to extract order details"""
        transcript_upper = transcript.upper()
        
        # Normalize action words using synonyms
        normalized_transcript = self._normalize_action_words(transcript_upper)
        logger.debug(f"Normalized Transcript: {normalized_transcript}")
        
        try:
            for activate_command in ["MILO"]:  # Default activation command
                activate_command_upper = activate_command.upper()
                pattern = r'\b' + re.escape(activate_command_upper) + r'\b'
                match = re.search(pattern, normalized_transcript)
                
                if match:
                    command_after = normalized_transcript[match.end():].strip()
                    logger.debug(f"Command After Activation: {command_after}")
                    
                    command_pattern = r'^(BUY|SELL)\s+(\d+|\w+)\s+(?:SHARES\s+OF\s+)?(.+)$'
                    command_match = re.match(command_pattern, command_after)
                    
                    if command_match:
                        action = command_match.group(1)
                        quantity_word = command_match.group(2)
                        spoken_symbol = command_match.group(3).strip()
                        
                        # Map symbol variations to standard symbol
                        symbol = self._map_trading_symbol(spoken_symbol)
                        if not symbol:
                            logger.error(f"Trading symbol '{spoken_symbol}' not recognized")
                            return None, None, None
                        
                        try:
                            quantity = int(quantity_word)
                        except ValueError:
                            try:
                                quantity = w2n.word_to_num(quantity_word)
                            except ValueError:
                                logger.error(f"Invalid quantity: {quantity_word}")
                                return None, None, None
                        
                        logger.info(f'Parsed command - Action: {action}, Quantity: {quantity}, Symbol: {symbol}')
                        return action, quantity, symbol
                    
                    logger.error("Command pattern not matched")
                    
        except Exception as e:
            logger.error(f"Error parsing command: {str(e)}")
            
        return None, None, None

    def _normalize_action_words(self, text: str) -> str:
        """Replace synonyms in text with standardized forms"""
        words = text.split()
        normalized_words = []
        for word in words:
            normalized_word = self.command_synonyms.get(word.upper(), word.upper())
            normalized_words.append(normalized_word)
        return ' '.join(normalized_words)

    def _map_trading_symbol(self, spoken_symbol: str) -> Optional[str]:
        """Map spoken symbol to standard trading symbol"""
        spoken_symbol = spoken_symbol.upper().strip()
        
        # Direct match with standard symbol
        if spoken_symbol in DEFAULT_TRADING_SYMBOLS:
            return spoken_symbol
            
        # Check variations
        for standard_symbol, variations in DEFAULT_TRADING_SYMBOLS.items():
            variations = [v.upper().strip() for v in variations]
            if spoken_symbol in variations:
                return standard_symbol
                
        # Try partial matching for longer names
        for standard_symbol, variations in DEFAULT_TRADING_SYMBOLS.items():
            variations = [v.upper().strip() for v in variations]
            # Check if spoken symbol is contained in any variation
            for variation in variations:
                if spoken_symbol in variation or variation in spoken_symbol:
                    return standard_symbol
                
        return None

    def place_order(self, action: str, quantity: int, tradingsymbol: str, 
                   exchange: str, product_type: str, client_id: str) -> Dict:
        """Place an order using the broker API"""
        try:
            # Here you would integrate with your broker's API
            # For now, we'll return a mock response
            order_id = f"VO_{client_id}_{tradingsymbol}_{action}_{quantity}"
            return {
                "status": "success",
                "orderid": order_id,
                "message": f"{action} order placed for {quantity} {tradingsymbol}"
            }
        except Exception as e:
            logger.error(f"Error placing order: {str(e)}")
            return {"error": str(e)}

    def update_settings(self, user_id: int, settings_data: Dict) -> Dict:
        """Update user's voice trading settings"""
        try:
            settings = UserSettings.query.filter_by(user_id=user_id).first()
            if not settings:
                settings = UserSettings(user_id=user_id)
                db.session.add(settings)

            # Validate and update fields
            if 'voice_activate_commands' in settings_data:
                commands = settings_data['voice_activate_commands']
                if not isinstance(commands, list):
                    return {'error': 'voice_activate_commands must be a list'}
                settings.voice_activate_commands = json.dumps(commands)

            if 'groq_api_key' in settings_data:
                settings.groq_api_key = settings_data['groq_api_key']

            if 'preferred_exchange' in settings_data:
                settings.preferred_exchange = settings_data['preferred_exchange']

            if 'preferred_product_type' in settings_data:
                settings.preferred_product_type = settings_data['preferred_product_type']

            if 'preferred_model' in settings_data:
                settings.preferred_model = settings_data['preferred_model']

            if 'trading_symbols_mapping' in settings_data:
                mapping = settings_data['trading_symbols_mapping']
                if not isinstance(mapping, dict):
                    return {'error': 'trading_symbols_mapping must be a dictionary'}
                # Validate the structure
                for symbol, variations in mapping.items():
                    if not isinstance(variations, list):
                        return {'error': f'Variations for symbol {symbol} must be a list'}
                settings.trading_symbols_mapping = json.dumps(mapping)

            db.session.commit()
            logger.info(f"Settings updated successfully for user {user_id}")
            return {'status': 'success'}

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error updating settings: {str(e)}")
            return {'error': str(e)}

    def create_default_settings(self, user_id: int) -> UserSettings:
        """Create default settings for a user"""
        try:
            settings = UserSettings(
                user_id=user_id,
                voice_activate_commands='["MILO"]',
                preferred_exchange='NSE',
                preferred_product_type='MIS',
                preferred_model='whisper-large-v3',
                trading_symbols_mapping=json.dumps(DEFAULT_TRADING_SYMBOLS)
            )
            db.session.add(settings)
            db.session.commit()
            logger.info(f"Default settings created for user {user_id}")
            return settings

        except Exception as e:
            db.session.rollback()
            logger.error(f"Error creating default settings: {str(e)}")
            raise
