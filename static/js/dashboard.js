// static/js/dashboard.js

document.addEventListener('DOMContentLoaded', function() {
    // Initialize WebSocket
    let ws;
    let heartbeatInterval;

    function initializeWebSocket() {
        fetchTokens().then(tokens => {
            const { auth_token, feed_token, client_code, api_key } = tokens;
            const wsUrl = `wss://smartapisocket.angelone.in/smart-stream?clientCode=${client_code}&feedToken=${feed_token}&apiKey=${api_key}`;
            setupWebSocket(wsUrl);
        }).catch(error => {
            console.error("Error initializing WebSocket:", error);
            // Retry after 5 seconds
            setTimeout(initializeWebSocket, 5000);
        });
    }

    function setupWebSocket(wsUrl) {
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = function() {
            console.log("WebSocket Connected");
            startHeartbeat();
            subscribeToWatchlistItems();
        };

        ws.onmessage = function(event) {
            if (event.data === 'pong') return;
            
            try {
                const decodedData = MarketDataDecoder.decode(event.data);
                MarketDataUpdater.updateData(decodedData);
            } catch (error) {
                console.error("Error processing message:", error);
            }
        };

        ws.onerror = function(error) {
            console.error("WebSocket error:", error);
        };

        ws.onclose = function() {
            console.log("WebSocket disconnected. Attempting to reconnect...");
            clearInterval(heartbeatInterval);
            setTimeout(initializeWebSocket, 5000);
        };
    }

    function startHeartbeat() {
        // Clear any existing heartbeat
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        
        // Send heartbeat every 30 seconds
        heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
            }
        }, 30000);
    }

    function subscribeToWatchlistItems() {
        const watchlistItems = document.querySelectorAll('[data-token]');
        const exchangeTokens = new Map();

        // Group tokens by exchange
        watchlistItems.forEach(item => {
            const token = item.dataset.token;
            const exchType = parseInt(item.dataset.exchType);
            
            if (!exchangeTokens.has(exchType)) {
                exchangeTokens.set(exchType, []);
            }
            exchangeTokens.get(exchType).push(token);
        });

        // Create subscription message
        const subscribeMsg = {
            correlationID: "watchlist_" + Date.now(),
            action: 1,
            params: {
                mode: 3, // Snap Quote mode
                tokenList: Array.from(exchangeTokens).map(([exchangeType, tokens]) => ({
                    exchangeType,
                    tokens
                }))
            }
        };

        // Send subscription request
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(subscribeMsg));
        }
    }

    async function fetchTokens() {
        const response = await fetch('/api/get_tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch tokens');
        }
        
        return response.json();
    }

    // Initialize modules
    const watchlistSettings = {
        show_ltp_change: document.getElementById('show-ltp-change').checked,
        show_ltp_change_percent: document.getElementById('show-ltp-change-percent').checked,
        show_holdings: document.getElementById('show-holdings').checked
    };

    WatchlistManager.init();
    MarketDataUpdater.init(watchlistSettings);
    initializeWebSocket();

    // Listen for watchlist settings updates
    window.addEventListener('watchlistSettingsUpdated', function(event) {
        const newSettings = event.detail;
        MarketDataUpdater.updateSettings(newSettings);
    });

    // Update indices periodically
    function updateIndices() {
        fetch('/get_indices')
            .then(response => response.json())
            .then(data => {
                if (data.nifty) {
                    document.getElementById('nifty-value').textContent = data.nifty.value;
                    document.getElementById('nifty-change').textContent = `${data.nifty.change} ${data.nifty.change_percent}`;
                }
                if (data.sensex) {
                    document.getElementById('sensex-value').textContent = data.sensex.value;
                    document.getElementById('sensex-change').textContent = `${data.sensex.change} ${data.sensex.change_percent}`;
                }
            })
            .catch(error => console.error('Error updating indices:', error));
    }

    // Update indices every minute
    updateIndices();
    setInterval(updateIndices, 60000);
});
