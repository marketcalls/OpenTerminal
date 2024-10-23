// static/js/modules/marketDataDecoder.js

const MarketDataDecoder = {
    decode(binaryData) {
        const dataView = new DataView(binaryData);
        let offset = 0;

        // Header information
        const subscriptionMode = dataView.getInt8(offset);
        offset += 1;

        const exchangeType = dataView.getInt8(offset);
        offset += 1;

        // Read token (25 bytes)
        const tokenString = this.decodeToken(dataView, offset);
        offset += 25;

        // Read sequence number (8 bytes)
        const sequenceNumber = dataView.getBigInt64(offset, true);
        offset += 8;

        // Read exchange timestamp (8 bytes)
        const exchangeTimestamp = dataView.getBigInt64(offset, true);
        offset += 8;

        // Read last traded price (8 bytes)
        const lastTradedPrice = Number(dataView.getBigInt64(offset, true)) / 100;
        offset += 8;

        // Read last traded quantity (8 bytes)
        const lastTradedQuantity = Number(dataView.getBigInt64(offset, true));
        offset += 8;

        // Read average traded price (8 bytes)
        const averageTradedPrice = Number(dataView.getBigInt64(offset, true)) / 100;
        offset += 8;

        // Read volume traded (8 bytes)
        const volTraded = Number(dataView.getBigInt64(offset, true));
        offset += 8;

        // Read total buy quantity (8 bytes)
        const totalBuyQty = dataView.getFloat64(offset, true);
        offset += 8;

        // Read total sell quantity (8 bytes)
        const totalSellQty = dataView.getFloat64(offset, true);
        offset += 8;

        // Read open price (8 bytes)
        const openPrice = Number(dataView.getBigInt64(offset, true)) / 100;
        offset += 8;

        // Read high price (8 bytes)
        const highPrice = Number(dataView.getBigInt64(offset, true)) / 100;
        offset += 8;

        // Read low price (8 bytes)
        const lowPrice = Number(dataView.getBigInt64(offset, true)) / 100;
        offset += 8;

        // Read close price (8 bytes)
        const closePrice = Number(dataView.getBigInt64(offset, true)) / 100;
        offset += 8;

        if (subscriptionMode === 3) {
            // Skip last traded timestamp, OI, and OI change (24 bytes)
            offset += 24;

            // Read Best Five Data (10 packets)
            const bestFiveData = [];
            for (let i = 0; i < 10; i++) {
                const buySellFlag = dataView.getInt16(offset, true);
                offset += 2;

                const quantity = Number(dataView.getBigInt64(offset, true));
                offset += 8;

                const price = Number(dataView.getBigInt64(offset, true)) / 100;
                offset += 8;

                const orders = dataView.getInt16(offset, true);
                offset += 2;

                bestFiveData.push({ buySellFlag, quantity, price, orders });
            }

            // Filter best five data into buy and sell orders
            const bestBids = bestFiveData.filter(order => order.buySellFlag === 1)
                .slice(0, 5)
                .map(order => ({
                    qty: order.quantity,
                    price: order.price,
                    numOrders: order.orders
                }));

            const bestAsks = bestFiveData.filter(order => order.buySellFlag === 0)
                .slice(0, 5)
                .map(order => ({
                    qty: order.quantity,
                    price: order.price,
                    numOrders: order.orders
                }));

            return {
                subscriptionMode,
                exchangeType,
                tokenString,
                sequenceNumber,
                exchangeTimestamp,
                lastTradedPrice,
                lastTradedQuantity,
                averageTradedPrice,
                volTraded,
                totalBuyQty,
                totalSellQty,
                openPrice,
                highPrice,
                lowPrice,
                closePrice,
                bestBids,
                bestAsks
            };
        }

        return {
            subscriptionMode,
            exchangeType,
            tokenString,
            sequenceNumber,
            exchangeTimestamp,
            lastTradedPrice,
            lastTradedQuantity,
            averageTradedPrice,
            volTraded,
            totalBuyQty,
            totalSellQty,
            openPrice,
            highPrice,
            lowPrice,
            closePrice
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
    }
};

// Export for use in other modules
window.MarketDataDecoder = MarketDataDecoder;
