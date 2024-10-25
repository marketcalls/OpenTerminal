// static/js/modules/watchlistManager.js

const WatchlistManager = {
    /**
     * Core state and template cache
     */
    state: {
        csrfToken: null,
        searchTimeout: null,
        activeSubscriptions: new Map(),
        templates: new Map()
    },

    /**
     * Initialize the watchlist manager
     */
    init() {
        this.state.csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        this.loadTemplates();
        this.bindEventListeners();
        this.initializeSearch();
        this.initializeTabManagement();
    },

    /**
     * Template Management
     */
    async loadTemplates() {
        const templateFiles = [
            'symbolListItem',
            'marketDepth',
            'emptyWatchlist'
        ];

        for (const name of templateFiles) {
            try {
                const response = await fetch(`/static/js/modules/templates/${name}.html`);
                const template = await response.text();
                this.state.templates.set(name, template);
            } catch (error) {
                console.error(`Error loading template ${name}:`, error);
            }
        }
    },

    getTemplate(name, data = {}) {
        let template = this.state.templates.get(name) || '';
        return template.replace(/\${(\w+)}/g, (_, key) => data[key] || '');
    },

    initializeTabManagement() {
        const activeTab = document.querySelector('.tab-active');
        if (activeTab) {
            this.handleTabActivation(activeTab.dataset.watchlistId);
        }
    },

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
        for (const [watchlistId, tokens] of this.state.activeSubscriptions.entries()) {
            if (watchlistId !== activeWatchlistId) {
                await this.unsubscribeFromSymbols(tokens);
                this.state.activeSubscriptions.delete(watchlistId);
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
            this.state.activeSubscriptions.set(watchlistId, tokens);
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
            document.getElementById(id)?.addEventListener('click', () => this.createWatchlist());
        });

        document.getElementById('manage-watchlist-btn')?.addEventListener('click', () => {
            document.getElementById('watchlist-modal').showModal();
            this.loadWatchlistSettings();
        });

        document.querySelectorAll('.edit-watchlist-btn').forEach(btn =>
            btn.addEventListener('click', (e) => this.editWatchlistName(e)));
        
        document.querySelectorAll('.delete-watchlist-btn').forEach(btn =>
            btn.addEventListener('click', (e) => this.deleteWatchlist(e)));
    },

    bindSymbolControls() {
        document.querySelectorAll('.remove-item-btn').forEach(btn =>
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.removeSymbol(e);
            }));
    },

    bindTabControls() {
        document.querySelectorAll('.tab-btn').forEach(tab =>
            tab.addEventListener('click', async (e) => {
                const watchlistId = e.target.dataset.watchlistId;
                await this.switchTab(e.target);
                await this.handleTabActivation(watchlistId);
            }));
    },

    bindSettingsControls() {
        ['show-ltp-change', 'show-ltp-change-percent', 'show-holdings'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.updateSettings());
        });
    },

    /**
     * Symbol Search Management
     */
    initializeSearch() {
        const searchInput = document.getElementById('search-symbol-input');
        const searchResults = document.getElementById('search-results');

        searchInput?.addEventListener('input', (e) => {
            clearTimeout(this.state.searchTimeout);
            const query = e.target.value.trim();

            if (query.length >= 2) {
                this.state.searchTimeout = setTimeout(() => this.performSearch(query), 300);
            } else {
                searchResults.innerHTML = '';
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-symbol-input') && !e.target.closest('#search-results')) {
                searchResults.innerHTML = '';
                searchInput.value = '';
            }
        });
    },

    async performSearch(query) {
        try {
            const response = await fetch(`/search_symbols?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            this.displaySearchResults(data.results);
        } catch (error) {
            console.error('Error searching symbols:', error);
        }
    },

    displaySearchResults(results) {
        const searchResults = document.getElementById('search-results');
        searchResults.innerHTML = results.map(result => `
            <li class="p-2 hover:bg-base-200 cursor-pointer flex justify-between items-center"
                onclick="WatchlistManager.addSymbolToWatchlist('${result.symbol}', '${result.exch_seg}')">
                <div>
                    <div class="font-medium">${result.symbol}</div>
                    <div class="text-xs text-base-content/70">${result.exch_seg}</div>
                </div>
            </li>
        `).join('');
    },

    /**
     * Watchlist CRUD Operations
     */
    async createWatchlist() {
        const name = prompt('Enter watchlist name:');
        if (!name) return;

        try {
            const response = await this.makeRequest('/create_watchlist', {
                method: 'POST',
                body: JSON.stringify({ name })
            });

            if (response.status === 'success') {
                location.reload();
            }
        } catch (error) {
            console.error('Error:', error);
        }
    },

    async editWatchlistName(event) {
        const watchlistId = event.currentTarget.dataset.watchlistId;
        const watchlistRow = event.currentTarget.closest('[id^="watchlist-row-"]');
        const nameElement = watchlistRow.querySelector('.watchlist-name');
        const currentName = nameElement.textContent.trim();

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'input input-bordered input-sm w-40';

        const saveEdit = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                try {
                    const response = await this.makeRequest('/update_watchlist', {
                        method: 'POST',
                        body: JSON.stringify({
                            watchlist_id: watchlistId,
                            name: newName
                        })
                    });

                    if (response.status === 'success') {
                        nameElement.textContent = newName;
                    }
                } catch (error) {
                    console.error('Error:', error);
                }
            }
            input.replaceWith(nameElement);
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') input.replaceWith(nameElement);
        });

        nameElement.replaceWith(input);
        input.focus();
    },

    async deleteWatchlist(event) {
        event.preventDefault();
        const watchlistId = event.currentTarget.dataset.watchlistId;
        
        if (!confirm('Are you sure you want to delete this watchlist?')) return;

        try {
            const response = await this.makeRequest('/delete_watchlist', {
                method: 'POST',
                body: JSON.stringify({ watchlist_id: watchlistId })
            });

            if (response.status === 'success') {
                if (this.state.activeSubscriptions.has(watchlistId)) {
                    const tokens = this.state.activeSubscriptions.get(watchlistId);
                    await this.unsubscribeFromSymbols(tokens);
                    this.state.activeSubscriptions.delete(watchlistId);
                }

                this.removeWatchlistFromDOM(watchlistId);
                document.getElementById('watchlist-modal')?.close();
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while deleting the watchlist.');
        }
    },

    removeWatchlistFromDOM(watchlistId) {
        const tab = document.querySelector(`[data-watchlist-id="${watchlistId}"]`);
        const content = document.getElementById(`watchlist-${watchlistId}`);
        const watchlistRow = document.getElementById(`watchlist-row-${watchlistId}`);
        
        [tab, content, watchlistRow].forEach(el => el?.remove());

        if (tab?.classList.contains('tab-active')) {
            const remainingTab = document.querySelector('.tab-btn');
            if (remainingTab) {
                this.switchTab(remainingTab);
            } else {
                const watchlistsDiv = document.getElementById('watchlists');
                if (watchlistsDiv) {
                    watchlistsDiv.innerHTML = this.getTemplate('emptyWatchlist');
                }
            }
        }
    },

    /**
     * Symbol Management
     */
    async addSymbolToWatchlist(symbol, exchSeg) {
        const activeWatchlist = document.querySelector('.tab-active');
        if (!activeWatchlist) return;

        const watchlistId = activeWatchlist.dataset.watchlistId;

        try {
            const response = await this.makeRequest('/add_watchlist_item', {
                method: 'POST',
                body: JSON.stringify({
                    watchlist_id: watchlistId,
                    symbol,
                    exch_seg: exchSeg
                })
            });

            if (response.status === 'success') {
                this.clearSearch();
                await this.addSymbolToDOM(response.data, watchlistId);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    },

    clearSearch() {
        document.getElementById('search-results').innerHTML = '';
        document.getElementById('search-symbol-input').value = '';
    },

    async addSymbolToDOM(symbolData, watchlistId) {
        const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
        const symbolList = watchlistContent.querySelector('ul');

        if (!symbolList.querySelector('.watchlist-item')) {
            symbolList.innerHTML = '';
        }

        const li = document.createElement('li');
        li.className = 'watchlist-item bg-base-100 rounded-lg overflow-hidden shadow-sm';
        li.id = `item-${symbolData.token}`;
        li.setAttribute('data-token', symbolData.token);
        li.setAttribute('data-exch-type', this.getExchTypeCode(symbolData.exch_seg));
        
        li.innerHTML = this.getTemplate('symbolListItem', symbolData) + 
                      this.getTemplate('marketDepth', symbolData);

        symbolList.appendChild(li);

        const newSymbolData = {
            token: symbolData.token,
            exchType: this.getExchTypeCode(symbolData.exch_seg)
        };

        const currentTokens = this.state.activeSubscriptions.get(watchlistId) || [];
        currentTokens.push(newSymbolData);
        this.state.activeSubscriptions.set(watchlistId, currentTokens);

        await this.subscribeToSymbols([newSymbolData]);
        window.dispatchEvent(new CustomEvent('symbolAdded', { 
            detail: {
                ...symbolData,
                exchType: this.getExchTypeCode(symbolData.exch_seg)
            }
        }));
    },

    async removeSymbol(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const itemId = event.currentTarget.dataset.itemId;
        const watchlistItem = event.currentTarget.closest('.watchlist-item');
        if (!watchlistItem) return;
        
        const token = watchlistItem.dataset.token;
        const exchType = parseInt(watchlistItem.dataset.exchType);

        try {
            const response = await this.makeRequest('/remove_watchlist_item', {
                method: 'POST',
                body: JSON.stringify({ item_id: itemId })
            });

            if (response.status === 'success') {
                await this.removeSymbolFromDOM(token, exchType, watchlistItem);
            }
        } catch (error) {
            console.error('Error removing symbol:', error);
        }
    },

    async removeSymbolFromDOM(token, exchType, watchlistItem) {
        const activeWatchlistId = document.querySelector('.tab-active').dataset.watchlistId;
        const currentTokens = this.state.activeSubscriptions.get(activeWatchlistId) || [];
        
        this.state.activeSubscriptions.set(
            activeWatchlistId,
            currentTokens.filter(t => t.token !== token)
        );

        await this.unsubscribeFromSymbols([{ token, exchType }]);
        watchlistItem.remove();

        const watchlistContent = document.querySelector('.watchlist-content:not(.hidden)');
        if (watchlistContent && !watchlistContent.querySelector('.watchlist-item')) {
            watchlistContent.innerHTML = `
                <div class="text-center text-base-content/70 py-4">
                    No items in this watchlist
                </div>
            `;
        }

        window.dispatchEvent(new CustomEvent('symbolRemoved', { 
            detail: { token, exchType } 
        }));
    },

    /**
     * UI Management
     */
    switchTab(tab, reload = false) {
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('tab-active'));
        document.querySelectorAll('.watchlist-content').forEach(content => content.classList.add('hidden'));
        
        tab.classList.add('tab-active');
        
        const watchlistId = tab.dataset.watchlistId;
        const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
        if (watchlistContent) {
            watchlistContent.classList.remove('hidden');
        }

        if (reload) location.reload();
    },

    /**
     * Settings Management
     */
    async updateSettings() {
        const settings = {
            show_ltp_change: document.getElementById('show-ltp-change').checked,
            show_ltp_change_percent: document.getElementById('show-ltp-change-percent').checked,
            show_holdings: document.getElementById('show-holdings').checked
        };

        try {
            const response = await this.makeRequest('/update_watchlist_settings', {
                method: 'POST',
                body: JSON.stringify(settings)
            });

            if (response.status === 'success') {
                this.updateDisplaySettings(settings);
                window.dispatchEvent(new CustomEvent('watchlistSettingsUpdated', { detail: settings }));
            }
        } catch (error) {
            console.error('Error updating settings:', error);
        }
    },

    updateDisplaySettings(settings) {
        document.querySelectorAll('.ltp-change').forEach(el => 
            el.classList.toggle('hidden', !settings.show_ltp_change));
        document.querySelectorAll('.ltp-change-percent').forEach(el => 
            el.classList.toggle('hidden', !settings.show_ltp_change_percent));
        document.querySelectorAll('.holdings').forEach(el => 
            el.classList.toggle('hidden', !settings.show_holdings));
    },

    /**
     * Utility Functions
     */
    async makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.state.csrfToken
            }
        };
        const response = await fetch(url, { ...defaultOptions, ...options });
        return response.json();
    },

    getExchTypeCode(exchSeg) {
        const exchMap = {
            'NSE': 1, 'NFO': 2, 'BSE': 3, 'BFO': 4,
            'MCX': 5, 'NCX': 7, 'CDS': 13
        };
        return exchMap[exchSeg] || 1;
    }
};

// Export for use in other modules
window.WatchlistManager = WatchlistManager;
