// static/js/modules/orderEntry/components/OrderForm.js
var OrderForm = (function() {
    var formElement = null;
    var callbacks = {};

    function init(element, options) {
        formElement = element;
        callbacks = options.callbacks || {};
        setupEventListeners();
    }

    function setupEventListeners() {
        if (!formElement) return;

        formElement.addEventListener('submit', handleSubmit);

        // Product type change
        var productTypes = formElement.querySelectorAll('[name="producttype"]');
        productTypes.forEach(function(elem) {
            elem.addEventListener('change', handleProductTypeChange);
        });

        // Order type change
        var orderTypes = formElement.querySelectorAll('[name="ordertype"]');
        orderTypes.forEach(function(elem) {
            elem.addEventListener('change', handleOrderTypeChange);
        });
    }

    function handleSubmit(event) {
        event.preventDefault();

        var formData = {
            symbol: formElement.querySelector('[name="symbol"]').value,
            exchange: formElement.querySelector('[name="exchange"]').value,
            quantity: formElement.querySelector('[name="quantity"]').value,
            price: formElement.querySelector('[name="price"]').value,
            ordertype: formElement.querySelector('[name="ordertype"]:checked').value,
            producttype: formElement.querySelector('[name="producttype"]:checked').value,
            tradingsymbol: formElement.querySelector('[name="tradingsymbol"]').value,
            symboltoken: formElement.querySelector('[name="symboltoken"]').value
        };

        if (callbacks.onSubmit) {
            callbacks.onSubmit(formData);
        }
    }

    function handleProductTypeChange(event) {
        if (callbacks.onProductTypeChange) {
            callbacks.onProductTypeChange(event.target.value);
        }
    }

    function handleOrderTypeChange(event) {
        var isMarket = event.target.value === 'MARKET';
        var priceInput = formElement.querySelector('[name="price"]');
        if (priceInput) {
            priceInput.disabled = isMarket;
        }

        if (callbacks.onOrderTypeChange) {
            callbacks.onOrderTypeChange(event.target.value);
        }
    }

    function reset() {
        if (formElement) {
            formElement.reset();
        }
    }

    return {
        init: init,
        reset: reset
    };
})();