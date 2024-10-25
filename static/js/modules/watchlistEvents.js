// static/js/modules/watchlistEvents.js

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
    },

    /**
     * Event Listeners
     */
    bindEventListeners() {
        this.bindWatchlistControls();
        this.bindSymbolControls();
        this.bindTabControls();
        this.bindSettingsControls();
    },

    bindWatchlistControls() {
        ['create-watchlist-btn', 'create-new-watchlist-btn'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => WatchlistOperations.createWatchlist());
        });

        document.getElementById('manage-watchlist-btn')?.addEventListener('click', () => {
            document.getElementById('watchlist-modal').showModal();
            WatchlistOperations.loadWatchlistSettings();
        });

        document.querySelectorAll('.edit-watchlist-btn').forEach(btn =>
            btn.addEventListener('click', (e) => WatchlistOperations.editWatchlistName(e)));
        
        document.querySelectorAll('.delete-watchlist-btn').forEach(btn =>
            btn.addEventListener('click', (e) => WatchlistOperations.deleteWatchlist(e)));
    },

    bindSymbolControls() {
        document.querySelectorAll('.remove-item-btn').forEach(btn =>
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await WatchlistOperations.removeSymbol(e);
            }));
    },

    bindTabControls() {
        document.querySelectorAll('.tab-btn').forEach(tab =>
            tab.addEventListener('click', async (e) => {
                const watchlistId = e.target.dataset.watchlistId;
                await WatchlistOperations.switchTab(e.target);
                await this.handleTabActivation(watchlistId);
            }));
    },

    bindSettingsControls() {
        ['show-ltp-change', 'show-ltp-change-percent', 'show-holdings'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => WatchlistOperations.updateSettings());
        });
    }
};

// Export for use in other modules
window.WatchlistEvents = WatchlistEvents;
