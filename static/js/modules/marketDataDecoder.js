// static/js/modules/marketDataDecoder.js

console.log("MarketDataDecoder.js is loaded");

const MarketDataDecoder = {
    // Main decode function for binary messages
    decode(binaryData) {
        const dataView = new DataView(binaryData);
        let offset = 0;
        
        const subscriptionMode = dataView.getInt8(offset);
        offset += 1;
        
        const exchangeType = dataView.getInt8(offset);
        offset += 1;
        
        // Decode token (25 bytes)
        const tokenString = this.decodeToken(dataView, offset);
        offset += 25;
        
        // Read sequence number (8 bytes)
        const sequenceNumber = dataView.getBigInt64(offset, true);
        offset += 8;
        
        // Read exchange timestamp (8 bytes)
        const exchangeTimestamp = dataView.getBigInt64(offset, true);
        offset += 8;
        
        // Decode LTP mode data
        const ltpData = this.decodeLTPData(dataView, offset);
        offset += 8;

        if (subscriptionMode === 1) { // LTP mode
            return {
                subscriptionMode,
                exchangeType,
                tokenString,
                sequenceNumber,
                exchangeTimestamp,
                ...ltpData
            };
        }
        
        // Decode Quote mode data
        const quoteData = this.decodeQuoteData(dataView, offset);
        offset += 64;

        if (subscriptionMode === 2) { // Quote mode
            return {
                subscriptionMode,
                exchangeType,
                tokenString,
                sequenceNumber,
                exchangeTimestamp,
                ...ltpData,
                ...quoteData
            };
        }
        
        // Decode Snap Quote mode data (includes market depth)
        const snapQuoteData = this.decodeSnapQuoteData(dataView, offset);
        
        return {
            subscriptionMode,
            exchangeType,
            tokenString,
            sequenceNumber,
            exchangeTimestamp,
            ...ltpData,
            ...quoteData,
            ...snapQuoteData
        };
    },
    
    decodeToken(dataView, offset) {
        const token = [];
        for (let i = 0; i < 25; i++) {
            const charCode = dataView.getInt8(offset + i);
            if (charCode !== 0) {
                token.push(String.fromCharCode(charCode));
            }
        }
        return token.join('');
    },
    
    decodeLTPData(dataView, offset) {
        return {
            lastTradedPrice: Number(dataView.getBigInt64(offset, true)) / 100
        };
    },
    
    decodeQuoteData(dataView, offset) {
        return {
            lastTradedQty: Number(dataView.getBigInt64(offset, true)),
            avgTradedPrice: Number(dataView.getBigInt64(offset + 8, true)) / 100,
            volTraded: Number(dataView.getBigInt64(offset + 16, true)),
            totalBuyQty: dataView.getFloat64(offset + 24, true),
            totalSellQty: dataView.getFloat64(offset + 32, true),
            openPrice: Number(dataView.getBigInt64(offset + 40, true)) / 100,
            highPrice: Number(dataView.getBigInt64(offset + 48, true)) / 100,
            lowPrice: Number(dataView.getBigInt64(offset + 56, true)) / 100,
            closePrice: Number(dataView.getBigInt64(offset + 64, true)) / 100
        };
    },
    
    decodeSnapQuoteData(dataView, offset) {
        // Skip last traded timestamp, OI, and OI change %
        offset += 24;
        
        const bestFiveData = this.decodeBestFiveData(dataView, offset);
        offset += 200;
        
        return {
            ...bestFiveData,
            upperCircuitLimit: Number(dataView.getBigInt64(offset, true)) / 100,
            lowerCircuitLimit: Number(dataView.getBigInt64(offset + 8, true)) / 100,
            fiftyTwoWeekHigh: Number(dataView.getBigInt64(offset + 16, true)) / 100,
            fiftyTwoWeekLow: Number(dataView.getBigInt64(offset + 24, true)) / 100
        };
    },
    
    decodeBestFiveData(dataView, offset) {
        const buyOrders = [];
        const sellOrders = [];
        
        // Read 10 packets (5 buy + 5 sell)
        for (let i = 0; i < 10; i++) {
            const buySellFlag = dataView.getInt16(offset, true);
            const quantity = Number(dataView.getBigInt64(offset + 2, true));
            const price = Number(dataView.getBigInt64(offset + 10, true)) / 100;
            const numOrders = dataView.getInt16(offset + 18, true);
            
            const order = { quantity, price, numOrders };
            if (buySellFlag === 1) {
                buyOrders.push(order);
            } else {
                sellOrders.push(order);
            }
            
            
            offset += 20;
        }
        
        return { buyOrders, sellOrders };
    }
};

// Export for use in other modules
window.MarketDataDecoder = MarketDataDecoder;