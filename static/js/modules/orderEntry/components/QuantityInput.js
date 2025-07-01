// static/js/modules/orderEntry/components/QuantityInput.js
var QuantityInput = (function() {
    var input = null;
    var options = {
        lotSize: 1,
        maxQuantity: 999999,
        minQuantity: 1
    };

    function init(inputElement, customOptions) {
        input = inputElement;
        options = Object.assign({}, options, customOptions);
        setupEventListeners();
    }

    function setupEventListeners() {
        if (!input) return;

        input.addEventListener('input', handleQuantityInput);
        input.addEventListener('blur', handleQuantityBlur);
        input.addEventListener('keydown', handleKeyDown);

        // Add increment/decrement buttons if they exist
        var incrementBtn = input.parentElement.querySelector('.qty-increment');
        var decrementBtn = input.parentElement.querySelector('.qty-decrement');

        if (incrementBtn) {
            incrementBtn.addEventListener('click', function() {
                adjustQuantity(1);
            });
        }

        if (decrementBtn) {
            decrementBtn.addEventListener('click', function() {
                adjustQuantity(-1);
            });
        }
    }

    function handleQuantityInput(event) {
        // Allow only numbers
        var value = event.target.value.replace(/\D/g, '');
        event.target.value = value;
    }

    function handleQuantityBlur(event) {
        var quantity = parseInt(event.target.value, 10);
        if (isNaN(quantity)) {
            event.target.value = options.lotSize;
            return;
        }

        // Round to lot size
        quantity = roundToLotSize(quantity);

        // Apply min/max constraints
        quantity = Math.min(Math.max(quantity, options.minQuantity), options.maxQuantity);

        event.target.value = quantity;

        // Dispatch change event
        var changeEvent = new CustomEvent('quantity-changed', {
            detail: { 
                quantity: quantity,
                lots: quantity / options.lotSize
            }
        });
        input.dispatchEvent(changeEvent);
    }

    function handleKeyDown(event) {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            adjustQuantity(1);
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            adjustQuantity(-1);
        }
    }

    function adjustQuantity(direction) {
        if (!input) return;

        var currentQty = parseInt(input.value, 10) || 0;
        var newQty = roundToLotSize(currentQty + (direction * options.lotSize));
        
        // Apply min/max constraints
        newQty = Math.min(Math.max(newQty, options.minQuantity), options.maxQuantity);
        
        input.value = newQty;

        // Dispatch change event
        var changeEvent = new CustomEvent('quantity-changed', {
            detail: { 
                quantity: newQty,
                lots: newQty / options.lotSize
            }
        });
        input.dispatchEvent(changeEvent);
    }

    function roundToLotSize(quantity) {
        return Math.round(quantity / options.lotSize) * options.lotSize;
    }

    function setValue(quantity) {
        if (!input) return;
        
        var validQty = roundToLotSize(parseInt(quantity, 10) || options.lotSize);
        validQty = Math.min(Math.max(validQty, options.minQuantity), options.maxQuantity);
        input.value = validQty;
    }

    function setLotSize(newLotSize) {
        options.lotSize = parseInt(newLotSize, 10) || 1;
        // Update current value to match new lot size
        if (input) {
            var currentQty = parseInt(input.value, 10) || options.lotSize;
            setValue(currentQty);
        }
    }

    return {
        init: init,
        setValue: setValue,
        setLotSize: setLotSize
    };
})();