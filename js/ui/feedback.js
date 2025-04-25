/**
 * Feedback system to handle user feedback messages, animations, and clipboard notifications
 */

/**
 * Initialize feedback system with the necessary elements
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.clipboardFeedback - The clipboard feedback element
 * @param {HTMLElement} [options.modalFeedback] - Optional modal feedback element
 * @returns {Object} - Public API for the feedback system
 */
function initFeedback(options) {
    const { clipboardFeedback, modalFeedback } = options;
    
    /**
     * Show a feedback message with animations
     * @param {HTMLElement} element - The element to show as feedback
     * @param {boolean} [isModal=false] - Whether this is a modal feedback (different styling/timing)
     */
    function showFeedbackMessage(element, isModal = false) {
        if (!element) return;
        
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
            // For standard feedback
            element.style.animation = 'fadeIn 0.3s ease forwards, fadeOut 0.3s ease 1.7s forwards';
            
            // Hide the element after animations complete
            setTimeout(() => {
                element.style.display = 'none';
            }, 2300); // Total animation time: 0.3s in + 1.7s delay + 0.3s out
        }
    }
    
    /**
     * Show the clipboard feedback message
     * @param {string} [message] - Optional custom message (uses default if not provided)
     */
    function showClipboardFeedback(message) {
        if (!clipboardFeedback) return;
        
        // Use custom message if provided
        if (message) {
            clipboardFeedback.textContent = message;
        }
        
        showFeedbackMessage(clipboardFeedback);
    }
    
    /**
     * Copy text to clipboard with feedback
     * @param {string} text - The text to copy
     * @param {string} [successMessage="Copied to clipboard!"] - Message to show on success
     * @param {string} [errorMessage="Failed to copy to clipboard"] - Message to show on error
     * @returns {Promise<boolean>} - Success status
     */
    async function copyToClipboard(text, successMessage = "Copied to clipboard!", errorMessage = "Failed to copy to clipboard") {
        if (!clipboardFeedback) {
            console.warn('Clipboard feedback element not found');
        }
        
        try {
            await navigator.clipboard.writeText(text);
            
            // Show success feedback
            if (clipboardFeedback) {
                clipboardFeedback.textContent = successMessage;
                showFeedbackMessage(clipboardFeedback);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            
            // Show error feedback
            if (clipboardFeedback) {
                clipboardFeedback.textContent = errorMessage;
                clipboardFeedback.style.backgroundColor = 'rgba(254, 242, 242, 0.98)'; // Light red
                clipboardFeedback.style.color = '#991b1b'; // Dark red
                
                showFeedbackMessage(clipboardFeedback);
                
                // Reset styling after animation completes
                setTimeout(() => {
                    clipboardFeedback.style.backgroundColor = '';
                    clipboardFeedback.style.color = '';
                }, 3000);
            }
            
            return false;
        }
    }
    
    /**
     * Show a modal feedback message
     * @param {string} message - The message to display
     * @param {boolean} [isError=false] - Whether this is an error message
     */
    function showModalFeedback(message, isError = false) {
        if (!modalFeedback) return;
        
        modalFeedback.textContent = message;
        
        if (isError) {
            modalFeedback.style.backgroundColor = 'rgba(254, 242, 242, 0.98)'; // Light red
            modalFeedback.style.color = '#991b1b'; // Dark red
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // Reset styling after animation completes
            setTimeout(() => {
                modalFeedback.style.backgroundColor = '';
                modalFeedback.style.color = '';
            }, 2500);
        } else {
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
        }
    }
    
    /**
     * Create a temporary feedback element to show in a specific location
     * @param {string} message - The message to display
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.parent - Parent element to append the feedback to
     * @param {string} [options.className='temp-feedback'] - CSS class for styling
     * @param {boolean} [options.isError=false] - Whether this is an error message
     * @param {number} [options.duration=2800] - How long to show the message (ms)
     */
    function createTemporaryFeedback(message, { parent, className = 'temp-feedback', isError = false, duration = 2800 }) {
        if (!parent) {
            console.warn('Parent element is required for temporary feedback');
            return;
        }
        
        // Create the feedback element
        const feedback = document.createElement('div');
        feedback.className = className;
        feedback.textContent = message;
        
        if (isError) {
            feedback.classList.add('error');
        }
        
        // Add to parent
        parent.appendChild(feedback);
        
        // Force reflow for animation
        void feedback.offsetWidth;
        
        // Add visible class for animation
        feedback.classList.add('visible');
        
        // Remove after duration
        setTimeout(() => {
            feedback.classList.remove('visible');
            
            // Remove from DOM after fade out animation
            setTimeout(() => {
                if (parent.contains(feedback)) {
                    parent.removeChild(feedback);
                }
            }, 400); // Animation duration
        }, duration);
    }
    
    // Public API
    return {
        showFeedbackMessage,
        showClipboardFeedback,
        copyToClipboard,
        showModalFeedback,
        createTemporaryFeedback
    };
}

export default initFeedback;
