// static/js/modules/watchlistCore.js

const WatchlistCore = {
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
        WatchlistEvents.bindEventListeners();
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
            WatchlistEvents.handleTabActivation(activeTab.dataset.watchlistId);
        }
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
            const filteredResults = this.filterSearchResults(data.results, query);
            this.displaySearchResults(filteredResults);
        } catch (error) {
            console.error('Error searching symbols:', error);
        }
    },

    filterSearchResults(results, query) {
        const terms = query.toUpperCase().split(/\s+/);
        return results.filter(result => {
            const symbolInfo = `${result.symbol} ${result.exch_seg}`.toUpperCase();
            return terms.every(term => symbolInfo.includes(term));
        });
    },

    displaySearchResults(results) {
        const searchResults = document.getElementById('search-results');
        searchResults.innerHTML = results.map(result => `
            <li class="p-2 hover:bg-base-200 cursor-pointer flex justify-between items-center"
                onclick="WatchlistOperations.addSymbolToWatchlist('${result.symbol}', '${result.exch_seg}')">
                <div>
                    <div class="font-medium">${result.symbol}</div>
                    <div class="text-xs text-base-content/70">${result.exch_seg}</div>
                </div>
            </li>
        `).join('');
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
window.WatchlistCore = WatchlistCore;
