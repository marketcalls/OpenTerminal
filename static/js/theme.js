// Theme Manager
const ThemeManager = {
    init() {
        this.themeController = document.querySelector('.theme-controller');
        this.themeIcons = {
            dark: document.querySelector('.theme-icon-dark'),
            light: document.querySelector('.theme-icon-light')
        };
        this.transitionElement = document.querySelector('.theme-transition');
        
        // Load theme in this order: localStorage > system preference > default (dark)
        this.loadTheme();
        
        // Bind events
        this.bindEvents();
        
        // Setup system theme listener
        this.setupSystemThemeListener();
    },

    loadTheme() {
        try {
            // First check localStorage
            const storedTheme = localStorage.getItem('theme');
            
            if (storedTheme) {
                // Use stored theme if available
                this.setTheme(storedTheme);
            } else {
                // Check system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const systemTheme = prefersDark ? 'dark' : 'light';
                this.setTheme(systemTheme);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
            // Fallback to dark theme
            this.setTheme('dark');
        }
    },

    setTheme(theme) {
        // Update HTML attribute
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update toggle state
        if (this.themeController) {
            this.themeController.checked = theme === 'light';
        }
        
        // Store the preference
        localStorage.setItem('theme', theme);
    },

    bindEvents() {
        if (!this.themeController) return;

        this.themeController.addEventListener('change', (event) => {
            const theme = event.target.checked ? 'light' : 'dark';
            const rect = event.target.getBoundingClientRect();
            this.toggleTheme(theme, rect);
        });
    },

    setupSystemThemeListener() {
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)')
            .addEventListener('change', (e) => {
                // Only update if no manual preference is stored
                if (!localStorage.getItem('theme')) {
                    const theme = e.matches ? 'dark' : 'light';
                    this.toggleTheme(theme);
                }
            });
    },

    async toggleTheme(theme, rect = null) {
        try {
            // Animate transition if rect is provided
            if (rect && this.transitionElement) {
                this.transitionElement.style.setProperty('--x', `${rect.left + rect.width / 2}px`);
                this.transitionElement.style.setProperty('--y', `${rect.top + rect.height / 2}px`);
                this.transitionElement.classList.add('active');
            }

            // Update theme
            this.setTheme(theme);

            // End transition animation
            if (this.transitionElement) {
                await new Promise(resolve => setTimeout(resolve, 500));
                this.transitionElement.classList.remove('active');
            }
        } catch (error) {
            console.error('Error toggling theme:', error);
        }
    }
};

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
});