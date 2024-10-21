document.addEventListener('DOMContentLoaded', function() {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    // Handle create watchlist
    document.getElementById('create-watchlist-btn').addEventListener('click', function() {
        let watchlistName = prompt('Enter watchlist name:');
        if (watchlistName) {
            fetch('/create_watchlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({name: watchlistName})
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    location.reload();
                } else {
                    alert(data.message);
                }
            });
        }
    });

    // Handle remove watchlist
    document.querySelectorAll('.remove-watchlist-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            let watchlistId = this.dataset.watchlistId;
            if (confirm('Are you sure you want to delete this watchlist?')) {
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
                        alert(data.message);
                    }
                });
            }
        });
    });

    // Handle remove item
    document.querySelectorAll('.remove-item-btn').forEach(function(button) {
        button.addEventListener('click', function() {
            let itemId = this.dataset.itemId;
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
                    this.closest('li').remove();
                } else {
                    alert(data.message);
                }
            });
        });
    });

    // Handle tab switching
    document.querySelectorAll('.tab-btn').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('tab-active'));
            document.querySelectorAll('.watchlist-content').forEach(w => w.classList.add('hidden'));
            this.classList.add('tab-active');
            document.getElementById('watchlist-' + this.dataset.watchlistId).classList.remove('hidden');
        });
    });

    // Handle search symbol and add to watchlist
    document.getElementById('search-symbol-input').addEventListener('input', function() {
        let query = this.value;
        let resultsContainer = document.getElementById('search-results');
        if (query.length >= 2) {
            fetch('/search_symbols?q=' + encodeURIComponent(query))
            .then(response => response.json())
            .then(data => {
                resultsContainer.innerHTML = '';
                data.results.forEach(function(result) {
                    let li = document.createElement('li');
                    li.textContent = result.symbol + ' - ' + result.name + ' (' + result.exch_seg + ')';
                    li.dataset.symbol = result.symbol;
                    li.dataset.exchSeg = result.exch_seg;
                    li.classList.add('search-result-item', 'cursor-pointer', 'hover:bg-gray-700', 'p-2');
                    resultsContainer.appendChild(li);
                });
            });
        } else {
            resultsContainer.innerHTML = '';
        }
    });

    // Handle click on search result to add item
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('search-result-item')) {
            let symbol = event.target.dataset.symbol;
            let exch_seg = event.target.dataset.exchSeg;
            let activeTab = document.querySelector('.tab-btn.tab-active');
            let watchlistId = activeTab.dataset.watchlistId;
            fetch('/add_watchlist_item', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({watchlist_id: watchlistId, symbol: symbol, exch_seg: exch_seg})
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    let watchlistContent = document.getElementById('watchlist-' + watchlistId);
                    let ul = watchlistContent.querySelector('ul');
                    let li = document.createElement('li');
                    li.className = 'flex justify-between items-center mb-2';
                    li.innerHTML = `
                        <span>${symbol}</span>
                        <button class="btn btn-xs btn-error remove-item-btn" data-item-id="${data.item_id}">Remove</button>
                    `;
                    ul.appendChild(li);
                    document.getElementById('search-symbol-input').value = '';
                    document.getElementById('search-results').innerHTML = '';
                } else {
                    alert(data.message);
                }
            });
        }
    });

    // Fetch NIFTY and SENSEX values
    function updateIndices() {
        fetch('/get_indices')
        .then(response => response.json())
        .then(data => {
            document.getElementById('nifty-value').textContent = data.nifty;
            document.getElementById('sensex-value').textContent = data.sensex;
        });
    }

    updateIndices();
});
