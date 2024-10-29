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
        initializeButtonStates();
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
        modal.querySelector('.buy-toggle')?.addEventListener('click', () => setSide('BUY'));
        modal.querySelector('.sell-toggle')?.addEventListener('click', () => setSide('SELL'));

        // Product type changes
        modal.querySelectorAll('input[name="producttype"]').forEach(radio => {
            radio.addEventListener('change', handleProductTypeChange);
        });

        // Order type changes
        modal.querySelectorAll('input[name="ordertype"]').forEach(radio => {
            radio.addEventListener('change', handleOrderTypeChange);
        });

        // Quantity controls
        setupQuantityControls();

        // Price controls
        setupPriceControls();

        // Market Depth toggle
        modal.querySelector('.market-depth-toggle')?.addEventListener('click', (e) => {
            e.preventDefault();
            toggleMarketDepth();
        });

        // Form submission
        modal.querySelector('form')?.addEventListener('submit', handleSubmit);
    }

    function setupQuantityControls() {
        const qtyInput = modal.querySelector('input[name="quantity"]');
        const decBtn = modal.querySelector('.qty-decrement');
        const incBtn = modal.querySelector('.qty-increment');

        if (qtyInput && decBtn && incBtn) {
            decBtn.addEventListener('click', () => adjustQuantity(-1));
            incBtn.addEventListener('click', () => adjustQuantity(1));
            qtyInput.addEventListener('change', validateQuantity);
        }
    }

    function setupPriceControls() {
        const priceInput = modal.querySelector('input[name="price"]');
        const decBtn = modal.querySelector('.price-decrement');
        const incBtn = modal.querySelector('.price-increment');

        if (priceInput && decBtn && incBtn) {
            decBtn.addEventListener('click', () => adjustPrice(-1));
            incBtn.addEventListener('click', () => adjustPrice(1));
            priceInput.addEventListener('change', validatePrice);
        }
    }

    // Add these validation functions after setupPriceControls

    function validateQuantity(e) {
        const input = e.target;
        const value = parseInt(input.value);
        const minQty = parseInt(input.getAttribute('min')) || 1;
        const step = parseInt(input.getAttribute('step')) || 1;

        if (isNaN(value) || value < minQty) {
            input.value = minQty;
        } else {
            // Round to nearest step
            input.value = Math.round(value / step) * step;
        }
        updateTotalQuantity(input.value);
    }

    function validatePrice(e) {
        const input = e.target;
        if (input.disabled) return;

        const value = parseFloat(input.value);
        const step = parseFloat(input.getAttribute('step')) || 0.05;

        if (isNaN(value) || value <= 0) {
            input.value = formatPrice(currentSymbol?.ltp || 0);
        } else {
            // Round to nearest step
            input.value = (Math.round(value / step) * step).toFixed(2);
        }
    }


    function show(symbolData, side = 'BUY', price = null) {
        if (!modal) return;

        currentSymbol = symbolData;
        orderSide = side;

        updateModalContent();
        
        // Set price if provided (from market depth click)
        if (price !== null) {
            const priceInput = modal.querySelector('input[name="price"]');
            if (priceInput) {
                priceInput.value = price.toFixed(2);
                // Ensure LIMIT order type is selected
                const limitRadio = modal.querySelector('input[value="LIMIT"]');
                if (limitRadio) {
                    limitRadio.checked = true;
                    handleOrderTypeChange({ target: limitRadio });
                }
            }
        }

        initializeButtonStates();
        modal.showModal();
    }

    function hide() {
        if (!modal) return;
        
        modal.close();
        
        // Reset form
        const form = modal.querySelector('form');
        if (form) form.reset();

        // Reset market depth
        const depthContainer = modal.querySelector('#order-market-depth');
        if (depthContainer) {
            depthContainer.classList.add('hidden');
        }

        if (callbacks.onOrderClose) {
            callbacks.onOrderClose();
        }
    }

    function updateModalContent() {
        if (!modal || !currentSymbol) return;

        // Update symbol info
        const symbolName = modal.querySelector('.symbol-name');
        const exchangeName = modal.querySelector('.exchange-name');
        const lotSizeInfo = modal.querySelector('#lot-info .lot-size');
        
        if (symbolName) symbolName.textContent = currentSymbol.symbol;
        if (exchangeName) exchangeName.textContent = currentSymbol.exchange;
        if (lotSizeInfo) lotSizeInfo.textContent = currentSymbol.lotSize || 1;

        // Update price info
        const priceElement = modal.querySelector('.current-price');
        if (priceElement) {
            priceElement.textContent = formatPrice(currentSymbol.ltp);
        }

        // Set order side
        setSide(orderSide);

        // Update product type based on exchange
        updateProductType(currentSymbol.exchange);

        // Set default values
        setDefaultValues();

        // Add this block at the end of updateModalContent function
        const depthContainer = modal.querySelector('#order-market-depth');
        if (depthContainer && !depthContainer.classList.contains('hidden')) {
        updateMarketDepth(currentSymbol.token);
        }
    }

    function updateProductType(exchange) {
        const isEquity = ['NSE', 'BSE'].includes(exchange);
        const deliveryLabel = modal.querySelector('.delivery-type span');
        const deliveryInput = modal.querySelector('#delivery');
        
        if (deliveryLabel) {
            deliveryLabel.textContent = isEquity ? 'DELIVERY' : 'CARRY FORWARD';
        }
        if (deliveryInput) {
            deliveryInput.value = isEquity ? 'DELIVERY' : 'CARRYFORWARD';
        }
    }

    function setSide(side) {
        orderSide = side;
        
        // Update button states
        const buyBtn = modal.querySelector('.buy-toggle');
        const sellBtn = modal.querySelector('.sell-toggle');
        
        if (buyBtn && sellBtn) {
            buyBtn.classList.remove('btn-success', 'btn-ghost');
            sellBtn.classList.remove('btn-error', 'btn-ghost');
            
            if (side === 'BUY') {
                buyBtn.classList.add('btn-success');
                sellBtn.classList.add('btn-ghost');
            } else {
                buyBtn.classList.add('btn-ghost');
                sellBtn.classList.add('btn-error');
            }
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

        // Set hidden values
        form.querySelector('#form-symbol').value = currentSymbol.symbol;
        form.querySelector('#form-token').value = currentSymbol.token;
        form.querySelector('#form-exchange').value = currentSymbol.exchange;

        // Set quantity
        const qtyInput = form.querySelector('[name="quantity"]');
        if (qtyInput) {
            qtyInput.value = currentSymbol.lotSize || 1;
            qtyInput.setAttribute('min', currentSymbol.lotSize || 1);
            qtyInput.setAttribute('step', currentSymbol.lotSize || 1);
            updateTotalQuantity(qtyInput.value);
        }

        // Set price
        const priceInput = form.querySelector('[name="price"]');
        if (priceInput) {
            priceInput.value = formatPrice(currentSymbol.ltp || 0);
            priceInput.setAttribute('step', currentSymbol.tickSize || 0.05);
        }

        // Set product type based on exchange
        const isEquity = ['NSE', 'BSE'].includes(currentSymbol.exchange);
        const defaultProduct = isEquity ? 'INTRADAY' : 'CARRYFORWARD';
        const productInput = form.querySelector(`[value="${defaultProduct}"]`);
        if (productInput) {
            productInput.checked = true;
            updateButtonStates(productInput);
        }
    }

    function handleOrderTypeChange(e) {
        updateButtonStates(e.target);
        
        const priceInput = modal.querySelector('input[name="price"]');
        const priceControls = modal.querySelector('.price-controls');
        
        if (e.target.value === 'MARKET') {
            priceInput.disabled = true;
            priceInput.value = '0';
            priceControls.classList.add('opacity-50');
        } else {
            priceInput.disabled = false;
            priceInput.value = formatPrice(currentSymbol?.ltp || 0);
            priceControls.classList.remove('opacity-50');
        }
    }

    function handleProductTypeChange(e) {
        updateButtonStates(e.target);
    }

    function adjustQuantity(direction) {
        const qtyInput = modal.querySelector('input[name="quantity"]');
        if (!qtyInput) return;

        const step = parseInt(currentSymbol?.lotSize || 1);
        const newValue = parseInt(qtyInput.value || 0) + (direction * step);
        
        if (newValue >= step) {
            qtyInput.value = newValue;
            updateTotalQuantity(newValue);
        }
    }

    function adjustPrice(direction) {
        const priceInput = modal.querySelector('input[name="price"]');
        if (!priceInput || priceInput.disabled) return;

        const step = parseFloat(currentSymbol?.tickSize || 0.05);
        const newValue = (parseFloat(priceInput.value) || 0) + (direction * step);
        
        if (newValue > 0) {
            priceInput.value = formatPrice(newValue);
        }
    }

    function updateTotalQuantity(qty) {
        const totalQty = parseInt(qty) * (currentSymbol?.lotSize || 1);
        const totalQtyElement = modal.querySelector('#total-qty');
        if (totalQtyElement) {
            totalQtyElement.textContent = totalQty.toLocaleString('en-IN');
        }
    }

    // Add these new methods
    function updateMarketDepth(data) {

        // Update OHLC values
        modal.querySelector('.ohlc-open').textContent = formatPrice(data.openPrice);
        modal.querySelector('.ohlc-high').textContent = formatPrice(data.highPrice);
        modal.querySelector('.ohlc-low').textContent = formatPrice(data.lowPrice);
        modal.querySelector('.ohlc-close').textContent = formatPrice(data.closePrice);

        // Update volume and total quantities
        modal.querySelector('.depth-volume').textContent = formatVolume(data.volTraded);
        modal.querySelector('.total-buy').textContent = formatNumber(data.totalBuyQty);
        modal.querySelector('.total-sell').textContent = formatNumber(data.totalSellQty);

        const depthContainer = modal.querySelector('#order-market-depth .depth-data');
        if (!depthContainer || !data.bestBids || !data.bestAsks) return;

        let html = '';
        const bids = [...data.bestBids, ...Array(5)].slice(0, 5);
        const asks = [...data.bestAsks, ...Array(5)].slice(0, 5);

        for (let i = 0; i < 5; i++) {
            const bid = bids[i] || { qty: '--', numOrders: '--', price: '--' };
            const ask = asks[i] || { qty: '--', numOrders: '--', price: '--' };

            html += `
                <tr>
                    <td class="text-right py-0.5">${formatNumber(bid.qty)}</td>
                    <td class="text-right py-0.5">${bid.numOrders}</td>
                    <td class="text-right py-0.5 text-green-500 font-medium cursor-pointer hover:opacity-80"
                        data-price="${bid.price !== '--' ? bid.price : ''}"
                        onclick="OrderModal.setPrice(${bid.price})">${formatPrice(bid.price)}</td>
                    <td class="text-right py-0.5 text-red-500 font-medium cursor-pointer hover:opacity-80"
                        data-price="${ask.price !== '--' ? ask.price : ''}"
                        onclick="OrderModal.setPrice(${ask.price})">${formatPrice(ask.price)}</td>
                    <td class="text-right py-0.5">${ask.numOrders}</td>
                    <td class="text-right py-0.5">${formatNumber(ask.qty)}</td>
                </tr>
            `;
        }

        depthContainer.innerHTML = html;
    }

    // Add this helper function for volume formatting
    function formatVolume(volume) {
        if (!volume || isNaN(volume)) return '--';
        
        if (volume >= 10000000) {
            return (volume / 10000000).toFixed(2) + ' Cr';
        } else if (volume >= 100000) {
            return (volume / 100000).toFixed(2) + ' L';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + ' K';
        }
        return volume.toString();
    }

    function setPrice(price) {
        if (!modal || !price || isNaN(price)) return;
        
        const priceInput = modal.querySelector('input[name="price"]');
        const orderTypeLimit = modal.querySelector('input[value="LIMIT"]');
        
        if (priceInput && orderTypeLimit) {
            orderTypeLimit.checked = true;
            priceInput.disabled = false;
            priceInput.value = price.toFixed(2);
            handleOrderTypeChange({ target: orderTypeLimit });
        }
    }

    function formatNumber(num) {
        if (num === '--' || typeof num !== 'number') return '--';
        return num.toLocaleString('en-IN');
    }

    function toggleMarketDepth() {
        const depthContainer = modal.querySelector('#order-market-depth');
        const toggleIcon = modal.querySelector('.market-depth-icon');
        const toggleButton = modal.querySelector('.market-depth-toggle');
        
        if (depthContainer) {
            const isHidden = depthContainer.classList.contains('hidden');
            
            // Toggle the depth container visibility
            depthContainer.classList.toggle('hidden');
            
            // Update the toggle button icon/state
            if (toggleIcon) {
                toggleIcon.style.transform = isHidden ? 'rotate(180deg)' : '';
            }
            if (toggleButton) {
                toggleButton.setAttribute('aria-expanded', !isHidden);
            }
    
            // If showing depth, ensure we have the latest data
            if (!isHidden && currentSymbol) {
                // Trigger market depth update
                const marketData = window.MarketDataUpdater?.previousValues.get(currentSymbol.token);
                if (marketData) {
                    updateMarketDepth(marketData);
                }
            }
        }
    }

    function updateButtonStates(input) {
        const name = input.getAttribute('name');
        const group = modal.querySelectorAll(`input[name="${name}"]`);
        
        group.forEach(radio => {
            const label = radio.closest('label');
            if (label) {
                if (radio.checked) {
                    label.classList.add('btn-active', 'bg-primary', 'text-primary-content');
                } else {
                    label.classList.remove('btn-active', 'bg-primary', 'text-primary-content');
                }
            }
        });
    }

    function initializeButtonStates() {
        modal.querySelectorAll('input[type="radio"]:checked').forEach(updateButtonStates);
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

        if (callbacks.onOrderSubmit) {
            callbacks.onOrderSubmit(orderData);
        }
    }

    function formatPrice(price) {
        return typeof price === 'number' ? price.toFixed(2) : '--';
    }

    return {
        init,
        show,
        hide,
        setSide,
        setPrice,  // Add this
        updateMarketDepth  // Add this
    };
})();

// Export for use in other modules
window.OrderModal = OrderModal;