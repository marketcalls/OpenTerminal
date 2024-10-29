// static/js/modules/marketDataUpdater.js

const MarketDataUpdater = {
    // Map to cache previous values for comparison
    previousValues: new Map(),
    settings: {},

    init(settings) {
        this.settings = settings;
    },

    updateSettings(newSettings) {
        this.settings = newSettings;
        // Re-apply settings to all existing watchlist items
        document.querySelectorAll('[data-token]').forEach(item => {
            const tokenString = item.dataset.token;
            const data = this.previousValues.get(tokenString);
            if (data) {
                this.updatePriceInfo(item, data);
            }
        }); 
    },

    updateData(decodedData) {
        const { tokenString } = decodedData;
        const watchlistItems = document.querySelectorAll(`[data-token="${tokenString}"]`);
        const orderModal = document.getElementById('order-modal');
        
        if (watchlistItems.length > 0) {
            watchlistItems.forEach(item => this.updateWatchlistItem(item, decodedData));
        }

        // Update order modal if open and matching symbol
        if (orderModal && !orderModal.classList.contains('hidden')) {
            const modalToken = orderModal.querySelector('#form-token')?.value;
            if (modalToken === tokenString) {
                this.updateOrderModal(decodedData);
            }
        }

        // Cache the current values
        this.previousValues.set(tokenString, decodedData);
    },

    updateWatchlistItem(item, data) {
        this.updatePriceInfo(item, data);
        this.updateMarketStats(item, data);
        this.updateMarketDepth(item, data);
    },
    
    updatePriceInfo(item, data) {
        const ltpElement = item.querySelector('.ltp');
        const changeElement = item.querySelector('.change');
        const changePercentElement = item.querySelector('.change-percent');
        
        if (ltpElement) {
            const previousValue = this.previousValues.get(data.tokenString)?.lastTradedPrice;
            const priceChangeClass = this.getPriceChangeClass(data.lastTradedPrice, previousValue);
            
            ltpElement.textContent = this.formatPrice(data.lastTradedPrice);
            ltpElement.className = `ltp ${priceChangeClass}`;
        }
        
        const change = data.lastTradedPrice - data.closePrice;
        const changePercent = (change / data.closePrice) * 100;
        const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';
        
        if (changeElement) {
            changeElement.textContent = this.formatPrice(change);
            changeElement.className = `change ${changeClass}`;
            changeElement.style.display = this.settings.show_ltp_change ? 'inline' : 'none';
        }
        
        if (changePercentElement) {
            changePercentElement.textContent = `(${changePercent.toFixed(2)}%)`;
            changePercentElement.className = `change-percent ${changeClass}`;
            changePercentElement.style.display = this.settings.show_ltp_change_percent ? 'inline' : 'none';
        }
    },

    updateMarketStats(item, data) {
        // Update OHLC
        this.updateStat(item, 'open', data.openPrice);
        this.updateStat(item, 'high', data.highPrice);
        this.updateStat(item, 'low', data.lowPrice);
        this.updateStat(item, 'close', data.closePrice);
        this.updateStat(item, 'volume', data.volTraded);
        
        // Update total quantities
        this.updateStat(item, 'total-buy-qty', data.totalBuyQty);
        this.updateStat(item, 'total-sell-qty', data.totalSellQty);
    },

    updateMarketDepth(item, data) {

        
        const depthElement = item.querySelector('.depth-data');
        if (!depthElement || !data.bestBids || !data.bestAsks) return;

        let html = '';
        
        // Create arrays of exactly 5 elements each, padding with empty values if needed
        const bids = [...data.bestBids, ...Array(5)].slice(0, 5);
        const asks = [...data.bestAsks, ...Array(5)].slice(0, 5);

        for (let i = 0; i < 5; i++) {
            const bid = bids[i] || { qty: '--', numOrders: '--', price: '--' };
            const ask = asks[i] || { qty: '--', numOrders: '--', price: '--' };

            html += `
                <tr>
                    <td class="text-right py-0.5 bid-qty">${this.formatNumber(bid.qty)}</td>
                    <td class="text-right py-0.5 bid-orders">${bid.numOrders}</td>
                    <td class="text-right py-0.5 text-green-500 font-medium cursor-pointer hover:opacity-80 bid-price" 
                        data-price="${bid.price !== '--' ? bid.price : ''}">${this.formatPrice(bid.price)}</td>
                    <td class="text-right py-0.5 text-red-500 font-medium cursor-pointer hover:opacity-80 ask-price"
                        data-price="${ask.price !== '--' ? ask.price : ''}">${this.formatPrice(ask.price)}</td>
                    <td class="text-right py-0.5 ask-orders">${ask.numOrders}</td>
                    <td class="text-right py-0.5 ask-qty">${this.formatNumber(ask.qty)}</td>
                </tr>
            `;
        }

        depthElement.innerHTML = html;

        // Add click handlers for bid/ask prices
        depthElement.querySelectorAll('.bid-price, .ask-price').forEach(priceElement => {
            priceElement.onclick = (e) => {
                e.stopPropagation();
                const price = e.target.dataset.price;
                if (price) {
                    const orderSide = e.target.classList.contains('bid-price') ? 'SELL' : 'BUY';
                    const symbolData = this.getSymbolDataFromElement(item);
                    OrderModal.show(symbolData, orderSide, parseFloat(price));
                }
            };
        });
    },


    updateOrderModal(data) {
        // Update current price
        const priceElement = document.querySelector('.current-price');
        if (priceElement) {
            priceElement.textContent = this.formatPrice(data.lastTradedPrice);
        }

        // Update change info
        const change = data.lastTradedPrice - data.closePrice;
        const changePercent = (change / data.closePrice) * 100;
        const changeElement = document.querySelector('.price-change');
        if (changeElement) {
            const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';
            changeElement.textContent = `${this.formatPrice(change)} (${changePercent.toFixed(2)}%)`;
            changeElement.className = `text-sm ${changeClass}`;
        }

        // Update market depth if visible
        const depthElement = document.querySelector('#order-market-depth .depth-data');
        if (depthElement && !depthElement.closest('.hidden')) {
            this.updateMarketDepth({ querySelector: () => depthElement }, data);
        }

        // Update default price if it's a limit order
        const priceInput = document.querySelector('input[name="price"]');
        const orderType = document.querySelector('input[name="ordertype"]:checked')?.value;
        if (priceInput && orderType === 'LIMIT' && !priceInput.disabled) {
            priceInput.value = this.formatPrice(data.lastTradedPrice);
        }
    },

    updateStat(element, statName, value) {
        const statElement = element.querySelector(`.${statName}`);
        if (statElement) {
            statElement.textContent = this.formatValue(value, statName);
        }
    },

    getSymbolDataFromElement(element) {
        return {
            symbol: element.dataset.symbol,
            token: element.dataset.token,
            exchange: element.dataset.exchSeg,
            lotSize: parseInt(element.dataset.lotSize) || 1,
            tickSize: parseFloat(element.dataset.tickSize) || 0.05,
            instrumentType: element.dataset.instrumentType,
            ltp: parseFloat(element.querySelector('.ltp')?.textContent) || 0
        };
    },

    formatValue(value, type) {
        switch (type) {
            case 'volume':
                return this.formatVolume(value);
            case 'total-buy-qty':
            case 'total-sell-qty':
                return this.formatNumber(value);
            default:
                return this.formatPrice(value);
        }
    },

    formatVolume(volume) {
        if (!volume || isNaN(volume)) return '--';
        
        if (volume >= 10000000) {
            return (volume / 10000000).toFixed(2) + ' Cr';
        } else if (volume >= 100000) {
            return (volume / 100000).toFixed(2) + ' L';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + ' K';
        }
        return volume.toString();
    },

    formatPrice(price) {
        return price === '--' ? '--' : parseFloat(price).toFixed(2);
    },

    formatNumber(num) {
        if (num === '--' || typeof num !== 'number') return '--';
        return num.toLocaleString('en-IN');
    },

    getPriceChangeClass(currentPrice, previousPrice) {
        if (!previousPrice) return '';
        return currentPrice > previousPrice ? 'text-green-500' : 
               currentPrice < previousPrice ? 'text-red-500' : '';
    }
};

// Export for use in other modules
window.MarketDataUpdater = MarketDataUpdater;