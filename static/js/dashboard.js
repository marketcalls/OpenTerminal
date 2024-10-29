// static/js/dashboard.js

document.addEventListener('DOMContentLoaded', function() {
    let ws;
    let heartbeatInterval;
    let currentSubscriptions = new Set();

    // Add index tokens
    const INDEX_TOKENS = {
        NIFTY: { token: "99926000", exchType: 1 },  // NSE
        SENSEX: { token: "99919000", exchType: 3 }  // BSE
    };

    async function fetchTokens() {
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
            
            const data = await response.json();
            console.log('Tokens fetched successfully:', data);
            return data;
        } catch (error) {
            console.error('Error fetching tokens:', error);
            throw error;
        }
    }

    function initializeWebSocket() {
        fetchTokens().then(tokens => {
            const { feed_token, api_key, client_code } = tokens;
            const wsUrl = `wss://smartapisocket.angelone.in/smart-stream?clientCode=${client_code}&feedToken=${feed_token}&apiKey=${api_key}`;
            setupWebSocket(wsUrl);
        }).catch(error => {
            console.error("Error initializing WebSocket:", error);
            setTimeout(initializeWebSocket, 5000);
        });
    }

    function setupWebSocket(wsUrl) {
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = function() {
            console.log("WebSocket Connected");
            startHeartbeat();
            subscribeToIndices();
            subscribeActiveWatchlist();
        };

        ws.onmessage = function(event) {
            if (event.data === 'pong') {
                console.log('Heartbeat received');
                return;
            }
            
            try {
                const decodedData = MarketDataDecoder.decode(event.data);
                console.log('Received data for token:', decodedData.tokenString);
                
                if (decodedData.tokenString === INDEX_TOKENS.NIFTY.token) {
                    updateNiftyData(decodedData);
                } else if (decodedData.tokenString === INDEX_TOKENS.SENSEX.token) {
                    updateSensexData(decodedData);
                } else if (currentSubscriptions.has(decodedData.tokenString)) {
                    MarketDataUpdater.updateData(decodedData);
                }
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
            currentSubscriptions.clear();
            setTimeout(initializeWebSocket, 5000);
        };
    }

    function startHeartbeat() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
                console.log('Heartbeat sent');
            }
        }, 30000);
    }

    function subscribeToIndices() {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not ready for index subscription');
            return;
        }

        const subscribeMsg = {
            correlationID: "indices_" + Date.now(),
            action: 1,
            params: {
                mode: 3,
                tokenList: [
                    {
                        exchangeType: INDEX_TOKENS.NIFTY.exchType,
                        tokens: [INDEX_TOKENS.NIFTY.token]
                    },
                    {
                        exchangeType: INDEX_TOKENS.SENSEX.exchType,
                        tokens: [INDEX_TOKENS.SENSEX.token]
                    }
                ]
            }
        };

        console.log('Subscribing to indices:', subscribeMsg);
        ws.send(JSON.stringify(subscribeMsg));
        
        // Add to current subscriptions
        currentSubscriptions.add(INDEX_TOKENS.NIFTY.token);
        currentSubscriptions.add(INDEX_TOKENS.SENSEX.token);
    }

    function updateNiftyData(data) {
        const value = data.lastTradedPrice.toFixed(2);
        const change = (data.lastTradedPrice - data.closePrice).toFixed(2);
        const changePercent = ((change / data.closePrice) * 100).toFixed(2);
        const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';

        document.getElementById('nifty-value').textContent = value;
        const changeElement = document.getElementById('nifty-change');
        changeElement.textContent = `${change} (${changePercent}%)`;
        changeElement.className = changeClass;
    }

    function updateSensexData(data) {
        const value = data.lastTradedPrice.toFixed(2);
        const change = (data.lastTradedPrice - data.closePrice).toFixed(2);
        const changePercent = ((change / data.closePrice) * 100).toFixed(2);
        const changeClass = change >= 0 ? 'text-green-500' : 'text-red-500';

        document.getElementById('sensex-value').textContent = value;
        const changeElement = document.getElementById('sensex-change');
        changeElement.textContent = `${change} (${changePercent}%)`;
        changeElement.className = changeClass;
    }

    function subscribeActiveWatchlist() {
        const activeTab = document.querySelector('.tab-active');
        if (!activeTab) {
            console.log('No active tab found');
            return;
        }

        const watchlistId = activeTab.dataset.watchlistId;
        const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
        if (!watchlistContent) {
            console.log('No watchlist content found for ID:', watchlistId);
            return;
        }

        const symbols = Array.from(watchlistContent.querySelectorAll('[data-token]'));
        console.log('Found symbols:', symbols.length);
        
        if (symbols.length === 0) return;

        const tokens = symbols.map(symbol => ({
            token: symbol.dataset.token,
            exchType: parseInt(symbol.dataset.exchType)
        }));

        console.log('Subscribing to tokens:', tokens);
        handleSubscription(tokens, true);
    }

    function handleSubscription(tokens, subscribe = true) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not ready for subscription');
            return;
        }

        const action = subscribe ? 1 : 2;
        const subscribeMsg = {
            correlationID: "watchlist_" + Date.now(),
            action: action,
            params: {
                mode: 3,
                tokenList: groupTokensByExchange(tokens)
            }
        };

        console.log(`${subscribe ? 'Subscribing to' : 'Unsubscribing from'} tokens:`, tokens);
        ws.send(JSON.stringify(subscribeMsg));

        tokens.forEach(({token}) => {
            if (subscribe) {
                currentSubscriptions.add(token);
            } else {
                currentSubscriptions.delete(token);
            }
        });
    }

    function groupTokensByExchange(tokens) {
        const exchangeTokens = new Map();
        tokens.forEach(({token, exchType}) => {
            if (!exchangeTokens.has(exchType)) {
                exchangeTokens.set(exchType, []);
            }
            exchangeTokens.get(exchType).push(token);
        });

        return Array.from(exchangeTokens).map(([exchangeType, tokens]) => ({
            exchangeType,
            tokens
        }));
    }

    function toggleDepth(token) {
        const depthElement = document.getElementById(`depth-${token}`);
        if (!depthElement) return;
    
        // Close all other depth views first
        document.querySelectorAll('.market-depth').forEach(depth => {
            if (depth.id !== `depth-${token}`) {
                depth.classList.add('hidden');
            }
        });
    
        // Toggle current depth with animation
        depthElement.classList.toggle('hidden');
        if (!depthElement.classList.contains('hidden')) {
            depthElement.classList.add('animate-expand');
            // Remove animation class after animation completes
            setTimeout(() => {
                depthElement.classList.remove('animate-expand');
            }, 200);
        }
    }

    // Event listeners for subscription management
    window.addEventListener('websocketSubscribe', function(event) {
        console.log('Received subscribe event:', event.detail);
        if (ws && ws.readyState === WebSocket.OPEN) {
            const tokens = event.detail.params.tokenList.flatMap(
                item => item.tokens.map(token => ({
                    token,
                    exchType: item.exchangeType
                }))
            );
            handleSubscription(tokens, true);
        }
    });

    window.addEventListener('websocketUnsubscribe', function(event) {
        console.log('Received unsubscribe event:', event.detail);
        if (ws && ws.readyState === WebSocket.OPEN) {
            const tokens = event.detail.params.tokenList.flatMap(
                item => item.tokens.map(token => ({
                    token,
                    exchType: item.exchangeType
                }))
            );
            handleSubscription(tokens, false);
        }
    });

    window.addEventListener('symbolAdded', function(event) {
        const newSymbolData = event.detail;
        console.log('New symbol added event received:', newSymbolData);

        if (!newSymbolData.token) {
            console.error('Invalid symbol data received');
            return;
        }

        currentSubscriptions.add(newSymbolData.token);
        console.log('Added to current subscriptions:', newSymbolData.token);

        if (ws && ws.readyState === WebSocket.OPEN) {
            const subscribeMsg = {
                correlationID: "symbol_add_" + Date.now(),
                action: 1,
                params: {
                    mode: 3,
                    tokenList: [{
                        exchangeType: newSymbolData.exchType,
                        tokens: [newSymbolData.token]
                    }]
                }
            };

            console.log('Sending subscription message for new symbol:', subscribeMsg);
            ws.send(JSON.stringify(subscribeMsg));
        } else {
            console.error('WebSocket not ready for new symbol subscription');
        }
    });

    window.addEventListener('symbolRemoved', function(event) {
        const { token } = event.detail;
        currentSubscriptions.delete(token);
        console.log('Removed subscription after symbol removal:', token);
    });

    // Initialize modules with settings
    const watchlistSettings = {
        show_ltp_change: document.getElementById('show-ltp-change')?.checked || false,
        show_ltp_change_percent: document.getElementById('show-ltp-change-percent')?.checked || false,
        show_holdings: document.getElementById('show-holdings')?.checked || false
    };

    WatchlistManager.init();
    MarketDataUpdater.init(watchlistSettings);
    initializeWebSocket();

    window.addEventListener('watchlistSettingsUpdated', function(event) {
        const newSettings = event.detail;
        MarketDataUpdater.updateSettings(newSettings);
    });
});
