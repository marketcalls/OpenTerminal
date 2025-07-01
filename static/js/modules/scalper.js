document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const symbolSearch = document.getElementById('symbolSearch');
    const searchResults = document.getElementById('searchResults');
    const selectedSymbol = document.getElementById('selectedSymbol');
    const selectedExchange = document.getElementById('selectedExchange');
    const quantity = document.getElementById('quantity');
    const orderHistory = document.getElementById('orderHistory').getElementsByTagName('tbody')[0];
    const apiLog = document.getElementById('apiLog');
    const apiStatus = document.getElementById('apiStatus');
    const totalOrders = document.getElementById('totalOrders');
    const buyOrders = document.getElementById('buyOrders');
    const sellOrders = document.getElementById('sellOrders');
    const productTypeInputs = document.getElementsByName('productType');

    // Get CSRF token from meta tag
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    let selectedInstrument = null;
    let searchTimeout = null;
    let orderStats = {
        total: 0,
        buy: 0,
        sell: 0
    };

    // Exchange badge colors
    const exchangeColors = {
        'NSE': 'badge-primary',
        'BSE': 'badge-secondary',
        'NFO': 'badge-accent',
        'CDS': 'badge-info',
        'BFO': 'badge-warning',
        'BCD': 'badge-neutral',
        'MCX': 'badge-success',
        'NCDEX': 'badge-error'
    };

    // Function to convert UTC to IST
    function formatISTTime(utcTime) {
        const date = new Date(utcTime);
        return date.toLocaleString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }

    // Initialize product type buttons
    productTypeInputs.forEach(input => {
        const title = input.getAttribute('data-title');
        const label = document.createElement('label');
        label.className = 'btn flex-1' + (input.checked ? ' btn-active' : '');
        label.innerHTML = title;
        input.parentNode.insertBefore(label, input.nextSibling);
        
        label.addEventListener('click', () => {
            input.click();
            updateProductTypeButtons();
        });
    });

    function updateProductTypeButtons() {
        productTypeInputs.forEach(input => {
            const label = input.nextSibling;
            if (input.checked) {
                label.classList.add('btn-active');
            } else {
                label.classList.remove('btn-active');
            }
        });
    }

    // Get selected product type
    function getSelectedProductType() {
        const selected = Array.from(productTypeInputs).find(input => input.checked);
        return selected ? selected.value : 'MIS';
    }

    // Symbol search functionality
    symbolSearch.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = this.value.trim();
            if (query.length >= 2) {
                fetch(`/scalper/search?q=${encodeURIComponent(query)}`, {
                    headers: {
                        'X-CSRFToken': csrfToken,
                        'Accept': 'application/json'
                    },
                    credentials: 'same-origin'
                })
                    .then(response => response.json())
                    .then(data => {
                        searchResults.innerHTML = '';
                        data.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'p-3 hover:bg-base-300 cursor-pointer';
                            div.innerHTML = `
                                <div class="font-bold">${item.symbol}</div>
                                <div class="badge ${exchangeColors[item.exch_seg] || 'badge-ghost'}">${item.exch_seg}</div>
                            `;
                            div.addEventListener('click', () => {
                                selectedInstrument = item;
                                updateSelectedSymbolInfo(item);
                                searchResults.innerHTML = '';
                                symbolSearch.value = '';
                            });
                            searchResults.appendChild(div);
                        });
                    });
            } else {
                searchResults.innerHTML = '';
            }
        }, 300);
    });

    // Update selected symbol info
    function updateSelectedSymbolInfo(instrument) {
        selectedSymbol.textContent = instrument.symbol;
        selectedExchange.innerHTML = `
            <div class="badge ${exchangeColors[instrument.exch_seg] || 'badge-ghost'}">${instrument.exch_seg}</div>
        `;
    }

    // Quantity controls
    window.incrementQty = function() {
        quantity.value = parseInt(quantity.value) + 1;
    }

    window.decrementQty = function() {
        const newValue = parseInt(quantity.value) - 1;
        if (newValue >= 1) quantity.value = newValue;
    }

    // Keyboard controls
    document.addEventListener('keydown', function(event) {
        if (!selectedInstrument) {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                showToast('Please select a symbol first', 'warning');
            }
            return;
        }

        const qty = parseInt(quantity.value);
        if (isNaN(qty) || qty <= 0) {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                showToast('Please enter a valid quantity', 'warning');
            }
            return;
        }

        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            const action = event.key === 'ArrowUp' ? 'BUY' : 'SELL';
            placeOrder(action, qty);
            // Prevent page scroll
            event.preventDefault();
        }
    });

    // Place order function
    function placeOrder(action, qty) {
        const orderData = {
            action: action,
            quantity: qty,
            symbol: selectedInstrument.symbol,
            exchange: selectedInstrument.exch_seg,
            product_type: getSelectedProductType()
        };

        // Update API status
        apiStatus.textContent = 'Processing';
        apiStatus.className = 'badge badge-warning';

        // Log API request
        logApiActivity('Request', orderData);

        fetch('/scalper/place_order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
                'Accept': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(orderData)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(text);
                });
            }
            return response.json();
        })
        .then(data => {
            // Log API response
            logApiActivity('Response', data);

            if (data.status === 'success') {
                showToast(`${action} order placed successfully`, 'success');
                updateOrderHistory();
                updateOrderStats(action);
                
                // Update API status
                apiStatus.textContent = 'Success';
                apiStatus.className = 'badge badge-success';
            } else {
                showToast(`Order failed: ${data.message || data.error}`, 'error');
                
                // Update API status
                apiStatus.textContent = 'Error';
                apiStatus.className = 'badge badge-error';
            }
        })
        .catch(error => {
            console.error('Error placing order:', error);
            showToast('Error placing order. Please try again.', 'error');
            
            // Update API status
            apiStatus.textContent = 'Error';
            apiStatus.className = 'badge badge-error';
            
            // Log error
            logApiActivity('Error', { message: error.message });
        })
        .finally(() => {
            setTimeout(() => {
                apiStatus.textContent = 'Ready';
                apiStatus.className = 'badge badge-primary';
            }, 3000);
        });
    }

    // Log API activity
    function logApiActivity(type, data) {
        const entry = document.createElement('div');
        entry.className = 'mb-2';
        
        const timestamp = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        const content = `
            <div class="text-xs opacity-50">${timestamp} - ${type}</div>
            <div class="text-sm whitespace-pre-wrap">${JSON.stringify(data, null, 2)}</div>
        `;
        
        entry.innerHTML = content;
        apiLog.insertBefore(entry, apiLog.firstChild);

        // Keep only last 50 entries
        if (apiLog.children.length > 50) {
            apiLog.removeChild(apiLog.lastChild);
        }
    }

    // Show toast message
    function showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} mb-2`;
        toast.innerHTML = `<span>${message}</span>`;
        
        const container = document.getElementById('toastContainer');
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    // Update order history
    window.updateOrderHistory = function() {
        fetch('/scalper/orders', {
            headers: {
                'X-CSRFToken': csrfToken,
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        })
            .then(response => response.json())
            .then(orders => {
                orderHistory.innerHTML = '';
                
                // Sort orders by timestamp in descending order (newest first)
                orders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                orders.forEach(order => {
                    const row = orderHistory.insertRow();
                    row.className = order.transaction_type === 'BUY' ? 'hover bg-success/10' : 'hover bg-error/10';
                    row.innerHTML = `
                        <td>${formatISTTime(order.timestamp)}</td>
                        <td>${order.symbol}</td>
                        <td>
                            <div class="badge ${order.transaction_type === 'BUY' ? 'badge-success' : 'badge-error'}">
                                ${order.transaction_type}
                            </div>
                        </td>
                        <td>
                            <div class="badge badge-ghost">${order.product_type}</div>
                        </td>
                        <td>${order.quantity}</td>
                        <td>
                            <div class="badge badge-ghost">${order.status}</div>
                        </td>
                        <td class="font-mono text-xs">${order.order_id}</td>
                        <td>${order.message || ''}</td>
                    `;
                });

                // Update order statistics
                updateOrderStatsFromHistory(orders);
            });
    }

    // Update order statistics
    function updateOrderStats(action) {
        orderStats.total++;
        if (action === 'BUY') orderStats.buy++;
        if (action === 'SELL') orderStats.sell++;
        
        updateStatsDisplay();
    }

    function updateOrderStatsFromHistory(orders) {
        orderStats = {
            total: orders.length,
            buy: orders.filter(o => o.transaction_type === 'BUY').length,
            sell: orders.filter(o => o.transaction_type === 'SELL').length
        };
        
        updateStatsDisplay();
    }

    function updateStatsDisplay() {
        totalOrders.textContent = orderStats.total;
        buyOrders.textContent = orderStats.buy;
        sellOrders.textContent = orderStats.sell;
    }

    // Initial order history load
    updateOrderHistory();

    // Refresh order history every 5 seconds
    setInterval(updateOrderHistory, 5000);
});
