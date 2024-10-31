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

    // Initialize settings
    function initializeSettings() {
        const showLtpChange = document.getElementById('show-ltp-change');
        const showLtpChangePercent = document.getElementById('show-ltp-change-percent');
        const showHoldings = document.getElementById('show-holdings');

        // Initialize settings object
        const settings = {
            show_ltp_change: showLtpChange ? showLtpChange.checked : false,
            show_ltp_change_percent: showLtpChangePercent ? showLtpChangePercent.checked : false,
            show_holdings: showHoldings ? showHoldings.checked : false
        };

        // Log initial settings
        console.log('Initializing MarketDataUpdater with settings:', settings);
        MarketDataUpdater.init(settings);

        // Add change event listeners
        [showLtpChange, showLtpChangePercent, showHoldings].forEach(checkbox => {
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                    const newSettings = {
                        show_ltp_change: showLtpChange ? showLtpChange.checked : false,
                        show_ltp_change_percent: showLtpChangePercent ? showLtpChangePercent.checked : false,
                        show_holdings: showHoldings ? showHoldings.checked : false
                    };
                    console.log('Settings updated:', newSettings);
                    MarketDataUpdater.updateSettings(newSettings);
                    
                    // Dispatch event for other components
                    window.dispatchEvent(new CustomEvent('watchlistSettingsUpdated', {
                        detail: newSettings
                    }));
                });
            }
        });

        return settings;
    }

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
                return;
            }
            
            try {
                const decodedData = MarketDataDecoder.decode(event.data);
                
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

        ws.send(JSON.stringify(subscribeMsg));
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
        if (!activeTab) return;

        const watchlistId = activeTab.dataset.watchlistId;
        const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
        if (!watchlistContent) return;

        const symbols = Array.from(watchlistContent.querySelectorAll('[data-token]'));
        if (symbols.length === 0) return;

        const tokens = symbols.map(symbol => ({
            token: symbol.dataset.token,
            exchType: parseInt(symbol.dataset.exchType)
        }));

        handleSubscription(tokens, true);
    }

    function handleSubscription(tokens, subscribe = true) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not ready for subscription');
            return;
        }

        const subscribeMsg = {
            correlationID: "watchlist_" + Date.now(),
            action: subscribe ? 1 : 2,
            params: {
                mode: 3,
                tokenList: groupTokensByExchange(tokens)
            }
        };

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
    
        document.querySelectorAll('.market-depth').forEach(depth => {
            if (depth.id !== `depth-${token}`) {
                depth.classList.add('hidden');
            }
        });
    
        depthElement.classList.toggle('hidden');
        if (!depthElement.classList.contains('hidden')) {
            depthElement.classList.add('animate-expand');
            setTimeout(() => {
                depthElement.classList.remove('animate-expand');
            }, 200);
        }
    }

    // Event Listeners
    window.addEventListener('websocketSubscribe', function(event) {
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
        if (!newSymbolData.token) {
            console.error('Invalid symbol data received');
            return;
        }

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

            currentSubscriptions.add(newSymbolData.token);
            ws.send(JSON.stringify(subscribeMsg));
        }
    });

    window.addEventListener('symbolRemoved', function(event) {
        const { token } = event.detail;
        currentSubscriptions.delete(token);
    });

    // Initialize everything
    const settings = initializeSettings();  // Initialize settings first
    WatchlistManager.init();  // Then initialize WatchlistManager
    initializeWebSocket();    // Finally initialize WebSocket

    // Listen for setting updates
    window.addEventListener('watchlistSettingsUpdated', function(event) {
        MarketDataUpdater.updateSettings(event.detail);
    });
});