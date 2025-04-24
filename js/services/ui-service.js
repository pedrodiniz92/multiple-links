// UI service for handling UI-related functionality

/**
 * Show feedback messages with animations
 * @param {HTMLElement} element - Element to show
 * @param {boolean} isModal - Whether this is in a modal 
 */
function showFeedbackMessage(element, isModal = false) {
    // Reset animation and set display to block
    element.style.display = 'block';
    
    // Remove any existing animation
    element.style.animation = 'none';
    
    // Force reflow to make sure the animation restart works
    void element.offsetWidth;
    
    // Apply different animations based on the type of feedback
    if (isModal) {
        // For modal feedback (appears at the top of the modal)
        element.style.animation = 'modalFeedbackIn 0.3s ease forwards, modalFeedbackOut 0.3s ease 1.8s forwards';
        
        // Hide the element after animations complete - using shorter duration for modal
        setTimeout(() => {
            element.style.display = 'none';
        }, 2400); // Total animation time: 0.3s in + 1.8s delay + 0.3s out
    } else {
        // For global feedback (appears at the top of the page)
        element.style.animation = 'fadeIn 0.4s ease forwards, fadeOut 0.4s ease 2s forwards';
        
        // Hide the element after animations complete
        setTimeout(() => {
            element.style.display = 'none';
        }, 2800); // Total animation time: 0.4s in + 2s delay + 0.4s out
    }
}

/**
 * Toggle input section visibility
 * @param {boolean} show - Whether to show the input section
 */
function toggleInputSection(show) {
    const inputSection = document.querySelector('.input-section');
    if (show) {
        inputSection.classList.remove('hidden');
    } else {
        inputSection.classList.add('hidden');
    }
}

/**
 * Toggle theme between light and dark
 */
function toggleTheme() {
    const htmlElement = document.documentElement;
    const currentTheme = htmlElement.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        htmlElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        htmlElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
    
    // Update tooltip after theme change
    updateThemeToggleTooltip();
}

/**
 * Update theme toggle icon tooltip based on current theme
 */
function updateThemeToggleTooltip() {
    const themeToggleIcon = document.getElementById('theme-toggle-icon');
    if (!themeToggleIcon) return;
    
    const themeTooltip = themeToggleIcon.querySelector('.theme-tooltip');
    if (!themeTooltip) return;
    
    const currentTheme = document.documentElement.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        themeTooltip.textContent = 'Light mode';
    } else {
        themeTooltip.textContent = 'Dark mode';
    }
}

// Export UI functions globally
window.showFeedbackMessage = showFeedbackMessage;
window.toggleInputSection = toggleInputSection;
window.toggleTheme = toggleTheme;
window.updateThemeToggleTooltip = updateThemeToggleTooltip;