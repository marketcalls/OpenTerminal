// modules/websocket.js
const WebSocketManager = {
    ws: null,
    activeWatchlistItems: new Map(),

    async initialize() {
        try {
            const tokens = await this.fetchTokens();
            const wsUrl = this.buildWebSocketUrl(tokens);
            this.ws = this.createConnection(wsUrl);
        } catch (error) {
            console.error("WebSocket initialization failed:", error);
        }
    },

    async fetchTokens() {
        const response = await fetch('/api/get_tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            }
        });
        return response.json();
    },

    buildWebSocketUrl({ client_code, feed_token, api_key }) {
        return `wss://smartapisocket.angelone.in/smart-stream?clientCode=${client_code}&feedToken=${feed_token}&apiKey=${api_key}`;
    },

    createConnection(wsUrl) {
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = () => {
            console.log("WebSocket connected");
            this.startHeartbeat();
            this.subscribeToWatchlistItems();
        };

        ws.onmessage = (event) => {
            if (event.data === 'pong') return;
            const decodedData = MarketDataDecoder.decode(event.data);
            MarketDataUpdater.updateData(decodedData);
        };

        ws.onerror = (error) => console.error("WebSocket error:", error);

        ws.onclose = () => {
            console.log("WebSocket closed. Attempting to reconnect...");
            setTimeout(() => this.initialize(), 5000);
        };

        return ws;
    },

    startHeartbeat() {
        setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send('ping');
            }
        }, 30000);
    },

    subscribeToWatchlistItems() {
        const exchangeTokens = this.collectWatchlistTokens();
        const subscribeMsg = this.createSubscriptionMessage(exchangeTokens);

        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(subscribeMsg));
        }
    },

    collectWatchlistTokens() {
        const exchangeTokens = new Map();
        document.querySelectorAll('[data-token]').forEach(item => {
            const token = item.dataset.token;
            const exchType = parseInt(item.dataset.exchType);
            
            if (!exchangeTokens.has(exchType)) {
                exchangeTokens.set(exchType, []);
            }
            exchangeTokens.get(exchType).push(token);
            this.activeWatchlistItems.set(token, item.id);
        });
        return exchangeTokens;
    },

    createSubscriptionMessage(exchangeTokens) {
        return {
            correlationID: "watchlist_" + Date.now(),
            action: 1,
            params: {
                mode: 3,
                tokenList: Array.from(exchangeTokens).map(([exchangeType, tokens]) => ({
                    exchangeType,
                    tokens
                }))
            }
        };
    }
};

// modules/marketDataDecoder.js
const MarketDataDecoder = {
    decode(binaryData) {
        const dataView = new DataView(binaryData);
        let offset = 0;

        // Header information
        const decoded = {
            subscriptionMode: dataView.getInt8(offset++),
            exchangeType: dataView.getInt8(offset++),
            tokenString: this.decodeToken(dataView, offset)
        };
        offset += 25;

        // Skip sequence number and exchange timestamp
        offset += 16;

        // Trading data
        Object.assign(decoded, this.decodeTradingData(dataView, offset));
        offset += 64;

        // Market depth data if in snap quote mode
        if (decoded.subscriptionMode === 3) {
            offset += 24; // Skip last traded timestamp, OI, and OI change
            Object.assign(decoded, this.decodeMarketDepth(dataView, offset));
        }

        return decoded;
    },

    decodeToken(dataView, offset) {
        const token = [];
        for (let i = 0; i < 25; i++) {
            const charCode = dataView.getInt8(offset + i);
            if (charCode !== 0) token.push(String.fromCharCode(charCode));
        }
        return token.join('');
    },

    decodeTradingData(dataView, offset) {
        return {
            lastTradedPrice: Number(dataView.getBigInt64(offset, true)) / 100,
            lastTradedQty: Number(dataView.getBigInt64(offset + 8, true)),
            avgTradedPrice: Number(dataView.getBigInt64(offset + 16, true)) / 100,
            volTraded: Number(dataView.getBigInt64(offset + 24, true)),
            totalBuyQty: dataView.getFloat64(offset + 32, true),
            totalSellQty: dataView.getFloat64(offset + 40, true),
            openPrice: Number(dataView.getBigInt64(offset + 48, true)) / 100,
            highPrice: Number(dataView.getBigInt64(offset + 56, true)) / 100,
            lowPrice: Number(dataView.getBigInt64(offset + 64, true)) / 100,
            closePrice: Number(dataView.getBigInt64(offset + 72, true)) / 100
        };
    },

    decodeMarketDepth(dataView, offset) {
        const bestBids = [];
        const bestAsks = [];

        for (let i = 0; i < 10; i++) {
            const entry = {
                qty: Number(dataView.getBigInt64(offset + 2, true)),
                price: Number(dataView.getBigInt64(offset + 10, true)) / 100,
                numOrders: dataView.getInt16(offset + 18, true)
            };

            if (dataView.getInt16(offset, true) === 1) {
                bestBids.push(entry);
            } else {
                bestAsks.push(entry);
            }
            offset += 20;
        }

        return { bestBids, bestAsks };
    }
};

