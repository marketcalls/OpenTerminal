// static/js/modules/orderEntry/utils/validators.js
var OrderValidators = (function() {
    function validateQuantity(quantity, lotSize) {
        quantity = parseInt(quantity, 10);
        lotSize = parseInt(lotSize, 10) || 1;

        if (isNaN(quantity) || quantity <= 0) {
            return {
                isValid: false,
                message: 'Quantity must be greater than 0'
            };
        }

        if (quantity % lotSize !== 0) {
            return {
                isValid: false,
                message: 'Quantity must be multiple of lot size: ' + lotSize
            };
        }

        return {
            isValid: true,
            message: ''
        };
    }

    function validatePrice(price, ltp, tickSize) {
        price = parseFloat(price);
        ltp = parseFloat(ltp);
        tickSize = parseFloat(tickSize) || 0.05;

        if (isNaN(price) || price <= 0) {
            return {
                isValid: false,
                message: 'Invalid price'
            };
        }

        if (price % tickSize !== 0) {
            return {
                isValid: false,
                message: 'Price must be multiple of tick size: ' + tickSize
            };
        }

        // Optional: Add price band validation
        // var upperLimit = ltp * 1.20; // 20% above LTP
        // var lowerLimit = ltp * 0.80; // 20% below LTP

        return {
            isValid: true,
            message: ''
        };
    }

    function validateTriggerPrice(triggerPrice, price, orderType) {
        triggerPrice = parseFloat(triggerPrice);
        price = parseFloat(price);

        if (orderType !== 'STOPLOSS') {
            return {
                isValid: true,
                message: ''
            };
        }

        if (isNaN(triggerPrice) || triggerPrice <= 0) {
            return {
                isValid: false,
                message: 'Invalid trigger price'
            };
        }

        if (triggerPrice >= price) {
            return {
                isValid: false,
                message: 'Trigger price must be less than order price'
            };
        }

        return {
            isValid: true,
            message: ''
        };
    }

    function validateProductType(productType, exchange) {
        var validTypes = ['INTRADAY', 'DELIVERY'];
        if (['NFO', 'MCX', 'CDS'].includes(exchange)) {
            validTypes = ['INTRADAY', 'CARRYFORWARD'];
        }

        return {
            isValid: validTypes.includes(productType),
            message: validTypes.includes(productType) ? '' : 'Invalid product type'
        };
    }

    return {
        validateQuantity: validateQuantity,
        validatePrice: validatePrice,
        validateTriggerPrice: validateTriggerPrice,
        validateProductType: validateProductType
    };
})();