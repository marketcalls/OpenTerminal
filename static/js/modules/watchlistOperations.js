// static/js/modules/watchlistOperations.js

const WatchlistOperations = {
    /**
     * Watchlist CRUD Operations
     */
    async createWatchlist() {
        // Check if max limit reached
        const watchlistCount = document.querySelectorAll('.tab-btn').length;
        if (watchlistCount >= 5) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-error shadow-lg fixed top-4 right-4 w-auto z-50';
            alert.innerHTML = `
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Maximum limit of 5 watchlists reached!</span>
                </div>
            `;
            document.body.appendChild(alert);
            setTimeout(() => alert.remove(), 3000);
            return;
        }

        const name = prompt('Enter watchlist name:');
        if (!name) return;

        try {
            const response = await WatchlistCore.makeRequest('/create_watchlist', {
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
                    const response = await WatchlistCore.makeRequest('/update_watchlist', {
                        method: 'POST',
                        body: JSON.stringify({
                            watchlist_id: watchlistId,
                            name: newName
                        })
                    });

                    if (response.status === 'success') {
                        nameElement.textContent = newName;
                        // Update tab name as well
                        const tab = document.querySelector(`[data-watchlist-id="${watchlistId}"]`);
                        if (tab) {
                            tab.textContent = newName;
                        }
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
        
        // Check if this is the last watchlist
        const watchlistCount = document.querySelectorAll('.tab-btn').length;
        if (watchlistCount <= 1) {
            const alert = document.createElement('div');
            alert.className = 'alert alert-warning shadow-lg fixed top-4 right-4 w-auto z-50';
            alert.innerHTML = `
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <span>Cannot delete the last watchlist!</span>
                </div>
            `;
            document.body.appendChild(alert);
            setTimeout(() => alert.remove(), 3000);
            return;
        }

        try {
            const response = await WatchlistCore.makeRequest('/delete_watchlist', {
                method: 'POST',
                body: JSON.stringify({ watchlist_id: watchlistId })
            });

            if (response.status === 'success') {
                if (WatchlistCore.state.activeSubscriptions.has(watchlistId)) {
                    const tokens = WatchlistCore.state.activeSubscriptions.get(watchlistId);
                    await WatchlistEvents.unsubscribeFromSymbols(tokens);
                    WatchlistCore.state.activeSubscriptions.delete(watchlistId);
                }

                // Remove from DOM immediately
                const tab = document.querySelector(`[data-watchlist-id="${watchlistId}"]`);
                const content = document.getElementById(`watchlist-${watchlistId}`);
                const watchlistRow = document.getElementById(`watchlist-row-${watchlistId}`);
                
                // Remove all elements
                [tab, content, watchlistRow].forEach(el => {
                    if (el) {
                        el.style.opacity = '0';
                        el.style.transition = 'opacity 0.3s ease';
                        setTimeout(() => el.remove(), 300);
                    }
                });

                // Switch to another tab if needed
                if (tab?.classList.contains('tab-active')) {
                    const remainingTab = document.querySelector('.tab-btn');
                    if (remainingTab) {
                        this.switchTab(remainingTab);
                    } else {
                        const watchlistsDiv = document.getElementById('watchlists');
                        if (watchlistsDiv) {
                            watchlistsDiv.innerHTML = WatchlistCore.getTemplate('emptyWatchlist');
                        }
                    }
                }

                // Show success notification
                const alert = document.createElement('div');
                alert.className = 'alert alert-success shadow-lg fixed top-4 right-4 w-auto z-50';
                alert.innerHTML = `
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>Watchlist deleted successfully</span>
                    </div>
                `;
                document.body.appendChild(alert);
                setTimeout(() => alert.remove(), 3000);
            }
        } catch (error) {
            console.error('Error:', error);
            const alert = document.createElement('div');
            alert.className = 'alert alert-error shadow-lg fixed top-4 right-4 w-auto z-50';
            alert.innerHTML = `
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>An error occurred while deleting the watchlist</span>
                </div>
            `;
            document.body.appendChild(alert);
            setTimeout(() => alert.remove(), 3000);
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
            const response = await WatchlistCore.makeRequest('/add_watchlist_item', {
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
        li.setAttribute('data-exch-type', WatchlistCore.getExchTypeCode(symbolData.exch_seg));
        
        li.innerHTML = WatchlistCore.getTemplate('symbolListItem', symbolData) + 
                      WatchlistCore.getTemplate('marketDepth', symbolData);

        symbolList.appendChild(li);

        const newSymbolData = {
            token: symbolData.token,
            exchType: WatchlistCore.getExchTypeCode(symbolData.exch_seg)
        };

        const currentTokens = WatchlistCore.state.activeSubscriptions.get(watchlistId) || [];
        currentTokens.push(newSymbolData);
        WatchlistCore.state.activeSubscriptions.set(watchlistId, currentTokens);

        await WatchlistEvents.subscribeToSymbols([newSymbolData]);
        window.dispatchEvent(new CustomEvent('symbolAdded', { 
            detail: {
                ...symbolData,
                exchType: WatchlistCore.getExchTypeCode(symbolData.exch_seg)
            }
        }));

        // Update scrip count in manage modal
        const watchlistRow = document.getElementById(`watchlist-row-${watchlistId}`);
        if (watchlistRow) {
            const scripCount = watchlistRow.querySelector('.text-xs.text-base-content\\/70');
            if (scripCount) {
                const currentCount = parseInt(scripCount.textContent) || 0;
                scripCount.textContent = `${currentCount + 1} Scrips`;
            }
        }
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
            const response = await WatchlistCore.makeRequest('/remove_watchlist_item', {
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
        const currentTokens = WatchlistCore.state.activeSubscriptions.get(activeWatchlistId) || [];
        
        WatchlistCore.state.activeSubscriptions.set(
            activeWatchlistId,
            currentTokens.filter(t => t.token !== token)
        );

        await WatchlistEvents.unsubscribeFromSymbols([{ token, exchType }]);
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

        // Update scrip count in manage modal
        const watchlistRow = document.getElementById(`watchlist-row-${activeWatchlistId}`);
        if (watchlistRow) {
            const scripCount = watchlistRow.querySelector('.text-xs.text-base-content\\/70');
            if (scripCount) {
                const currentCount = parseInt(scripCount.textContent) || 0;
                scripCount.textContent = `${Math.max(0, currentCount - 1)} Scrips`;
            }
        }
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
            const response = await WatchlistCore.makeRequest('/update_watchlist_settings', {
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
    }
};

// Export for use in other modules
window.WatchlistOperations = WatchlistOperations;