// modules/marketDataUpdater.js
const MarketDataUpdater = {
    updateData(data) {
        const itemId = WebSocketManager.activeWatchlistItems.get(data.tokenString);
        if (!itemId) return;

        const item = document.getElementById(itemId);
        if (!item) return;

        this.updatePriceDisplay(item, data);
        this.updateMarketDepth(itemId, data);
    },

    updatePriceDisplay(item, data) {
        this.updateElement(item, '.ltp', data.lastTradedPrice.toFixed(2));

        const change = data.lastTradedPrice - data.closePrice;
        const changePercent = (change / data.closePrice) * 100;
        const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';

        this.updateElement(item, '.change', change.toFixed(2), changeClass);
        this.updateElement(item, '.change-percent', 
            `${changePercent.toFixed(2)}%`, changeClass);
    },

    updateMarketDepth(itemId, data) {
        const depthTable = document.getElementById(`depth-${itemId}`);
        if (!depthTable || !data.bestBids || !data.bestAsks) return;

        const tbody = depthTable.querySelector('tbody');
        tbody.innerHTML = Array(5).fill(0).map((_, i) => {
            const bid = data.bestBids[i] || { qty: '--', price: '--', numOrders: '--' };
            const ask = data.bestAsks[i] || { qty: '--', price: '--', numOrders: '--' };
            return `
                <tr>
                    <td class="p-2">${bid.qty}</td>
                    <td class="p-2">${bid.numOrders}</td>
                    <td class="p-2 text-green-500">${bid.price}</td>
                    <td class="p-2 text-red-500">${ask.price}</td>
                    <td class="p-2">${ask.numOrders}</td>
                    <td class="p-2">${ask.qty}</td>
                </tr>
            `;
        }).join('');
    },

    updateElement(parent, selector, value, className = '') {
        const element = parent.querySelector(selector);
        if (element) {
            element.textContent = value;
            if (className) element.className = `${selector.slice(1)} ${className}`;
        }
    }
};

// modules/watchlistManager.js
const WatchlistManager = {
    init() {
        this.bindEventListeners();
        this.initializeTabBehavior();
    },

    bindEventListeners() {
        // Add event listeners for watchlist management
        document.getElementById('create-watchlist-btn')?.addEventListener('click', 
            () => this.createNewWatchlist());
        
        document.querySelectorAll('.edit-watchlist-btn').forEach(btn => 
            btn.addEventListener('click', (e) => this.editWatchlistName(e)));
        
        document.querySelectorAll('.delete-watchlist-btn').forEach(btn => 
            btn.addEventListener('click', (e) => this.deleteWatchlist(e)));
        
        this.initializeSearch();
    },

    initializeTabBehavior() {
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab));
        });
    },

    // ... Rest of your existing watchlist management code ...
};

// dashboard.js (main file)
document.addEventListener('DOMContentLoaded', function() {
    // Initialize all modules
    WebSocketManager.initialize();
    WatchlistManager.init();
});