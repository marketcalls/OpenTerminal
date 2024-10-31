# routes/orders/validators/exchange_rules.py
from typing import Dict
from ..constants import (
    EQUITY_SEGMENTS, DERIVATIVE_SEGMENTS,
    MARKET, LIMIT, SL_MARKET, SL_LIMIT
)

class ExchangeRules:
    def apply_rules(self, order_data: Dict, exchange: str) -> Dict:
        """Apply exchange-specific rules to order data"""
        try:
            processed_data = order_data.copy()

            # Validate exchange
            if exchange not in (EQUITY_SEGMENTS + DERIVATIVE_SEGMENTS):
                raise ValueError(f"Invalid exchange: {exchange}")

            # Apply exchange specific rules
            if exchange in EQUITY_SEGMENTS:
                processed_data = self._apply_equity_rules(processed_data)
            elif exchange in DERIVATIVE_SEGMENTS:
                processed_data = self._apply_derivative_rules(processed_data)

            # Apply common validations
            processed_data = self._apply_common_rules(processed_data)

            return processed_data

        except Exception as e:
            raise ValueError(f"Exchange rules validation failed: {str(e)}")

    def _apply_equity_rules(self, order_data: Dict) -> Dict:
        """Apply rules for equity segment"""
        try:
            # Validate and convert quantity
            quantity = self._validate_integer("quantity", order_data['quantity'])
            
            # Check minimum quantity
            if quantity <= 0:
                raise ValueError("Quantity must be greater than 0")

            # Update order data
            order_data['quantity'] = str(quantity)
            
            # Handle prices
            if order_data.get('ordertype') == LIMIT:
                order_data['price'] = self._format_price(order_data.get('price', 0))
            
            if order_data.get('variety') == 'STOPLOSS':
                order_data['triggerprice'] = self._format_price(order_data.get('triggerprice', 0))

            return order_data

        except Exception as e:
            raise ValueError(f"Equity rules validation failed: {str(e)}")

    def _apply_derivative_rules(self, order_data: Dict) -> Dict:
        """Apply rules for derivative segment"""
        try:
            # Get lot size
            lot_size = int(order_data.get('lot_size', 1))
            if lot_size <= 0:
                raise ValueError("Invalid lot size")

            # For derivatives, input quantity is in lots
            lots = self._validate_integer("quantity", order_data['quantity'])
            if lots <= 0:
                raise ValueError("Number of lots must be greater than 0")

            # Calculate actual quantity
            total_quantity = lots * lot_size
            order_data['quantity'] = str(total_quantity)

            # Validate tick size for price
            tick_size = float(order_data.get('tick_size', 0.05))
            
            # Handle prices based on order type
            if order_data.get('ordertype') == LIMIT:
                price = float(order_data.get('price', 0))
                if price % tick_size != 0:
                    price = round(price - (price % tick_size), 2)
                order_data['price'] = str(price)

            # Handle trigger price for STOPLOSS orders
            if order_data.get('variety') == 'STOPLOSS':
                trigger_price = float(order_data.get('triggerprice', 0))
                if trigger_price % tick_size != 0:
                    trigger_price = round(trigger_price - (trigger_price % tick_size), 2)
                order_data['triggerprice'] = str(trigger_price)

            return order_data

        except Exception as e:
            raise ValueError(f"Derivative rules validation failed: {str(e)}")

    def _apply_common_rules(self, order_data: Dict) -> Dict:
        """Apply common rules for all exchanges"""
        # Ensure all numeric values are strings
        numeric_fields = ['quantity', 'price', 'triggerprice', 'disclosedquantity']
        for field in numeric_fields:
            if field in order_data:
                order_data[field] = str(order_data[field])

        # Validate product type
        product_type = order_data.get('producttype', '').upper()
        exchange = order_data.get('exchange', '')
        
        if exchange in EQUITY_SEGMENTS:
            if product_type not in ['DELIVERY', 'INTRADAY']:
                raise ValueError("Invalid product type for equity segment")
        elif exchange in DERIVATIVE_SEGMENTS:
            if product_type not in ['CARRYFORWARD', 'INTRADAY']:
                raise ValueError("Invalid product type for derivative segment")

        return order_data

    def _validate_integer(self, field_name: str, value: any) -> int:
        """Validate and convert to integer"""
        try:
            return int(float(value))
        except (ValueError, TypeError):
            raise ValueError(f"Invalid {field_name}: must be a valid number")

    def _format_price(self, price: any) -> str:
        """Format price to string with 2 decimal places"""
        try:
            return str(round(float(price), 2))
        except (ValueError, TypeError):
            raise ValueError("Invalid price: must be a valid number")

    def get_exchange_limits(self, exchange: str) -> Dict:
        """Get exchange-specific limits"""
        limits = {
            'NSE': {
                'max_order_value': 10000000,  # 1 crore
                'max_quantity': 500000,
                'price_ticks': 0.05
            },
            'BSE': {
                'max_order_value': 10000000,  # 1 crore
                'max_quantity': 500000,
                'price_ticks': 0.05
            },
            'NFO': {
                'max_order_value': 100000000,  # 10 crore
                'max_quantity': 10000,
                'price_ticks': 0.05
            },
            'MCX': {
                'max_order_value': 100000000,  # 10 crore
                'max_quantity': 10000,
                'price_ticks': 0.05
            }
        }
        return limits.get(exchange, {})