// static/js/modules/marketDataUpdater.js

const MarketDataUpdater = {
    // Map to cache previous values for comparison
    previousValues: new Map(),

    updateData(decodedData) {
        const { tokenString } = decodedData;
        const watchlistItem = document.querySelector(`[data-token="${tokenString}"]`);
        
        if (!watchlistItem) return;
        
        this.updatePriceInfo(watchlistItem, decodedData);
        this.updateMarketDepth(watchlistItem, decodedData);
        this.updateMarketStats(watchlistItem, decodedData);
        
        // Cache the current values
        this.previousValues.set(tokenString, {
            ltp: decodedData.lastTradedPrice,
            close: decodedData.closePrice
        });
    },
    
    updatePriceInfo(element, data) {
        const ltpElement = element.querySelector('.ltp');
        const changeElement = element.querySelector('.change');
        const changePercentElement = element.querySelector('.change-percent');
        
        if (ltpElement) {
            const previousValue = this.previousValues.get(data.tokenString)?.ltp;
            const priceChangeClass = this.getPriceChangeClass(data.lastTradedPrice, previousValue);
            
            ltpElement.textContent = data.lastTradedPrice.toFixed(2);
            ltpElement.className = `ltp ${priceChangeClass}`;
        }
        
        if (changeElement && changePercentElement) {
            const change = data.lastTradedPrice - data.closePrice;
            const changePercent = (change / data.closePrice) * 100;
            
            const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';
            
            changeElement.textContent = change.toFixed(2);
            changeElement.className = `change ${changeClass}`;
            
            changePercentElement.textContent = `${changePercent.toFixed(2)}%`;
            changePercentElement.className = `change-percent ${changeClass}`;
        }
    },
    
    updateMarketDepth(element, data) {
        const depthTableId = `depth-${element.id}`;
        const depthTable = document.getElementById(depthTableId);
        
        if (!depthTable || !data.buyOrders || !data.sellOrders) return;
        
        const tbody = depthTable.querySelector('tbody');
        tbody.innerHTML = '';
        
        const maxDepth = Math.max(data.buyOrders.length, data.sellOrders.length);
        
        for (let i = 0; i < maxDepth; i++) {
            const buyOrder = data.buyOrders[i] || { quantity: '--', price: '--', numOrders: '--' };
            const sellOrder = data.sellOrders[i] || { quantity: '--', price: '--', numOrders: '--' };
            
            const row = this.createDepthRow(buyOrder, sellOrder);
            tbody.insertAdjacentHTML('beforeend', row);
        }
    },
    
    createDepthRow(buyOrder, sellOrder) {
        return `
            <tr>
                <td class="p-2 text-right">${buyOrder.quantity}</td>
                <td class="p-2 text-right">${buyOrder.numOrders}</td>
                <td class="p-2 text-right text-green-500 font-medium">${buyOrder.price}</td>
                <td class="p-2 text-right text-red-500 font-medium">${sellOrder.price}</td>
                <td class="p-2 text-right">${sellOrder.numOrders}</td>
                <td class="p-2 text-right">${sellOrder.quantity}</td>
            </tr>
        `;
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
                return this.formatQuantity(value);
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
    
    formatQuantity(qty) {
        return qty.toLocaleString();
    },
    
    getPriceChangeClass(currentPrice, previousPrice) {
        if (!previousPrice) return '';
        return currentPrice > previousPrice ? 'text-green-500' : 
               currentPrice < previousPrice ? 'text-red-500' : '';
    }
};

// Export for use in other modules
window.MarketDataUpdater = MarketDataUpdater;