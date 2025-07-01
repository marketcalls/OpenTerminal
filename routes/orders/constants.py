# routes/orders/constants.py

# Order Types
REGULAR = "NORMAL"
STOPLOSS = "STOPLOSS"
COVER = "COVER"
AMO = "AMO"

# Order Varieties
INTRADAY = "INTRADAY"
DELIVERY = "DELIVERY"
CARRYFORWARD = "CARRYFORWARD"

# Price Types
MARKET = "MARKET"
LIMIT = "LIMIT"
SL_MARKET = "STOPLOSS_MARKET"
SL_LIMIT = "STOPLOSS_LIMIT"

# Exchange Segments
EQUITY_SEGMENTS = ["NSE", "BSE"]
DERIVATIVE_SEGMENTS = ["NFO", "BFO", "MCX", "CDS"]

# Order Duration
DAY = "DAY"
IOC = "IOC"

# Order Side
BUY = "BUY"
SELL = "SELL"

# API Endpoints
PLACE_ORDER_ENDPOINT = "/rest/secure/angelbroking/order/v1/placeOrder"
MODIFY_ORDER_ENDPOINT = "/rest/secure/angelbroking/order/v1/modifyOrder"
CANCEL_ORDER_ENDPOINT = "/rest/secure/angelbroking/order/v1/cancelOrder"

# Error Codes
ERROR_INVALID_QUANTITY = "E001"
ERROR_INVALID_PRICE = "E002"
ERROR_INVALID_TRIGGER = "E003"
ERROR_SESSION_EXPIRED = "E004"
ERROR_MARKET_CLOSED = "E005"
ERROR_INVALID_SYMBOL = "E006"