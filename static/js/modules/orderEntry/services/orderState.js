// static/js/modules/orderEntry/services/orderState.js
var OrderState = (function() {
    var currentState = {
        symbol: null,
        order: {
            variety: 'NORMAL',
            side: 'BUY',
            productType: 'INTRADAY',
            orderType: 'LIMIT',
            quantity: 0,
            price: 0,
            triggerPrice: 0,
            exchange: '',
            tradingSymbol: '',
            symbolToken: ''
        },
        validation: {
            isValid: false,
            errors: {}
        },
        market: {
            ltp: 0,
            change: 0,
            changePercent: 0,
            high: 0,
            low: 0
        }
    };

    var listeners = [];

    function updateState(updates, source) {
        var oldState = JSON.parse(JSON.stringify(currentState));
        var hasChanged = false;

        // Deep merge updates into current state
        Object.keys(updates).forEach(function(key) {
            if (typeof updates[key] === 'object' && updates[key] !== null) {
                currentState[key] = Object.assign({}, currentState[key], updates[key]);
                hasChanged = true;
            } else if (currentState[key] !== updates[key]) {
                currentState[key] = updates[key];
                hasChanged = true;
            }
        });

        if (hasChanged) {
            validate();
            notifyListeners(oldState, source);
        }
    }

    function validate() {
        var errors = {};
        var order = currentState.order;

        // Quantity validation
        if (!order.quantity || order.quantity <= 0) {
            errors.quantity = 'Invalid quantity';
        }

        // Price validation for limit orders
        if (order.orderType === 'LIMIT' && (!order.price || order.price <= 0)) {
            errors.price = 'Invalid price';
        }

        // Trigger price validation for stop loss orders
        if (order.variety === 'STOPLOSS' && (!order.triggerPrice || order.triggerPrice <= 0)) {
            errors.triggerPrice = 'Invalid trigger price';
        }

        currentState.validation = {
            isValid: Object.keys(errors).length === 0,
            errors: errors
        };
    }

    function subscribe(callback) {
        listeners.push(callback);
        // Immediately notify with current state
        callback(currentState, null, 'SUBSCRIPTION');
        return function() {
            unsubscribe(callback);
        };
    }

    function unsubscribe(callback) {
        var index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }

    function notifyListeners(oldState, source) {
        listeners.forEach(function(listener) {
            listener(currentState, oldState, source);
        });
    }

    function getState() {
        return JSON.parse(JSON.stringify(currentState));
    }

    function reset() {
        updateState({
            order: {
                variety: 'NORMAL',
                side: 'BUY',
                productType: 'INTRADAY',
                orderType: 'LIMIT',
                quantity: 0,
                price: 0,
                triggerPrice: 0,
                exchange: '',
                tradingSymbol: '',
                symbolToken: ''
            }
        }, 'RESET');
    }

    return {
        updateState: updateState,
        subscribe: subscribe,
        unsubscribe: unsubscribe,
        getState: getState,
        reset: reset
    };
})();