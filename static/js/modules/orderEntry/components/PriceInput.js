// static/js/modules/orderEntry/components/PriceInput.js
var PriceInput = (function() {
    var input = null;
    var options = {
        tickSize: 0.05,
        maxPrice: 999999.99,
        minPrice: 0.01
    };

    function init(inputElement, customOptions) {
        input = inputElement;
        options = Object.assign({}, options, customOptions);
        setupEventListeners();
    }

    function setupEventListeners() {
        if (!input) return;

        input.addEventListener('input', handlePriceInput);
        input.addEventListener('blur', handlePriceBlur);
        input.addEventListener('keydown', handleKeyDown);

        // Add increment/decrement buttons if they exist
        var incrementBtn = input.parentElement.querySelector('.price-increment');
        var decrementBtn = input.parentElement.querySelector('.price-decrement');

        if (incrementBtn) {
            incrementBtn.addEventListener('click', function() {
                adjustPrice(1);
            });
        }

        if (decrementBtn) {
            decrementBtn.addEventListener('click', function() {
                adjustPrice(-1);
            });
        }
    }

    function handlePriceInput(event) {
        var value = event.target.value;
        
        // Remove non-numeric characters except decimal point
        value = value.replace(/[^\d.]/g, '');
        
        // Ensure only one decimal point
        var parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }

        // Limit decimal places
        if (parts.length > 1) {
            value = parts[0] + '.' + parts[1].slice(0, 2);
        }

        event.target.value = value;
    }

    function handlePriceBlur(event) {
        var price = parseFloat(event.target.value);
        if (isNaN(price)) {
            event.target.value = '';
            return;
        }

        // Round to tick size
        price = roundToTickSize(price);

        // Apply min/max constraints
        price = Math.min(Math.max(price, options.minPrice), options.maxPrice);

        event.target.value = price.toFixed(2);

        // Dispatch change event
        var changeEvent = new CustomEvent('price-changed', {
            detail: { price: price }
        });
        input.dispatchEvent(changeEvent);
    }

    function handleKeyDown(event) {
        // Allow up/down arrow keys to increment/decrement
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            adjustPrice(1);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            adjustPrice(-1);
        }
    }

    function adjustPrice(direction) {
        if (!input || input.disabled) return;

        var currentPrice = parseFloat(input.value) || 0;
        var newPrice = roundToTickSize(currentPrice + (direction * options.tickSize));
        
        // Apply min/max constraints
        newPrice = Math.min(Math.max(newPrice, options.minPrice), options.maxPrice);
        
        input.value = newPrice.toFixed(2);

        // Dispatch change event
        var changeEvent = new CustomEvent('price-changed', {
            detail: { price: newPrice }
        });
        input.dispatchEvent(changeEvent);
    }

    function roundToTickSize(price) {
        return Math.round(price / options.tickSize) * options.tickSize;
    }

    function setValue(price) {
        if (!input) return;
        
        var validPrice = roundToTickSize(parseFloat(price) || 0);
        validPrice = Math.min(Math.max(validPrice, options.minPrice), options.maxPrice);
        input.value = validPrice.toFixed(2);
    }

    function setTickSize(newTickSize) {
        options.tickSize = parseFloat(newTickSize) || 0.05;
    }

    return {
        init: init,
        setValue: setValue,
        setTickSize: setTickSize
    };
})();