import json
import logging
import requests
from typing import Dict, Optional, Tuple
from models import UserSettings, OrderLog, db
from word2number import w2n
import re
from ..utils.helpers import format_log_message
from ...orders.services.order_service import OrderService

logger = logging.getLogger('voice')
order_service = OrderService()

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

    async def process_voice_order(self, file_data: bytes, user_id: int, client_id: str, settings: UserSettings) -> Dict:
        """Process voice command and place order"""
        try:
            # Transcribe audio using Groq API
            transcription = await self._transcribe_audio(
                file_data=file_data,
                api_key=settings.groq_api_key,
                model=settings.preferred_model
            )

            # Parse command
            action, quantity, symbol = self._parse_command(
                transcript=transcription,
                voice_commands=json.loads(settings.voice_activate_commands),
                symbol_mappings=json.loads(settings.trading_symbols_mapping)
            )

            if not all([action, quantity, symbol]):
                return {
                    'status': 'error',
                    'message': 'Invalid command format',
                    'text': transcription
                }

            # Prepare order data
            order_data = {
                'symbol': symbol,
                'quantity': quantity,
                'side': action,
                'ordertype': 'MARKET',
                'producttype': settings.preferred_product_type,
                'exchange': settings.preferred_exchange,
                'variety': 'NORMAL',
                'price': '0',
                'triggerprice': '0'
            }

            # Place order
            response = await order_service.place_order(client_id, order_data)

            # Add order source to response for logging
            if isinstance(response, dict):
                response['order_source'] = 'VOICE'

            return {
                'status': 'success',
                'text': transcription,
                'action': action,
                'quantity': quantity,
                'symbol': symbol,
                'order_response': response
            }

        except Exception as e:
            logger.error(f"Error processing voice order: {str(e)}")
            return {
                'status': 'error',
                'message': str(e),
                'text': transcription if 'transcription' in locals() else None
            }

    async def _transcribe_audio(self, file_data: bytes, api_key: str, model: str) -> str:
        """Transcribe audio using Groq API"""
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
            result = response.json()
            
            return result.get('text', '').strip()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Groq API error: {str(e)}")
            raise ValueError(f"Transcription failed: {str(e)}")

    def _parse_command(self, transcript: str, voice_commands: list, symbol_mappings: dict) -> Tuple[Optional[str], Optional[int], Optional[str]]:
        """Parse voice command to extract order details"""
        transcript_upper = transcript.upper()
        
        # Normalize action words using synonyms
        normalized_transcript = self._normalize_action_words(transcript_upper)
        logger.debug(f"Normalized Transcript: {normalized_transcript}")
        
        try:
            for activate_command in voice_commands:
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
                        symbol = self._map_trading_symbol(spoken_symbol, symbol_mappings)
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

    def _map_trading_symbol(self, spoken_symbol: str, symbol_mappings: dict) -> Optional[str]:
        """Map spoken symbol to standard trading symbol"""
        spoken_symbol = spoken_symbol.upper()
        
        # Direct match
        if spoken_symbol in symbol_mappings:
            return spoken_symbol
            
        # Check variations
        for standard_symbol, variations in symbol_mappings.items():
            if spoken_symbol in [v.upper() for v in variations]:
                return standard_symbol
                
        return None

    def update_settings(self, user_id: int, settings_data: Dict) -> Dict:
        """Update user's voice trading settings"""
        try:
            settings = UserSettings.query.filter_by(user_id=user_id).first()
            if not settings:
                settings = UserSettings(user_id=user_id)
                db.session.add(settings)

            # Update fields
            if 'voice_activate_commands' in settings_data:
                settings.voice_activate_commands = json.dumps(settings_data['voice_activate_commands'])
            if 'groq_api_key' in settings_data:
                settings.groq_api_key = settings_data['groq_api_key']
            if 'preferred_exchange' in settings_data:
                settings.preferred_exchange = settings_data['preferred_exchange']
            if 'preferred_product_type' in settings_data:
                settings.preferred_product_type = settings_data['preferred_product_type']
            if 'preferred_model' in settings_data:
                settings.preferred_model = settings_data['preferred_model']
            if 'trading_symbols_mapping' in settings_data:
                settings.trading_symbols_mapping = json.dumps(settings_data['trading_symbols_mapping'])

            db.session.commit()
            return {'status': 'success'}

        except Exception as e:
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
                trading_symbols_mapping=json.dumps({
                    "INFY": ["INFI", "INFY", "INFE"],
                    "TCS": ["TCS", "T C S"],
                    "RELIANCE": ["RELIANCE", "RELIANC", "RILLIANS"]
                })
            )
            db.session.add(settings)
            db.session.commit()
            return settings

        except Exception as e:
            logger.error(f"Error creating default settings: {str(e)}")
            raise
