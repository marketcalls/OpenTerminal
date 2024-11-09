// Market Indices Module
const MarketIndices = {
    ws: null,
    heartbeatInterval: null,
    currentSubscriptions: new Set(),
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 5000,

    // Index tokens configuration
    INDEX_TOKENS: {
        NIFTY: { token: "99926000", exchType: 1 },  // NSE
        SENSEX: { token: "99919000", exchType: 3 }  // BSE
    },

    async init() {
        this.reconnectAttempts = 0;
        await this.initializeWebSocket();
    },

    async initializeWebSocket() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log("Max reconnection attempts reached. Please refresh the page.");
            return;
        }

        try {
            const response = await fetch('/api/get_tokens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch tokens');
            }
            
            const tokens = await response.json();
            if (!tokens.feed_token || !tokens.api_key || !tokens.client_code) {
                throw new Error('Invalid token data received');
            }

            const { feed_token, api_key, client_code } = tokens;
            const wsUrl = `wss://smartapisocket.angelone.in/smart-stream?clientCode=${client_code}&feedToken=${feed_token}&apiKey=${api_key}`;
            this.setupWebSocket(wsUrl);
        } catch (error) {
            console.error("Error initializing WebSocket:", error);
            this.reconnectAttempts++;
            setTimeout(() => this.initializeWebSocket(), this.reconnectDelay);
        }
    },

    setupWebSocket(wsUrl) {
        try {
            if (this.ws) {
                this.ws.close();
            }

            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.log("WebSocket Connected for Market Indices");
                this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
                this.startHeartbeat();
                this.subscribeToIndices();
            };

            this.ws.onmessage = (event) => {
                if (event.data === 'pong') {
                    return;
                }
                
                try {
                    const decodedData = MarketDataDecoder.decode(event.data);
                    
                    if (decodedData.tokenString === this.INDEX_TOKENS.NIFTY.token) {
                        this.updateNiftyData(decodedData);
                    } else if (decodedData.tokenString === this.INDEX_TOKENS.SENSEX.token) {
                        this.updateSensexData(decodedData);
                    }
                } catch (error) {
                    console.error("Error processing message:", error);
                }
            };

            this.ws.onerror = (error) => {
                console.error("WebSocket error:", error);
            };

            this.ws.onclose = () => {
                console.log("WebSocket disconnected. Attempting to reconnect...");
                this.cleanup();
                this.reconnectAttempts++;
                setTimeout(() => this.initializeWebSocket(), this.reconnectDelay);
            };
        } catch (error) {
            console.error("Error setting up WebSocket:", error);
            this.reconnectAttempts++;
            setTimeout(() => this.initializeWebSocket(), this.reconnectDelay);
        }
    },

    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.currentSubscriptions.clear();
    },

    startHeartbeat() {
        this.cleanup(); // Clear any existing interval
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    this.ws.send('ping');
                } catch (error) {
                    console.error("Error sending heartbeat:", error);
                    this.cleanup();
                    this.initializeWebSocket();
                }
            }
        }, 30000);
    },

    subscribeToIndices() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not ready for index subscription');
            return;
        }

        try {
            const subscribeMsg = {
                correlationID: "indices_" + Date.now(),
                action: 1,
                params: {
                    mode: 3,
                    tokenList: [
                        {
                            exchangeType: this.INDEX_TOKENS.NIFTY.exchType,
                            tokens: [this.INDEX_TOKENS.NIFTY.token]
                        },
                        {
                            exchangeType: this.INDEX_TOKENS.SENSEX.exchType,
                            tokens: [this.INDEX_TOKENS.SENSEX.token]
                        }
                    ]
                }
            };

            this.ws.send(JSON.stringify(subscribeMsg));
            this.currentSubscriptions.add(this.INDEX_TOKENS.NIFTY.token);
            this.currentSubscriptions.add(this.INDEX_TOKENS.SENSEX.token);
        } catch (error) {
            console.error("Error subscribing to indices:", error);
            this.cleanup();
            this.initializeWebSocket();
        }
    },

    updateNiftyData(data) {
        const value = data.lastTradedPrice.toFixed(2);
        const change = (data.lastTradedPrice - data.closePrice).toFixed(2);
        const changePercent = ((change / data.closePrice) * 100).toFixed(2);
        const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';

        const valueElement = document.getElementById('nifty-value');
        const changeElement = document.getElementById('nifty-change');
        
        if (valueElement && changeElement) {
            valueElement.textContent = value;
            changeElement.textContent = `${change} (${changePercent}%)`;
            changeElement.className = changeClass;
        }
    },

    updateSensexData(data) {
        const value = data.lastTradedPrice.toFixed(2);
        const change = (data.lastTradedPrice - data.closePrice).toFixed(2);
        const changePercent = ((change / data.closePrice) * 100).toFixed(2);
        const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';

        const valueElement = document.getElementById('sensex-value');
        const changeElement = document.getElementById('sensex-change');
        
        if (valueElement && changeElement) {
            valueElement.textContent = value;
            changeElement.textContent = `${change} (${changePercent}%)`;
            changeElement.className = changeClass;
        }
    }
};

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if the user is logged in (check for the presence of market indices elements)
    if (document.getElementById('nifty-value') && document.getElementById('sensex-value')) {
        MarketIndices.init();
    }
});

// Export for use in other modules
window.MarketIndices = MarketIndices;
