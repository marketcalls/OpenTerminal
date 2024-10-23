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
        
        if (watchlistItems.length === 0) return;
        
        watchlistItems.forEach(watchlistItem => {
            this.updatePriceInfo(watchlistItem, decodedData);
            this.updateMarketStats(watchlistItem, decodedData);
        });

        this.updateMarketDepth(tokenString, decodedData);
        
        // Cache the current values
        this.previousValues.set(tokenString, decodedData);
    },
    
    updatePriceInfo(element, data) {
        const ltpElement = element.querySelector('.ltp');
        const changeElement = element.querySelector('.change');
        const changePercentElement = element.querySelector('.change-percent');
        
        if (ltpElement) {
            const previousValue = this.previousValues.get(data.tokenString)?.lastTradedPrice;
            const priceChangeClass = this.getPriceChangeClass(data.lastTradedPrice, previousValue);
            
            ltpElement.textContent = data.lastTradedPrice.toFixed(2);
            ltpElement.className = `ltp ${priceChangeClass}`;
        }
        
        const change = data.lastTradedPrice - data.closePrice;
        const changePercent = (change / data.closePrice) * 100;
        const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';
        
        if (changeElement) {
            changeElement.textContent = change.toFixed(2);
            changeElement.className = `change ${changeClass}`;
            changeElement.style.display = this.settings.show_ltp_change ? 'inline' : 'none';
        }
        
        if (changePercentElement) {
            changePercentElement.textContent = `(${changePercent.toFixed(2)}%)`;
            changePercentElement.className = `change-percent ${changeClass}`;
            changePercentElement.style.display = this.settings.show_ltp_change_percent ? 'inline' : 'none';
        }
    },
    
    updateMarketDepth(tokenString, data) {
        const depthDiv = document.getElementById(`depth-${tokenString}`);
        if (!depthDiv) return;
        
        const tbody = depthDiv.querySelector('.depth-data');
        if (!tbody) return;
        
        if (!data.bestBids || !data.bestAsks) return;
        
        tbody.innerHTML = '';
        
        // Ensure we have 5 rows by padding with empty data if necessary
        const bids = data.bestBids.slice(0, 5).concat(Array(5).fill({ qty: '--', numOrders: '--', price: '--' })).slice(0, 5);
        const asks = data.bestAsks.slice(0, 5).concat(Array(5).fill({ qty: '--', numOrders: '--', price: '--' })).slice(0, 5);
        
        for (let i = 0; i < 5; i++) {
            const bid = bids[i];
            const ask = asks[i];
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-2 text-right">${this.formatNumber(bid.qty)}</td>
                <td class="p-2 text-right">${bid.numOrders}</td>
                <td class="p-2 text-right text-green-500 font-medium">${typeof bid.price === 'number' ? bid.price.toFixed(2) : '--'}</td>
                <td class="p-2 text-right text-red-500 font-medium">${typeof ask.price === 'number' ? ask.price.toFixed(2) : '--'}</td>
                <td class="p-2 text-right">${ask.numOrders}</td>
                <td class="p-2 text-right">${this.formatNumber(ask.qty)}</td>
            `;
            tbody.appendChild(row);
        }
    },
    
    updateMarketStats(element, data) {
        this.updateStat(element, 'open', data.openPrice);
        this.updateStat(element, 'high', data.highPrice);
        this.updateStat(element, 'low', data.lowPrice);
        this.updateStat(element, 'close', data.closePrice);
        this.updateStat(element, 'volume', data.volTraded);
        
        if (data.totalBuyQty) {
            this.updateStat(element, 'total-buy-qty', data.totalBuyQty);
        }
        if (data.totalSellQty) {
            this.updateStat(element, 'total-sell-qty', data.totalSellQty);
        }
    },
    
    updateStat(element, statName, value) {
        const statElement = element.querySelector(`.${statName}`);
        if (statElement) {
            statElement.textContent = this.formatValue(value, statName);
        }
    },
    
    formatValue(value, type) {
        switch (type) {
            case 'volume':
                return this.formatVolume(value);
            case 'total-buy-qty':
            case 'total-sell-qty':
                return this.formatNumber(value);
            default:
                return value.toFixed(2);
        }
    },
    
    formatVolume(volume) {
        if (volume >= 10000000) {
            return (volume / 10000000).toFixed(2) + ' Cr';
        } else if (volume >= 100000) {
            return (volume / 100000).toFixed(2) + ' L';
        } else if (volume >= 1000) {
            return (volume / 1000).toFixed(2) + ' K';
        }
        return volume.toString();
    },
    
    formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return '--';
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
