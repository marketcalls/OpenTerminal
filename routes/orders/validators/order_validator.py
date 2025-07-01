# routes/orders/validators/order_validator.py
from typing import Dict, Any, Optional
from ..constants import (
    EQUITY_SEGMENTS, DERIVATIVE_SEGMENTS,
    MARKET, LIMIT, SL_MARKET, SL_LIMIT,
    REGULAR, STOPLOSS
)

class OrderValidator:
    def validate(self, order_data: Dict) -> Dict:
        """Validate complete order data"""
        try:
            self._validate_required_fields(order_data)
            self._validate_order_type(order_data)
            self._validate_exchange(order_data)
            self._validate_quantity(order_data)
            self._validate_price_values(order_data)
            
            return order_data
        except ValueError as e:
            raise ValueError(f"Order validation failed: {str(e)}")

    def _validate_required_fields(self, data: Dict) -> None:
        """Validate presence of required fields"""
        required_fields = {
            'symbol', 'token', 'exchange', 'side', 
            'ordertype', 'producttype', 'quantity'
        }
        
        missing_fields = required_fields - set(data.keys())
        if missing_fields:
            raise ValueError(f"Missing required fields: {missing_fields}")

    def _validate_order_type(self, data: Dict) -> None:
        """Validate order type and related fields"""
        order_type = data.get('ordertype')
        variety = data.get('variety', REGULAR)

        # Validate order type based on variety
        if variety == STOPLOSS:
            if order_type not in [SL_MARKET, SL_LIMIT]:
                raise ValueError(f"Invalid order type {order_type} for STOPLOSS orders")

            if 'triggerprice' not in data:
                raise ValueError("Trigger price required for stop loss orders")
            try:
                trigger_price = float(data['triggerprice'])
                if trigger_price <= 0:
                    raise ValueError("Trigger price must be greater than 0")

                if order_type == SL_LIMIT:
                    price = float(data.get('price', 0))
                    if price <= 0:
                        raise ValueError("Price is required for STOPLOSS_LIMIT orders")

                    # For BUY STOPLOSS, trigger price should be lower than price
                    if data['side'] == 'BUY':
                        if price <= trigger_price:
                            raise ValueError("For Buy STOPLOSS, trigger price must be less than price")
                    # For SELL STOPLOSS, trigger price should be higher than price
                    else:
                        if price >= trigger_price:
                            raise ValueError("For Sell STOPLOSS, trigger price must be greater than price")

            except (ValueError, TypeError):
                raise ValueError("Invalid trigger price")

        elif variety == REGULAR:
            if order_type not in [MARKET, LIMIT]:
                raise ValueError(f"Invalid order type {order_type} for REGULAR orders")

            if order_type == LIMIT and not self._is_valid_price(data.get('price')):
                raise ValueError("Invalid price for limit order")

    def _validate_exchange(self, data: Dict) -> None:
        """Validate exchange and segment specific rules"""
        exchange = data.get('exchange')
        if not exchange:
            raise ValueError("Exchange is required")

        if exchange not in (EQUITY_SEGMENTS + DERIVATIVE_SEGMENTS):
            raise ValueError(f"Invalid exchange: {exchange}")

    def _validate_quantity(self, data: Dict) -> None:
        """Validate quantity based on exchange rules"""
        quantity = data.get('quantity')
        if not quantity or not isinstance(quantity, (int, str)):
            raise ValueError("Invalid quantity")

        try:
            qty = int(quantity)
            if qty <= 0:
                raise ValueError("Quantity must be positive")
        except ValueError:
            raise ValueError("Quantity must be a valid number")

    def _validate_price_values(self, data: Dict) -> None:
        """Validate price values"""
        order_type = data.get('ordertype')
        if order_type in [LIMIT, SL_LIMIT]:
            if not self._is_valid_price(data.get('price')):
                raise ValueError("Invalid price value")

    def _is_valid_price(self, price: Any) -> bool:
        """Check if price is valid"""
        if price is None:
            return False
        try:
            price_float = float(price)
            return price_float > 0
        except (ValueError, TypeError):
            return False

    def validate_price(self, order_price: float, market_price: float, 
                      order_type: str) -> bool:
        """Validate price against market price"""
        if order_type == MARKET:
            return True
            
        try:
            order_price = float(order_price)
            market_price = float(market_price)
            
            # Add your price validation logic here
            # For example, checking circuit limits, price bands, etc.
            return True
            
        except (ValueError, TypeError):
            return False