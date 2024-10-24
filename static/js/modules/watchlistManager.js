// static/js/modules/watchlistManager.js

const WatchlistManager = {
    init() {
        this.csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        this.searchTimeout = null;
        this.bindEventListeners();
        this.initializeSearch();
    },

    bindEventListeners() {
        // Watchlist Creation
        document.getElementById('create-watchlist-btn')?.addEventListener('click', () => this.createWatchlist());
        document.getElementById('create-new-watchlist-btn')?.addEventListener('click', () => this.createWatchlist());
        
        // Watchlist Modal
        document.getElementById('manage-watchlist-btn')?.addEventListener('click', () => {
            document.getElementById('watchlist-modal').showModal();
            this.loadWatchlistSettings();
        });

        // Settings Changes
        ['show-ltp-change', 'show-ltp-change-percent', 'show-holdings'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.updateSettings());
        });

        // Watchlist Edit/Delete
        document.querySelectorAll('.edit-watchlist-btn').forEach(btn =>
            btn.addEventListener('click', (e) => this.editWatchlistName(e)));
        
        document.querySelectorAll('.delete-watchlist-btn').forEach(btn =>
            btn.addEventListener('click', (e) => this.deleteWatchlist(e)));

        // Tab Switching
        document.querySelectorAll('.tab-btn').forEach(tab =>
            tab.addEventListener('click', () => this.switchTab(tab)));

        // Symbol Removal
        document.querySelectorAll('.remove-item-btn').forEach(btn =>
            btn.addEventListener('click', (e) => this.removeSymbol(e)));
    },

    initializeSearch() {
        const searchInput = document.getElementById('search-symbol-input');
        const searchResults = document.getElementById('search-results');

        searchInput?.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            const query = e.target.value.trim();

            if (query.length >= 2) {
                this.searchTimeout = setTimeout(() => this.performSearch(query), 300);
            } else {
                searchResults.innerHTML = '';
            }
        });

        // Hide search results when clicking outside
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
            } else {
                console.error('Error creating watchlist:', response.message);
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
                    } else {
                        console.error('Error updating watchlist name:', response.message);
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
        const watchlistId = event.currentTarget.dataset.watchlistId;
        if (!confirm('Are you sure you want to delete this watchlist?')) return;

        try {
            const response = await this.makeRequest('/delete_watchlist', {
                method: 'POST',
                body: JSON.stringify({ watchlist_id: watchlistId })
            });

            if (response.status === 'success') {
                location.reload();
            } else {
                console.error('Error deleting watchlist:', response.message);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    },

    async addSymbolToWatchlist(symbol, exchSeg) {
        const activeWatchlist = document.querySelector('.tab-active');
        if (!activeWatchlist) return;

        const watchlistId = activeWatchlist.dataset.watchlistId;

        try {
            const response = await this.makeRequest('/add_watchlist_item', {
                method: 'POST',
                body: JSON.stringify({
                    watchlist_id: watchlistId,
                    symbol: symbol,
                    exch_seg: exchSeg
                })
            });

            if (response.status === 'success') {
                // Clear search
                document.getElementById('search-results').innerHTML = '';
                document.getElementById('search-symbol-input').value = '';

                // Get the current watchlist content container
                const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
                const symbolList = watchlistContent.querySelector('ul');

                // Create new symbol element
                const newSymbolItem = this.createSymbolListItem(response.data);
                symbolList.appendChild(newSymbolItem);

                // Remove "no items" message if it exists
                const noItemsMessage = symbolList.querySelector('.no-items-message');
                if (noItemsMessage) {
                    noItemsMessage.remove();
                }

                // Initialize market data for new symbol
                window.dispatchEvent(new CustomEvent('symbolAdded', { 
                    detail: response.data 
                }));

                // Maintain active tab
                const activeTab = document.querySelector('.tab-active');
                if (activeTab) {
                    this.switchTab(activeTab, false); // false means don't reload page
                }
            } else {
                console.error('Error adding symbol:', response.message);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    },

    createSymbolListItem(symbolData) {
        const li = document.createElement('li');
        li.className = 'watchlist-item bg-base-100 rounded-lg overflow-hidden';
        li.id = `item-${symbolData.token}`;
        li.setAttribute('data-token', symbolData.token);
        li.setAttribute('data-exch-type', this.getExchTypeCode(symbolData.exch_seg));
        
        li.innerHTML = `
            <div class="flex justify-between items-center p-3 hover:bg-base-200 cursor-pointer"
                 onclick="toggleDepth('depth-${symbolData.token}')">
                <div class="flex flex-col">
                    <span class="font-medium">${symbolData.symbol}</span>
                    <span class="text-xs text-base-content/70">${symbolData.exch_seg}</span>
                </div>
                <div class="flex items-center gap-4">
                    <div class="text-right">
                        <div class="font-medium ltp">--</div>
                        <div class="flex items-center gap-1 text-xs">
                            <span class="change">0.00</span>
                            <span class="change-percent">(0.00%)</span>
                        </div>
                    </div>
                    <button class="btn btn-ghost btn-xs remove-item-btn" 
                            data-item-id="${symbolData.id}"
                            onclick="event.stopPropagation(); WatchlistManager.removeSymbol(event)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
            <!-- Market Depth Section -->
            <div id="depth-${symbolData.token}" class="hidden border-t border-base-200">
                <div class="p-3 space-y-2">
                    <!-- Market Stats -->
                    <div class="grid grid-cols-4 gap-2 text-xs border-b border-base-200 pb-2">
                        <div>O: <span class="open">--</span></div>
                        <div>H: <span class="high">--</span></div>
                        <div>L: <span class="low">--</span></div>
                        <div>C: <span class="close">--</span></div>
                    </div>
                    <!-- Depth Table -->
                    <table class="w-full text-xs">
                        <thead class="text-base-content/70">
                            <tr>
                                <th class="py-1 text-right">Qty</th>
                                <th class="py-1 text-right">Orders</th>
                                <th class="py-1 text-right text-green-500">Bid</th>
                                <th class="py-1 text-right text-red-500">Ask</th>
                                <th class="py-1 text-right">Orders</th>
                                <th class="py-1 text-right">Qty</th>
                            </tr>
                        </thead>
                        <tbody class="depth-data">
                            <!-- Depth data will be injected here -->
                        </tbody>
                    </table>
                    <!-- Volume and Buy/Sell Quantities -->
                    <div class="flex justify-between text-xs text-base-content/70 pt-2 border-t border-base-200">
                        <div>Vol: <span class="volume">--</span></div>
                        <div>
                            Buy: <span class="total-buy-qty">--</span> | 
                            Sell: <span class="total-sell-qty">--</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return li;
    },

    getExchTypeCode(exchSeg) {
        const exchMap = {
            'NSE': 1,     // nse_cm
            'NFO': 2,     // nse_fo
            'BSE': 3,     // bse_cm
            'BFO': 4,     // bse_fo
            'MCX': 5,     // mcx_fo
            'NCX': 7,     // ncx_fo
            'CDS': 13     // cde_fo
        };
        return exchMap[exchSeg] || 1;
    },

    switchTab(tab, reload = false) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(t => {
            t.classList.remove('tab-active');
        });
        
        // Hide all watchlist contents
        document.querySelectorAll('.watchlist-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        // Add active class to clicked tab
        tab.classList.add('tab-active');
        
        // Show corresponding watchlist content
        const watchlistId = tab.dataset.watchlistId;
        const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
        if (watchlistContent) {
            watchlistContent.classList.remove('hidden');
        }

        // Only reload if explicitly requested
        if (reload) {
            location.reload();
        }
    },
    
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
                // Dispatch a custom event with the new settings
                window.dispatchEvent(new CustomEvent('watchlistSettingsUpdated', { detail: settings }));
            }
        } catch (error) {
            console.error('Error updating settings:', error);
        }
    },

    async makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.csrfToken
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });
        return response.json();
    },

    updateDisplaySettings(settings) {
        document.querySelectorAll('.ltp-change').forEach(el => 
            el.classList.toggle('hidden', !settings.show_ltp_change));
        document.querySelectorAll('.ltp-change-percent').forEach(el => 
            el.classList.toggle('hidden', !settings.show_ltp_change_percent));
        document.querySelectorAll('.holdings').forEach(el => 
            el.classList.toggle('hidden', !settings.show_holdings));
    }
};

// Export for use in other modules
window.WatchlistManager = WatchlistManager;
