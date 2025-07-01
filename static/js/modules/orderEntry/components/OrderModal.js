// static/js/modules/orderEntry/components/OrderModal.js

const OrderModal = (function() {
    let modal = null;
    let currentSymbol = null;
    let orderSide = null;
    let callbacks = {};
    let currentOrderType = 'regular';

    function init(options = {}) {
        modal = document.getElementById('order-modal');
        callbacks = options;
        
        if (!modal) {
            console.error('Order modal element not found');
            return;
        }

        setupEventListeners();
        initializeButtonStates();
        console.log('OrderModal initialized');
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
                handleTabSwitch(this.dataset.type);
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
            console.log('Quantity controls initialized');
        }
    }

    function setupPriceControls() {
        const priceInput = modal.querySelector('input[name="price"]');
        const decBtn = modal.querySelector('.price-decrement');
        const incBtn = modal.querySelector('.price-increment');
        const quickAdjustBtns = modal.querySelectorAll('.price-adjust');

        if (priceInput && decBtn && incBtn) {
            decBtn.addEventListener('click', () => adjustPrice(-1));
            incBtn.addEventListener('click', () => adjustPrice(1));
            priceInput.addEventListener('change', validatePrice);
            
            quickAdjustBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const adjustment = parseFloat(btn.dataset.adjust);
                    if (!isNaN(adjustment)) {
                        adjustPrice(adjustment);
                    }
                });
            });
            
            console.log('Price controls initialized');
        }
    }

    function validateQuantity(e) {
        const input = e.target;
        const isDerivative = ['NFO', 'MCX', 'CDS', 'BFO'].includes(currentSymbol.exchange);
        
        let value = parseInt(input.value);
        let minQty = isDerivative ? 1 : (currentSymbol?.lotSize || 1);
        let step = isDerivative ? 1 : (currentSymbol?.lotSize || 1);
    
        if (isNaN(value) || value < minQty) {
            input.value = minQty;
        } else {
            // Round to nearest step
            input.value = Math.round(value / step) * step;
        }
        updateTotalQuantity(input.value);
        console.log('Validated quantity:', input.value);
    }

    function validatePrice(e) {
        const input = e.target;
        if (input.disabled) return;

        const value = parseFloat(input.value);
        const step = parseFloat(currentSymbol?.tickSize || 0.05);

        if (isNaN(value) || value <= 0) {
            input.value = formatPrice(currentSymbol?.ltp || 0);
        } else {
            // Round to nearest step
            input.value = formatPrice(Math.round(value / step) * step);
        }
        console.log('Validated price:', input.value);
    }

    function show(symbolData, side = 'BUY', price = null) {
        if (!modal) return;

        currentSymbol = symbolData;
        orderSide = side;
        console.log('Opening order modal for:', symbolData);

        updateModalContent();
        
        // Set price if provided (from market depth click)
        if (price !== null) {
            const priceInput = modal.querySelector('input[name="price"]');
            if (priceInput) {
                priceInput.value = formatPrice(price);
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
        console.log('Closing order modal');
        
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
        console.log('Updating modal content with symbol:', currentSymbol);

        // Update symbol info
        const symbolName = modal.querySelector('.symbol-name');
        const exchangeName = modal.querySelector('.exchange-name');
        const lotSizeInfo = modal.querySelector('#lot-info .lot-size');
        const tickSizeInfo = modal.querySelector('#lot-info .tick-size');
        
        if (symbolName) symbolName.textContent = currentSymbol.symbol;
        if (exchangeName) exchangeName.textContent = currentSymbol.exchange;
        if (lotSizeInfo) lotSizeInfo.textContent = currentSymbol.lotSize || 1;
        if (tickSizeInfo) tickSizeInfo.textContent = currentSymbol.tickSize || 0.05;

        // Update price info
        const priceElement = modal.querySelector('.current-price');
        const ltpElement = modal.querySelector('.current-ltp');
        if (priceElement) priceElement.textContent = formatPrice(currentSymbol.ltp);
        if (ltpElement) ltpElement.textContent = formatPrice(currentSymbol.ltp);

        // Set order side
        setSide(orderSide);

        // Update product type based on exchange
        updateProductType(currentSymbol.exchange);

        // Set default values
        setDefaultValues();

        // Update market depth if visible
        const depthContainer = modal.querySelector('#order-market-depth');
        if (depthContainer && !depthContainer.classList.contains('hidden')) {
            updateMarketDepth(currentSymbol.token);
        }
    }

    function updateProductType(exchange) {
        console.log('Updating product type for exchange:', exchange);
        const isEquity = ['NSE', 'BSE'].includes(exchange);
        const deliveryLabel = modal.querySelector('.delivery-text');
        const deliveryInput = modal.querySelector('input[value="DELIVERY"]');
        
        if (deliveryLabel) {
            deliveryLabel.textContent = isEquity ? 'DELIVERY' : 'CARRY FORWARD';
        }
        if (deliveryInput) {
            deliveryInput.value = isEquity ? 'DELIVERY' : 'CARRYFORWARD';
        }
    }

    function setSide(side) {
        orderSide = side;
        console.log('Setting order side to:', side);
        
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

    function handleTabSwitch(type) {
        currentOrderType = type;
        console.log('Switching to order type:', type);

        const tabs = modal.querySelectorAll('.order-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('tab-active', tab.dataset.type === type);
        });

        // Update variety field
        const varietyInput = modal.querySelector('[name="variety"]');
        if (varietyInput) {
            varietyInput.value = type.toUpperCase();
        }

        // Toggle stop loss fields
        const stopLossFields = modal.querySelector('#stoploss-fields');
        if (stopLossFields) {
            stopLossFields.classList.toggle('hidden', type !== 'stoploss');
        }
    }

    function handleOrderTypeChange(e) {
        updateActiveState(e.target);
        const type = e.target.value;
        console.log('Order type changed to:', type);
        
        const priceInput = modal.querySelector('input[name="price"]');
        const priceControls = modal.querySelector('.price-section');
        const priceAdjustButtons = modal.querySelectorAll('.price-adjust');
        
        const isMarket = type === 'MARKET';
        if (priceInput) {
            priceInput.disabled = isMarket;
            priceInput.value = isMarket ? '0' : formatPrice(currentSymbol?.ltp || 0);
        }
        
        priceControls?.classList.toggle('opacity-50', isMarket);
        priceAdjustButtons.forEach(btn => btn.disabled = isMarket);
    }

    function handleProductTypeChange(e) {
        updateActiveState(e.target);
        console.log('Product type changed to:', e.target.value);
    }

    function setDefaultValues() {
        const form = modal.querySelector('form');
        if (!form || !currentSymbol) return;
        console.log('Setting default values');
    
        // Set hidden values
        form.querySelector('#form-symbol').value = currentSymbol.symbol;
        form.querySelector('#form-token').value = currentSymbol.token;
        form.querySelector('#form-exchange').value = currentSymbol.exchange;
    
        // Set product type based on exchange
        const isEquity = ['NSE', 'BSE'].includes(currentSymbol.exchange);
        const defaultProduct = isEquity ? 'INTRADAY' : 'CARRYFORWARD';
        const productInput = form.querySelector(`input[value="${defaultProduct}"]`);
        if (productInput) {
            productInput.checked = true;
            updateActiveState(productInput);
        }
    
        // Initialize price controls
        const priceInput = form.querySelector('[name="price"]');
        const currentLTP = modal.querySelector('.current-ltp');
        if (priceInput && currentSymbol.ltp) {
            if (currentSymbol.ltp > 0) {
                priceInput.value = formatPrice(currentSymbol.ltp);
                if (currentLTP) {
                    currentLTP.textContent = formatPrice(currentSymbol.ltp);
                }
            }
            priceInput.setAttribute('step', currentSymbol.tickSize || 0.05);
        }
    
        // Set quantity/lots
        const qtyInput = form.querySelector('[name="quantity"]');
        const qtyLabel = modal.querySelector('.quantity-label');
        const totalQtyDiv = modal.querySelector('.total-quantity');
        
        if (qtyInput && qtyLabel && totalQtyDiv) {
            const isDerivative = ['NFO', 'MCX', 'CDS', 'BFO'].includes(currentSymbol.exchange);
            
            if (isDerivative) {
                // For derivatives, default to 1 lot
                qtyInput.value = 1;
                qtyInput.setAttribute('min', 1);
                qtyInput.setAttribute('step', 1);
                qtyLabel.textContent = 'Lots';
                totalQtyDiv.classList.remove('hidden');
                updateTotalQuantity(1);
            } else {
                // For equity, use actual quantity
                qtyInput.value = currentSymbol.lotSize || 1;
                qtyInput.setAttribute('min', currentSymbol.lotSize || 1);
                qtyInput.setAttribute('step', currentSymbol.lotSize || 1);
                qtyLabel.textContent = 'Quantity';
                updateTotalQuantity(qtyInput.value);
            }
        }
    }
    

    function adjustQuantity(direction) {
        const qtyInput = modal.querySelector('input[name="quantity"]');
        if (!qtyInput) return;
    
        const isDerivative = ['NFO', 'MCX', 'CDS', 'BFO'].includes(currentSymbol.exchange);
        const step = isDerivative ? 1 : (currentSymbol?.lotSize || 1);
        const newValue = parseInt(qtyInput.value || 0) + (direction * step);
        
        if (newValue >= step) {
            qtyInput.value = newValue;
            updateTotalQuantity(newValue);
            console.log('Quantity adjusted to:', newValue);
        }
    }

    function adjustPrice(direction) {
        const priceInput = modal.querySelector('input[name="price"]');
        if (!priceInput || priceInput.disabled) return;

        const step = parseFloat(currentSymbol?.tickSize || 0.05);
        const newValue = (parseFloat(priceInput.value) || 0) + (direction * step);
        
        if (newValue > 0) {
            priceInput.value = formatPrice(newValue);
            console.log('Price adjusted to:', newValue);
        }
    }

    function updateTotalQuantity(qty) {
        const totalQtyElement = modal.querySelector('#total-qty');
        if (!totalQtyElement) return;
    
        const lotSize = currentSymbol?.lotSize || 1;
        const isDerivative = ['NFO', 'MCX', 'CDS', 'BFO'].includes(currentSymbol.exchange);
        
        const enteredQty = parseInt(qty) || 0;
        const totalQty = isDerivative ? enteredQty * lotSize : enteredQty;
        totalQtyElement.textContent = totalQty.toLocaleString('en-IN');
    }

    function updateActiveState(input) {
        const name = input.getAttribute('name');
        const group = modal.querySelectorAll(`input[name="${name}"]`);
        
        group.forEach(radio => {
            const label = radio.closest('label');
            if (label) {
                label.classList.toggle('btn-active', radio.checked);
                label.classList.toggle('bg-primary', radio.checked);
                label.classList.toggle('text-primary-content', radio.checked);
            }
        });
    }

    function initializeButtonStates() {
        modal.querySelectorAll('input[type="radio"]:checked').forEach(updateActiveState);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        console.log('Handling order submission...');
    
        try {
            const formData = new FormData(event.target);
            const isDerivative = ['NFO', 'MCX', 'CDS', 'BFO'].includes(currentSymbol.exchange);
            
            let quantity = parseInt(formData.get('quantity'));
            if (isDerivative) {
                // For derivatives, multiply lots by lot size
                //quantity = quantity * (currentSymbol.lotSize || 1);
                quantity = quantity;
                console.log(`Derivative order: ${quantity} (${formData.get('quantity')} lots × ${currentSymbol.lotSize} lot size)`);
            }
    
            const orderData = {
                symbol: currentSymbol.symbol,
                token: currentSymbol.token,
                exchange: currentSymbol.exchange,
                side: orderSide,
                quantity: quantity,  // This will be lots * lotSize for derivatives
                price: formData.get('ordertype') === 'MARKET' ? null : parseFloat(formData.get('price')),
                ordertype: formData.get('ordertype'),
                producttype: formData.get('producttype'),
                variety: formData.get('variety') || 'NORMAL',
                disclosedquantity: "0",
                lot_size: isDerivative ? (currentSymbol.lotSize || 1) : 1  // Add lot_size to order data
            };
    
            if (orderData.variety === 'STOPLOSS' && formData.get('triggerprice')) {
                orderData.triggerprice = parseFloat(formData.get('triggerprice'));
            }
    
            console.log('Order data prepared:', orderData);
    
            if (callbacks.onOrderSubmit) {
                const response = await callbacks.onOrderSubmit(orderData);
                console.log('Order response received:', response);
                return response;
            }
    
        } catch (error) {
            console.error('Order submission error:', error);
            throw error;
        }
    }
    
    function validateOrderData(orderData) {
        if (!orderData.quantity || orderData.quantity <= 0) {
            window.showToast?.('error', 'Invalid quantity');
            return false;
        }
    
        if (orderData.ordertype === 'LIMIT' && (!orderData.price || orderData.price <= 0)) {
            window.showToast?.('error', 'Invalid price for LIMIT order');
            return false;
        }
    
        if (orderData.variety === 'STOPLOSS' && (!orderData.triggerprice || orderData.triggerprice <= 0)) {
            window.showToast?.('error', 'Trigger price required for STOPLOSS order');
            return false;
        }
    
        return true;
    }

    function toggleMarketDepth() {
        const depthContainer = modal.querySelector('#order-market-depth');
        const toggleIcon = modal.querySelector('.market-depth-icon');
        const toggleButton = modal.querySelector('.market-depth-toggle');
        
        if (depthContainer) {
            const isHidden = depthContainer.classList.contains('hidden');
            depthContainer.classList.toggle('hidden');
            
            if (toggleIcon) {
                toggleIcon.style.transform = isHidden ? 'rotate(180deg)' : '';
            }
            if (toggleButton) {
                toggleButton.setAttribute('aria-expanded', !isHidden);
            }
    
            if (!isHidden && currentSymbol) {
                const marketData = window.MarketDataUpdater?.previousValues.get(currentSymbol.token);
                if (marketData) {
                    updateMarketDepth(marketData);
                }
            }
            console.log('Market depth toggled:', !isHidden);
        }
    }

    function updateMarketDepth(data) {
        if (!modal || !data) return;

        console.log('Updating market depth with data:', data);

        // Update OHLC values
        const elements = {
            open: modal.querySelector('.open'),
            high: modal.querySelector('.high'),
            low: modal.querySelector('.low'),
            close: modal.querySelector('.close'),
            volume: modal.querySelector('.volume'),
            totalBuy: modal.querySelector('.total-buy'),
            totalSell: modal.querySelector('.total-sell')
        };

        // Update basic market data
        if (elements.open) elements.open.textContent = formatPrice(data.openPrice);
        if (elements.high) elements.high.textContent = formatPrice(data.highPrice);
        if (elements.low) elements.low.textContent = formatPrice(data.lowPrice);
        if (elements.close) elements.close.textContent = formatPrice(data.closePrice);
        if (elements.volume) elements.volume.textContent = formatVolume(data.volTraded);
        if (elements.totalBuy) elements.totalBuy.textContent = formatNumber(data.totalBuyQty);
        if (elements.totalSell) elements.totalSell.textContent = formatNumber(data.totalSellQty);

        // Update depth table
        const depthContainer = modal.querySelector('#order-market-depth .depth-data');
        if (!depthContainer || !data.bestBids || !data.bestAsks) return;

        const bids = [...data.bestBids, ...Array(5)].slice(0, 5);
        const asks = [...data.bestAsks, ...Array(5)].slice(0, 5);

        let html = '';
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

    function formatPrice(price) {
        return typeof price === 'number' ? price.toFixed(2) : '--';
    }

    function formatNumber(num) {
        if (num === '--' || typeof num !== 'number') return '--';
        return num.toLocaleString('en-IN');
    }

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

    // Public API
    return {
        init,
        show,
        hide,
        setSide,
        setPrice: (price) => {
            const priceInput = modal?.querySelector('input[name="price"]');
            const orderTypeLimit = modal?.querySelector('input[value="LIMIT"]');
            
            if (priceInput && orderTypeLimit && price && !isNaN(price)) {
                orderTypeLimit.checked = true;
                priceInput.disabled = false;
                priceInput.value = formatPrice(price);
                handleOrderTypeChange({ target: orderTypeLimit });
                console.log('Price set to:', price);
            }
        },
        updateMarketDepth
    };
})();

// Export for use in other modules
window.OrderModal = OrderModal;