/**
 * Theme Manager Module
 * Handles theme preference management, toggling, and UI updates
 */

/**
 * Initialize theme management with the provided HTML element and toggle icon
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.htmlElement - The HTML root element to apply theme to
 * @param {HTMLElement} options.themeToggleIcon - The toggle button element
 * @returns {Object} - Theme manager API
 */
function initThemeManager(options) {
    const { htmlElement, themeToggleIcon } = options;
    
    if (!htmlElement || !themeToggleIcon) {
        console.error('Required elements not provided to theme manager');
        return null;
    }
    
    // Check for saved theme preference or respect OS preference
    function loadThemePreference() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            applyTheme('dark');
        } else {
            applyTheme('light');
        }
    }
    
    // Apply the specified theme
    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.setAttribute('data-theme', 'dark');
        } else {
            htmlElement.removeAttribute('data-theme');
        }
        
        // Update tooltip after theme change
        updateThemeToggleTooltip();
    }
    
    // Save theme preference to localStorage
    function saveThemePreference(theme) {
        localStorage.setItem('theme', theme);
    }
    
    // Update theme toggle icon tooltip based on current theme
    function updateThemeToggleTooltip() {
        const currentTheme = getCurrentTheme();
        const themeTooltip = themeToggleIcon.querySelector('.theme-tooltip');
        
        if (themeTooltip) {
            if (currentTheme === 'dark') {
                themeTooltip.textContent = 'Light mode';
            } else {
                themeTooltip.textContent = 'Dark mode';
            }
        }
    }
    
    // Get the current theme
    function getCurrentTheme() {
        return htmlElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }
    
    // Toggle theme when the theme toggle element is clicked
    function toggleTheme() {
        const currentTheme = getCurrentTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        applyTheme(newTheme);
        saveThemePreference(newTheme);
        
        return newTheme;
    }
    
    // Setup listeners
    function setupEventListeners() {
        // Add theme toggle event listener to the icon
        themeToggleIcon.addEventListener('click', toggleTheme);
        
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleMediaChange = (e) => {
            // Only apply OS theme change if user hasn't explicitly set a theme
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        };
        
        // Add listener with compatibility for older browsers
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleMediaChange);
        } else {
            // Fallback for older browsers
            mediaQuery.addListener(handleMediaChange);
        }
    }
    
    // Initialize on first load
    function initialize() {
        loadThemePreference();
        setupEventListeners();
    }
    
    // Public API
    return {
        initialize,
        getCurrentTheme,
        toggleTheme,
        applyTheme,
        updateThemeToggleTooltip
    };
}

export default initThemeManager;
