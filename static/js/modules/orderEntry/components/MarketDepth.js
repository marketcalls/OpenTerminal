// static/js/modules/orderEntry/components/MarketDepth.js
var MarketDepth = (function() {
    var container = null;
    var currentSymbol = null;
    var depthData = null;

    function init(element) {
        container = element;
        setupEventListeners();
    }

    function setupEventListeners() {
        if (!container) return;

        container.addEventListener('click', function(event) {
            var priceElement = event.target.closest('.depth-price');
            if (priceElement) {
                handlePriceClick(priceElement.dataset.price);
            }
        });
    }

    function update(symbol, data) {
        currentSymbol = symbol;
        depthData = data;
        render();
    }

    function render() {
        if (!container || !depthData) return;

        var html = '<div class="depth-header">' +
            '<div class="grid grid-cols-6 text-xs font-medium mb-2">' +
            '<div class="col-span-1 text-right">Qty</div>' +
            '<div class="col-span-1 text-right">Orders</div>' +
            '<div class="col-span-1 text-right text-success">Bid</div>' +
            '<div class="col-span-1 text-right text-error">Ask</div>' +
            '<div class="col-span-1 text-right">Orders</div>' +
            '<div class="col-span-1 text-right">Qty</div>' +
            '</div></div>';

        html += '<div class="depth-body">';
        
        // Assuming depthData has bids and asks arrays
        for (var i = 0; i < Math.max(depthData.bids.length, depthData.asks.length); i++) {
            var bid = depthData.bids[i] || { quantity: 0, price: 0, orders: 0 };
            var ask = depthData.asks[i] || { quantity: 0, price: 0, orders: 0 };

            html += '<div class="grid grid-cols-6 text-xs py-1">' +
                '<div class="col-span-1 text-right">' + formatters.formatQuantity(bid.quantity) + '</div>' +
                '<div class="col-span-1 text-right">' + bid.orders + '</div>' +
                '<div class="col-span-1 text-right text-success depth-price" data-price="' + bid.price + '">' + 
                    formatters.formatPrice(bid.price) + '</div>' +
                '<div class="col-span-1 text-right text-error depth-price" data-price="' + ask.price + '">' + 
                    formatters.formatPrice(ask.price) + '</div>' +
                '<div class="col-span-1 text-right">' + ask.orders + '</div>' +
                '<div class="col-span-1 text-right">' + formatters.formatQuantity(ask.quantity) + '</div>' +
                '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    function handlePriceClick(price) {
        // Dispatch event for price selection
        var event = new CustomEvent('depth-price-selected', {
            detail: { price: price }
        });
        container.dispatchEvent(event);
    }

    function clear() {
        if (container) {
            container.innerHTML = '';
        }
        currentSymbol = null;
        depthData = null;
    }

    return {
        init: init,
        update: update,
        clear: clear
    };
})();