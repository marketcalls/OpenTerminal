document.addEventListener('DOMContentLoaded', function() {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    const watchlistModal = document.getElementById('watchlist-modal');
    let searchTimeout = null;

    // Initialize indices update
    function updateIndices() {
        fetch('/get_indices')
            .then(response => response.json())
            .then(data => {
                const niftyElement = document.getElementById('nifty-value');
                const sensexElement = document.getElementById('sensex-value');
                
                if (niftyElement && data.nifty) {
                    niftyElement.textContent = data.nifty;
                }
                if (sensexElement && data.sensex) {
                    sensexElement.textContent = data.sensex;
                }
            })
            .catch(error => console.error('Error fetching indices:', error));
    }

    // Update indices every 100 second
    updateIndices();
    setInterval(updateIndices, 100000);

    // Watchlist Management Modal
    document.getElementById('manage-watchlist-btn')?.addEventListener('click', function() {
        watchlistModal.showModal();
        loadWatchlistSettings();
    });

    // Create New Watchlist
    document.getElementById('create-watchlist-btn')?.addEventListener('click', function() {
        const name = prompt('Enter watchlist name:');
        if (name) {
            createNewWatchlist(name);
        }
    });

    document.getElementById('create-new-watchlist-btn')?.addEventListener('click', function() {
        const name = prompt('Enter watchlist name:');
        if (name) {
            createNewWatchlist(name);
        }
    });

    function createNewWatchlist(name) {
        fetch('/create_watchlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({name: name})
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                location.reload();
            } else {
                alert(data.message || 'Error creating watchlist');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to create watchlist');
        });
    }

    // Edit Watchlist Name
    document.querySelectorAll('.edit-watchlist-btn').forEach(button => {
        button.addEventListener('click', function() {
            const watchlistId = this.dataset.watchlistId;
            const watchlistRow = this.closest('[id^="watchlist-row-"]');
            const nameElement = watchlistRow.querySelector('.watchlist-name');
            const currentName = nameElement.textContent.trim();

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'input input-bordered input-sm w-40';

            nameElement.replaceWith(input);
            input.focus();

            function handleUpdate() {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    updateWatchlistName(watchlistId, newName, nameElement);
                }
                input.replaceWith(nameElement);
            }

            input.addEventListener('blur', handleUpdate);
            input.addEventListener('keyup', function(e) {
                if (e.key === 'Enter') handleUpdate();
                if (e.key === 'Escape') input.replaceWith(nameElement);
            });
        });
    });

    function updateWatchlistName(watchlistId, newName, nameElement) {
        fetch('/update_watchlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                watchlist_id: watchlistId,
                name: newName
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                nameElement.textContent = newName;
                document.querySelector(`[data-watchlist-id="${watchlistId}"]`).textContent = newName;
            } else {
                alert(data.message || 'Error updating watchlist name');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to update watchlist name');
        });
    }

    // Delete Watchlist
    document.querySelectorAll('.delete-watchlist-btn').forEach(button => {
        button.addEventListener('click', function() {
            const watchlistId = this.dataset.watchlistId;
            if (confirm('Are you sure you want to delete this watchlist?')) {
                deleteWatchlist(watchlistId);
            }
        });
    });

    function deleteWatchlist(watchlistId) {
        fetch('/delete_watchlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({watchlist_id: watchlistId})
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                location.reload();
            } else {
                alert(data.message || 'Error deleting watchlist');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to delete watchlist');
        });
    }

    // Watchlist Settings
    function loadWatchlistSettings() {
        fetch('/get_watchlist_settings')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    const settings = data.settings;
                    document.getElementById('show-ltp-change').checked = settings.show_ltp_change;
                    document.getElementById('show-ltp-change-percent').checked = settings.show_ltp_change_percent;
                    document.getElementById('show-holdings').checked = settings.show_holdings;
                    updateDisplaySettings(settings);
                }
            })
            .catch(error => console.error('Error loading settings:', error));
    }

    function updateDisplaySettings(settings) {
        document.querySelectorAll('.ltp-change').forEach(el => {
            el.classList.toggle('hidden', !settings.show_ltp_change);
        });
        document.querySelectorAll('.ltp-change-percent').forEach(el => {
            el.classList.toggle('hidden', !settings.show_ltp_change_percent);
        });
        document.querySelectorAll('.holdings').forEach(el => {
            el.classList.toggle('hidden', !settings.show_holdings);
        });
    }

    // Settings Change Handlers
    ['show-ltp-change', 'show-ltp-change-percent', 'show-holdings'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', function() {
            const settings = {
                show_ltp_change: document.getElementById('show-ltp-change').checked,
                show_ltp_change_percent: document.getElementById('show-ltp-change-percent').checked,
                show_holdings: document.getElementById('show-holdings').checked
            };

            fetch('/update_watchlist_settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(settings)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    updateDisplaySettings(settings);
                }
            })
            .catch(error => console.error('Error updating settings:', error));
        });
    });

    // Symbol Search
    const searchInput = document.getElementById('search-symbol-input');
    const searchResults = document.getElementById('search-results');

    searchInput?.addEventListener('input', function() {
        const query = this.value.trim();
        
        clearTimeout(searchTimeout);
        
        if (query.length >= 2) {
            searchTimeout = setTimeout(() => {
                fetch(`/search_symbols?q=${encodeURIComponent(query)}`)
                    .then(response => response.json())
                    .then(data => {
                        searchResults.innerHTML = '';
                        data.results.forEach(result => {
                            const li = document.createElement('li');
                            li.className = 'p-2 hover:bg-base-200 cursor-pointer flex justify-between items-center';
                            li.innerHTML = `
                                <div>
                                    <div class="font-medium">${result.symbol}</div>
                                    <div class="text-xs text-base-content/70">${result.exch_seg}</div>  <!-- Changed from result.name to result.exch_seg -->
                                </div>
                                <div class="text-xs text-base-content/70"></div>
                            `;
                            li.addEventListener('click', () => {
                                const activeWatchlist = document.querySelector('.tab-active');
                                if (activeWatchlist) {
                                    addSymbolToWatchlist(activeWatchlist.dataset.watchlistId, result);
                                }
                            });
                            searchResults.appendChild(li);
                        });
                    })
                    .catch(error => console.error('Error searching symbols:', error));
            }, 300);
        } else {
            searchResults.innerHTML = '';
        }
    });

    // Add Symbol to Watchlist
    function addSymbolToWatchlist(watchlistId, symbol) {
        fetch('/add_watchlist_item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                watchlist_id: watchlistId,
                symbol: symbol.symbol,
                exch_seg: symbol.exch_seg
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                location.reload();
            } else {
                alert(data.message || 'Error adding symbol to watchlist');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to add symbol to watchlist');
        });
    }

    // Remove Symbol from Watchlist
    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.addEventListener('click', function() {
            const itemId = this.dataset.itemId;
            if (confirm('Remove this symbol from watchlist?')) {
                removeSymbolFromWatchlist(itemId, this);
            }
        });
    });

    function removeSymbolFromWatchlist(itemId, buttonElement) {
        fetch('/remove_watchlist_item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({item_id: itemId})
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                buttonElement.closest('li').remove();
            } else {
                alert(data.message || 'Error removing symbol from watchlist');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to remove symbol from watchlist');
        });
    }

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            document.querySelectorAll('.tab-btn').forEach(t => {
                t.classList.remove('tab-active');
            });
            
            // Hide all watchlist contents
            document.querySelectorAll('.watchlist-content').forEach(content => {
                content.classList.add('hidden');
            });
            
            // Add active class to clicked tab
            this.classList.add('tab-active');
            
            // Show corresponding watchlist content
            const watchlistId = this.dataset.watchlistId;
            const watchlistContent = document.getElementById(`watchlist-${watchlistId}`);
            if (watchlistContent) {
                watchlistContent.classList.remove('hidden');
            }
        });
    });

    // Hide search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#search-symbol-input') && !e.target.closest('#search-results')) {
            searchResults.innerHTML = '';
            searchInput.value = '';
        }
    });
});