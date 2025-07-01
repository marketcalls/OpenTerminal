from datetime import datetime, time
import pytz
import json
import logging

logger = logging.getLogger('voice')

# Mapping between user-facing product types and Angel API product types
PRODUCT_TYPE_MAPPING = {
    "CNC": "DELIVERY",      # Cash & Carry maps to DELIVERY
    "NRML": "CARRYFORWARD", # Normal maps to CARRYFORWARD
    "MIS": "INTRADAY"       # Margin Intraday Squareoff maps to INTRADAY
}

def map_product_type_to_api(product_type: str) -> str:
    """Map user-facing product type to Angel API product type"""
    return PRODUCT_TYPE_MAPPING.get(product_type, product_type)

def is_market_open() -> bool:
    """Check if market is currently open"""
    return True
    # ist = pytz.timezone('Asia/Kolkata')
    # current_time = datetime.now(ist).time()
    # current_day = datetime.now(ist).weekday()
    
    # # Check if it's a weekday (0-4 represents Monday to Friday)
    # if current_day >= 5:  # Saturday or Sunday
    #     return False
    
    # # Market hours: 9:15 AM to 3:30 PM IST
    # market_start = time(9, 15)
    # market_end = time(15, 30)
    
    # # Check if current time is within market hours
    # return market_start <= current_time <= market_end

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
    valid_product_types = [
        "CNC",    # Cash & Carry for equity
        "NRML",   # Normal for futures and options
        "MIS"     # Margin Intraday Squareoff
    ]
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
        {"code": "CDS", "name": "CDS: NSE Currency"},
        {"code": "BFO", "name": "BFO: BSE F&O"},
        {"code": "BCD", "name": "BCD: BSE Currency"},
        {"code": "MCX", "name": "MCX: Multi Commodity Exchange"},
        {"code": "NCDEX", "name": "NCDEX: National Commodity Exchange"}
    ]

def get_valid_product_types() -> list:
    """Get list of valid product types"""
    return [
        {"code": "CNC", "name": "Cash & Carry for equity (DELIVERY)"},
        {"code": "NRML", "name": "Normal for futures and options (CARRYFORWARD)"},
        {"code": "MIS", "name": "Margin Intraday Squareoff (INTRADAY)"}
    ]

def get_valid_models() -> list:
    """Get list of valid models"""
    return [
        {"code": "whisper-large-v3", "name": "Whisper Large V3"},
        {"code": "whisper-large-v3-turbo", "name": "Whisper Large V3 Turbo"},
        {"code": "distil-whisper-large-v3-en", "name": "Distil Whisper Large V3 (English)"}
    ]

def get_order_variety() -> list:
    """Get list of valid order varieties"""
    return [
        {"code": "NORMAL", "name": "Regular Order"},
        {"code": "STOPLOSS", "name": "Stop Loss Order"},
        {"code": "AMO", "name": "After Market Order"}
    ]

def get_order_types() -> list:
    """Get list of valid order types"""
    return [
        {"code": "MARKET", "name": "Market Order (MKT)"},
        {"code": "LIMIT", "name": "Limit Order (L)"},
        {"code": "STOPLOSS_LIMIT", "name": "Stop Loss Limit Order (SL)"},
        {"code": "STOPLOSS_MARKET", "name": "Stop Loss Market Order (SL-M)"}
    ]

def get_order_durations() -> list:
    """Get list of valid order durations"""
    return [
        {"code": "DAY", "name": "Regular Order"},
        {"code": "IOC", "name": "Immediate or Cancel"}
    ]
