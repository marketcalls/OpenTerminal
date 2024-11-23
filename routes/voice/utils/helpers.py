from datetime import datetime, time
import pytz
import json
import logging

logger = logging.getLogger('voice')

def is_market_open() -> bool:
    """Check if market is currently open"""
    ist = pytz.timezone('Asia/Kolkata')
    current_time = datetime.now(ist).time()
    
    # Market hours: 9:15 AM to 3:30 PM IST
    market_start = time(9, 15)
    market_end = time(15, 30)
    
    # Check if current time is within market hours
    return market_start <= current_time <= market_end

def format_log_message(action: str, user_id: str, data: dict, status: str, error_msg: str = None) -> str:
    """Format log message for voice orders"""
    log_data = {
        'timestamp': datetime.utcnow().isoformat(),
        'action': action,
        'user_id': user_id,
        'data': data,
        'status': status
    }
    
    if error_msg:
        log_data['error'] = error_msg
        
    return json.dumps(log_data)

def validate_audio_format(mimetype: str) -> bool:
    """Validate if audio format is supported"""
    supported_formats = [
        'audio/webm',
        'audio/wav',
        'audio/mp3',
        'audio/mpeg',
        'audio/ogg',
        'audio/flac'
    ]
    return mimetype in supported_formats

def validate_exchange(exchange: str) -> bool:
    """Validate if exchange is supported"""
    valid_exchanges = [
        "NSE", "NFO", "CDS", 
        "BSE", "BFO", "BCD", 
        "MCX", "NCDEX"
    ]
    return exchange in valid_exchanges

def validate_product_type(product_type: str) -> bool:
    """Validate if product type is supported"""
    valid_product_types = ["CNC", "NRML", "MIS"]
    return product_type in valid_product_types

def validate_model(model: str) -> bool:
    """Validate if model is supported"""
    valid_models = [
        "whisper-large-v3",
        "whisper-large-v3-turbo",
        "distil-whisper-large-v3-en"
    ]
    return model in valid_models

def get_valid_exchanges() -> list:
    """Get list of valid exchanges"""
    return [
        {"code": "NSE", "name": "NSE: NSE Equity"},
        {"code": "BSE", "name": "BSE: BSE Equity"},
        {"code": "NFO", "name": "NFO: NSE F&O"},
        {"code": "CDS", "name": "CDS: NSE Currency"}
    ]

def get_valid_product_types() -> list:
    """Get list of valid product types"""
    return [
        {"code": "MIS", "name": "MIS: Margin Intraday Square off"},
        {"code": "CNC", "name": "CNC: Cash & Carry for equity"},
        {"code": "NRML", "name": "NRML: Normal for F&O"}
    ]

def get_valid_models() -> list:
    """Get list of valid models"""
    return [
        {"code": "whisper-large-v3", "name": "Whisper Large V3"},
        {"code": "whisper-large-v3-turbo", "name": "Whisper Large V3 Turbo"},
        {"code": "distil-whisper-large-v3-en", "name": "Distil Whisper Large V3 (English)"}
    ]
