const WatchlistEvents = {
    /**
     * WebSocket Subscription Management
     */
    async handleTabActivation(newWatchlistId) {
        try {
            await this.unsubscribeFromOtherWatchlists(newWatchlistId);
            await this.subscribeToActiveWatchlist(newWatchlistId);
        } catch (error) {
            console.error('Error during tab activation:', error);
        }
    },

    async unsubscribeFromOtherWatchlists(activeWatchlistId) {
        for (const [watchlistId, tokens] of WatchlistCore.state.activeSubscriptions.entries()) {
            if (watchlistId !== activeWatchlistId) {
                await this.unsubscribeFromSymbols(tokens);
                WatchlistCore.state.activeSubscriptions.delete(watchlistId);
            }
        }
    },

    async subscribeToActiveWatchlist(watchlistId) {
        const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
        if (!watchlistContent) return;

        const symbols = Array.from(watchlistContent.querySelectorAll('[data-token]'));
        const tokens = symbols.map(symbol => ({
            token: symbol.dataset.token,
            exchType: parseInt(symbol.dataset.exchType)
        }));

        if (tokens.length > 0) {
            await this.subscribeToSymbols(tokens);
            WatchlistCore.state.activeSubscriptions.set(watchlistId, tokens);
        }
    },

    async subscribeToSymbols(tokens) {
        const subscribeMsg = {
            correlationID: "watchlist_" + Date.now(),
            action: 1,
            params: {
                mode: 3,
                tokenList: this.groupTokensByExchange(tokens)
            }
        };
        window.dispatchEvent(new CustomEvent('websocketSubscribe', { detail: subscribeMsg }));
    },

    async unsubscribeFromSymbols(tokens) {
        const unsubscribeMsg = {
            correlationID: "watchlist_" + Date.now(),
            action: 2,
            params: {
                mode: 3,
                tokenList: this.groupTokensByExchange(tokens)
            }
        };
        window.dispatchEvent(new CustomEvent('websocketUnsubscribe', { detail: unsubscribeMsg }));
    },

    groupTokensByExchange(tokens) {
        const exchangeTypes = {
            'NSE': 1,
            'BSE': 3,
            'NFO': 2,
            'BFO': 4,
            'MCX': 5,
            'CDS': 13,
            'NCDEX': 7
        };
        
        const exchangeTokens = new Map();
        tokens.forEach(({token, exchType}) => {
            const mappedType = exchangeTypes[exchType] || exchType;
            if (!exchangeTokens.has(mappedType)) {
                exchangeTokens.set(mappedType, []);
            }
            exchangeTokens.get(mappedType).push(token);
        });
        
        return Array.from(exchangeTokens).map(([exchangeType, tokens]) => ({
            exchangeType,
            tokens
        }));
    },

    /**
     * Event Listeners
     */
    bindEventListeners() {
        this.bindWatchlistControls();
        this.bindSymbolControls();
        this.bindTabControls();
        this.bindSettingsControls();
        this.bindOrderControls();  // New addition
        this.bindMarketDepthControls();  // New addition
    },

    /**
     * Watchlist Controls
     */
    bindWatchlistControls() {
        ['create-watchlist-btn', 'create-new-watchlist-btn'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => {
                WatchlistOperations.createWatchlist();
            });
        });

        document.getElementById('manage-watchlist-btn')?.addEventListener('click', () => {
            document.getElementById('watchlist-modal').showModal();
            WatchlistOperations.loadWatchlistSettings();
        });

        document.querySelectorAll('.edit-watchlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => WatchlistOperations.editWatchlistName(e));
        });

        document.querySelectorAll('.delete-watchlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => WatchlistOperations.deleteWatchlist(e));
        });
    },

    /**
     * Symbol Controls
     */
    bindSymbolControls() {
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await WatchlistOperations.removeSymbol(e);
            });
        });

        // Add hover effect for showing order buttons
        document.querySelectorAll('.watchlist-item').forEach(item => {
            item.addEventListener('mouseenter', function() {
                this.querySelector('.order-buttons')?.classList.remove('hidden');
            });
            
            item.addEventListener('mouseleave', function() {
                this.querySelector('.order-buttons')?.classList.add('hidden');
            });
        });
    },

    /**
     * Tab Controls
     */
    bindTabControls() {
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', async (e) => {
                const watchlistId = e.target.dataset.watchlistId;
                await WatchlistOperations.switchTab(e.target);
                await this.handleTabActivation(watchlistId);
            });
        });
    },

    /**
     * Settings Controls
     */
    bindSettingsControls() {
        ['show-ltp-change', 'show-ltp-change-percent', 'show-holdings'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                WatchlistOperations.updateSettings();
            });
        });
    },

    /**
     * Order Controls - New Addition
     */
    bindOrderControls() {
        // Buy button clicks
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.watchlist-item');
                if (item) {
                    const symbolData = this.getSymbolData(item);
                    OrderModal.show(symbolData, 'BUY');
                }
            });
        });

        // Sell button clicks
        document.querySelectorAll('.sell-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.watchlist-item');
                if (item) {
                    const symbolData = this.getSymbolData(item);
                    OrderModal.show(symbolData, 'SELL');
                }
            });
        });
    },

    /**
     * Market Depth Controls - New Addition
     */
    bindMarketDepthControls() {
        // Market depth toggle
        document.querySelectorAll('.symbol-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (!e.target.closest('.order-buttons') && !e.target.closest('.remove-item-btn')) {
                    const item = header.closest('.watchlist-item');
                    if (item) {
                        const token = item.dataset.token;
                        toggleDepth(token);
                    }
                }
            });
        });

        // Market depth price clicks
        document.querySelectorAll('.depth-price').forEach(price => {
            price.addEventListener('click', (e) => {
                e.stopPropagation();
                const priceValue = parseFloat(e.target.textContent);
                if (!isNaN(priceValue)) {
                    const item = e.target.closest('.watchlist-item');
                    if (item) {
                        const symbolData = this.getSymbolData(item);
                        const isBuyPrice = e.target.classList.contains('bid-price');
                        OrderModal.show(symbolData, isBuyPrice ? 'BUY' : 'SELL', priceValue);
                    }
                }
            });
        });
    },

    /**
     * Helper Methods - New Addition
     */
    getSymbolData(item) {
        return {
            symbol: item.dataset.symbol,
            token: item.dataset.token,
            exchange: item.dataset.exchSeg,
            lotSize: parseInt(item.dataset.lotSize) || 1,
            tickSize: parseFloat(item.dataset.tickSize) || 0.05,
            instrumentType: item.dataset.instrumentType,
            ltp: parseFloat(item.querySelector('.ltp')?.textContent) || 0
        };
    },

    /**
     * Error Handling
     */
    handleError(error, context) {
        console.error(`Error in ${context}:`, error);
        // You can add more error handling logic here, like showing a toast notification
        if (typeof showToast === 'function') {
            showToast('error', `Error: ${error.message || 'Something went wrong'}`);
        }
    }
};

// Export for use in other modules
window.WatchlistEvents = WatchlistEvents;