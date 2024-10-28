// static/js/modules/orderEntry/services/priceService.js
var PriceService = (function() {
    var subscribers = new Map();
    var websocket = null;
    var reconnectAttempts = 0;
    var maxReconnectAttempts = 5;
    var reconnectDelay = 1000;

    function init(wsUrl) {
        connectWebSocket(wsUrl);
    }

    function connectWebSocket(wsUrl) {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            return;
        }

        websocket = new WebSocket(wsUrl);
        websocket.binaryType = 'arraybuffer';

        websocket.onopen = function() {
            console.log('WebSocket connected');
            reconnectAttempts = 0;
            subscribeAll();
        };

        websocket.onmessage = function(event) {
            handleMessage(event.data);
        };

        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
        };

        websocket.onclose = function() {
            handleDisconnect();
        };
    }

    function handleDisconnect() {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(function() {
                connectWebSocket();
            }, reconnectDelay * reconnectAttempts);
        }
    }

    function handleMessage(data) {
        try {
            // Assuming you have a market data decoder
            var decodedData = MarketDataDecoder.decode(data);
            notifySubscribers(decodedData);
        } catch (error) {
            console.error('Error processing market data:', error);
        }
    }

    function subscribeSymbol(token, exchange, callback) {
        var key = getSubscriptionKey(token, exchange);
        subscribers.set(key, callback);

        if (websocket && websocket.readyState === WebSocket.OPEN) {
            sendSubscription(token, exchange);
        }
    }

    function unsubscribeSymbol(token, exchange) {
        var key = getSubscriptionKey(token, exchange);
        subscribers.delete(key);

        if (websocket && websocket.readyState === WebSocket.OPEN) {
            sendUnsubscription(token, exchange);
        }
    }

    function sendSubscription(token, exchange) {
        var message = {
            action: 1, // Subscribe
            params: {
                mode: 3,
                tokenList: [{
                    exchangeType: getExchangeType(exchange),
                    tokens: [token]
                }]
            }
        };
        websocket.send(JSON.stringify(message));
    }

    function sendUnsubscription(token, exchange) {
        var message = {
            action: 2, // Unsubscribe
            params: {
                mode: 3,
                tokenList: [{
                    exchangeType: getExchangeType(exchange),
                    tokens: [token]
                }]
            }
        };
        websocket.send(JSON.stringify(message));
    }

    function notifySubscribers(data) {
        var key = getSubscriptionKey(data.token, data.exchange);
        var callback = subscribers.get(key);
        if (callback) {
            callback(data);
        }
    }

    function getSubscriptionKey(token, exchange) {
        return exchange + ':' + token;
    }

    function getExchangeType(exchange) {
        var exchangeTypes = {
            'NSE': 1,
            'BSE': 3,
            'NFO': 2,
            'MCX': 5,
            'CDS': 7
        };
        return exchangeTypes[exchange] || 1;
    }

    return {
        init: init,
        subscribeSymbol: subscribeSymbol,
        unsubscribeSymbol: unsubscribeSymbol
    };
})();