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
                alert(response.message || 'Error creating watchlist');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to create watchlist');
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
                        location.reload();
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Failed to update watchlist name');
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
                alert(response.message || 'Error deleting watchlist');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to delete watchlist');
        }
    },

    async addSymbolToWatchlist(symbol, exchSeg) {
        const activeWatchlist = document.querySelector('.tab-active');
        if (!activeWatchlist) return;

        try {
            const response = await this.makeRequest('/add_watchlist_item', {
                method: 'POST',
                body: JSON.stringify({
                    watchlist_id: activeWatchlist.dataset.watchlistId,
                    symbol: symbol,
                    exch_seg: exchSeg
                })
            });

            if (response.status === 'success') {
                location.reload();
            } else {
                alert(response.message || 'Error adding symbol to watchlist');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to add symbol to watchlist');
        }
    },

    async removeSymbol(event) {
        const itemId = event.currentTarget.dataset.itemId;
        if (!confirm('Remove this symbol from watchlist?')) return;

        try {
            const response = await this.makeRequest('/remove_watchlist_item', {
                method: 'POST',
                body: JSON.stringify({ item_id: itemId })
            });

            if (response.status === 'success') {
                event.currentTarget.closest('li').remove();
            } else {
                alert(response.message || 'Error removing symbol from watchlist');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to remove symbol from watchlist');
        }
    },

    switchTab(tab) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('tab-active'));
        
        // Hide all watchlist contents
        document.querySelectorAll('.watchlist-content').forEach(content => content.classList.add('hidden'));
        
        // Add active class to clicked tab
        tab.classList.add('tab-active');
        
        // Show corresponding watchlist content
        const watchlistId = tab.dataset.watchlistId;
        const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
        if (watchlistContent) {
            watchlistContent.classList.remove('hidden');
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
