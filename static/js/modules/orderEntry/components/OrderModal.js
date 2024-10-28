// static/js/modules/orderEntry/components/OrderModal.js

const OrderModal = (function() {
    let modal = null;
    let currentSymbol = null;
    let orderSide = null;
    let callbacks = {};

    function init(options = {}) {
        modal = document.getElementById('order-modal');
        callbacks = options;
        
        if (!modal) {
            console.error('Order modal element not found');
            return;
        }

        setupEventListeners();
    }

    function setupEventListeners() {
        if (!modal) return;

        // Close button handler
        const closeBtn = modal.querySelector('.close-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', hide);
        }

        // Tab switching
        const tabs = modal.querySelectorAll('.order-tab');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                switchTab(tab.dataset.type);
            });
        });

        // Buy/Sell toggle
        const buyBtn = modal.querySelector('.buy-toggle');
        const sellBtn = modal.querySelector('.sell-toggle');
        if (buyBtn && sellBtn) {
            buyBtn.addEventListener('click', () => setSide('BUY'));
            sellBtn.addEventListener('click', () => setSide('SELL'));
        }

        // Form submission
        const form = modal.querySelector('form');
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }
    }

    function show(symbolData, side = 'BUY') {
        if (!modal) return;

        currentSymbol = symbolData;
        orderSide = side;

        updateModalContent();
        modal.showModal();  // Using dialog showModal method
    }

    function hide() {
        if (!modal) return;
        
        modal.close();  // Using dialog close method
        
        // Reset form
        const form = modal.querySelector('form');
        if (form) form.reset();

        // Call onOrderClose callback if provided
        if (callbacks.onOrderClose) {
            callbacks.onOrderClose();
        }
    }

    function updateModalContent() {
        if (!modal || !currentSymbol) return;

        // Update symbol info
        const symbolName = modal.querySelector('.symbol-name');
        const exchangeName = modal.querySelector('.exchange-name');
        if (symbolName) symbolName.textContent = currentSymbol.symbol;
        if (exchangeName) exchangeName.textContent = currentSymbol.exchange;

        // Update price info
        const priceElement = modal.querySelector('.current-price');
        if (priceElement) {
            priceElement.textContent = formatPrice(currentSymbol.ltp);
        }

        // Set order side
        setSide(orderSide);

        // Set default values based on exchange
        setDefaultValues();
    }

    function setSide(side) {
        orderSide = side;
        
        // Update button states
        const buyBtn = modal.querySelector('.buy-toggle');
        const sellBtn = modal.querySelector('.sell-toggle');
        if (buyBtn && sellBtn) {
            buyBtn.classList.toggle('btn-success', side === 'BUY');
            sellBtn.classList.toggle('btn-error', side === 'SELL');
        }

        // Update form action button
        const actionBtn = modal.querySelector('.place-order-btn');
        if (actionBtn) {
            actionBtn.textContent = `Place ${side} Order`;
            actionBtn.className = `btn btn-block ${side === 'BUY' ? 'btn-success' : 'btn-error'}`;
        }
    }

    function setDefaultValues() {
        const form = modal.querySelector('form');
        if (!form || !currentSymbol) return;

        // Set quantity
        const qtyInput = form.querySelector('[name="quantity"]');
        if (qtyInput) {
            qtyInput.value = currentSymbol.lotSize || 1;
            qtyInput.setAttribute('min', currentSymbol.lotSize || 1);
            qtyInput.setAttribute('step', currentSymbol.lotSize || 1);
        }

        // Set price
        const priceInput = form.querySelector('[name="price"]');
        if (priceInput) {
            priceInput.value = currentSymbol.ltp || 0;
            priceInput.setAttribute('step', currentSymbol.tickSize || 0.05);
        }

        // Set product type based on exchange
        const isEquity = ['NSE', 'BSE'].includes(currentSymbol.exchange);
        const defaultProduct = isEquity ? 'INTRADAY' : 'CARRYFORWARD';
        const productInput = form.querySelector(`[value="${defaultProduct}"]`);
        if (productInput) {
            productInput.checked = true;
        }
    }

    function handleSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const orderData = {
            symbol: currentSymbol.symbol,
            token: currentSymbol.token,
            exchange: currentSymbol.exchange,
            side: orderSide,
            quantity: parseInt(formData.get('quantity')),
            price: parseFloat(formData.get('price')),
            ordertype: formData.get('ordertype'),
            producttype: formData.get('producttype'),
            variety: formData.get('variety') || 'NORMAL'
        };

        if (orderData.variety === 'STOPLOSS') {
            orderData.triggerprice = parseFloat(formData.get('triggerprice'));
        }

        // Call onOrderSubmit callback if provided
        if (callbacks.onOrderSubmit) {
            callbacks.onOrderSubmit(orderData);
        }
    }

    function switchTab(tabId) {
        const tabs = modal.querySelectorAll('.order-tab');
        const contents = modal.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === tabId);
        });

        contents.forEach(content => {
            content.classList.toggle('hidden', content.dataset.type !== tabId);
        });

        // Update form variety based on tab
        const varietyInput = modal.querySelector('[name="variety"]');
        if (varietyInput) {
            varietyInput.value = tabId === 'stoploss' ? 'STOPLOSS' : 'NORMAL';
        }
    }

    function formatPrice(price) {
        return typeof price === 'number' ? price.toFixed(2) : '--';
    }

    return {
        init,
        show,
        hide,
        setSide
    };
})();

// Export for use in other modules
window.OrderModal = OrderModal;