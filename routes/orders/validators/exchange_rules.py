# routes/orders/validators/exchange_rules.py
from typing import Dict
from ..constants import EQUITY_SEGMENTS, DERIVATIVE_SEGMENTS

class ExchangeRules:
    def apply_rules(self, order_data: Dict, exchange: str) -> Dict:
        """Apply exchange-specific rules to order data"""
        processed_data = order_data.copy()

        if exchange in EQUITY_SEGMENTS:
            processed_data = self._apply_equity_rules(processed_data)
        elif exchange in DERIVATIVE_SEGMENTS:
            processed_data = self._apply_derivative_rules(processed_data)

        return processed_data

    def _apply_equity_rules(self, order_data: Dict) -> Dict:
        """Apply rules for equity segment"""
        # Ensure integer quantity
        order_data['quantity'] = int(order_data['quantity'])
        
        # Round price to 2 decimal places
        if 'price' in order_data:
            order_data['price'] = round(float(order_data['price']), 2)
        
        if 'triggerprice' in order_data:
            order_data['triggerprice'] = round(float(order_data['triggerprice']), 2)

        return order_data

    def _apply_derivative_rules(self, order_data: Dict) -> Dict:
        """Apply rules for derivative segment"""
        # Get lot size from order data
        lot_size = int(order_data.get('lot_size', 1))
        
        # Ensure quantity is multiple of lot size
        qty = int(order_data['quantity'])
        if qty % lot_size != 0:
            raise ValueError(f"Quantity must be multiple of lot size: {lot_size}")
        
        # Round price based on tick size
        if 'price' in order_data:
            tick_size = float(order_data.get('tick_size', 0.05))
            price = float(order_data['price'])
            order_data['price'] = round(price - (price % tick_size), 2)

        return order_data

    def get_exchange_limits(self, exchange: str) -> Dict:
        """Get exchange-specific limits"""
        if exchange in EQUITY_SEGMENTS:
            return {
                'max_order_value': 10000000,  # Example: 1 crore
                'min_order_value': 0,
                'max_quantity': 500000,
                'price_ticks': 0.05
            }
        elif exchange in DERIVATIVE_SEGMENTS:
            return {
                'max_order_value': 100000000,  # Example: 10 crore
                'min_order_value': 0,
                'max_quantity': 10000,
                'price_ticks': 0.05
            }
        return {}