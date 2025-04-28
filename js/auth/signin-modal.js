/**
 * Sign In modal module for handling user authentication
 * Includes modal UI management, form validation, and integration with auth service
 */

import { loginUser } from '../services/auth-service.js';

/**
 * Initialize and set up the Sign In modal functionality
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.modalElement - The modal container element
 * @param {HTMLElement} options.modalFeedback - Feedback element for notifications
 * @param {HTMLElement} options.usernameOrEmailInput - The username/email input field
 * @param {HTMLElement} options.passwordInput - The password input field
 * @param {HTMLElement} options.rememberMeCheckbox - The remember me checkbox
 * @param {HTMLElement} options.signInBtn - Button to authenticate user
 * @param {HTMLElement} options.cancelBtn - Button to cancel and close modal
 * @param {HTMLElement} options.forgotPasswordLink - Link to reset password
 * @param {Function} options.onSignInSuccess - Callback for successful authentication
 * @param {Function} options.onForgotPassword - Callback for forgot password link
 * @param {Function} options.showFeedbackMessage - Function to display feedback messages
 * @returns {Object} - Public API for the Sign In modal
 */
function initSignInModal(options) {
    const {
        modalElement,
        modalFeedback,
        usernameOrEmailInput,
        passwordInput,
        rememberMeCheckbox,
        signInBtn,
        cancelBtn,
        forgotPasswordLink,
        onSignInSuccess,
        onForgotPassword,
        showFeedbackMessage
    } = options;
    
    // Track event handlers to avoid duplication
    let eventHandlersAttached = false;
    
    /**
     * Show the Sign In modal dialog
     */
    function showModal() {
        if (!modalElement) {
            console.error('Sign In modal element not found');
            return;
        }
        
        console.log('Showing Sign In modal and setting up event handlers');
        
        // Clear previous inputs
        usernameOrEmailInput.value = '';
        passwordInput.value = '';
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = false;
        }
        
        // Show the modal with flexbox display
        modalElement.style.display = 'flex';
        
        // Focus the username/email input
        setTimeout(() => usernameOrEmailInput.focus(), 50);
        
        // Set up event handlers if not already attached
        if (!eventHandlersAttached) {
            setupEventHandlers();
            eventHandlersAttached = true;
        }
    }
    
    /**
     * Hide the Sign In modal dialog
     */
    function hideModal() {
        if (modalElement) {
            modalElement.style.display = 'none';
        }
    }
    
    /**
     * Set up all event handlers for the modal
     */
    function setupEventHandlers() {
        console.log('Setting up event handlers for Sign In modal');
        
        // Set up Cancel button
        if (cancelBtn) {
            // Create a new button to remove any existing listeners
            const newCancelBtn = cancelBtn.cloneNode(true);
            if (cancelBtn.parentNode) {
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            }
            
            // Add click event to the new button
            newCancelBtn.addEventListener('click', hideModal);
        }
        
        // Set up Sign In button
        if (signInBtn) {
            // Create a new button to remove any existing listeners
            const newSignInBtn = signInBtn.cloneNode(true);
            if (signInBtn.parentNode) {
                signInBtn.parentNode.replaceChild(newSignInBtn, signInBtn);
            }
            
            // Add click event to the new button
            newSignInBtn.addEventListener('click', handleSignIn);
        }
        
        // Set up Forgot Password link
        if (forgotPasswordLink) {
            // Create a new link to remove any existing listeners
            const newForgotPasswordLink = forgotPasswordLink.cloneNode(true);
            if (forgotPasswordLink.parentNode) {
                forgotPasswordLink.parentNode.replaceChild(newForgotPasswordLink, forgotPasswordLink);
            }
            
            // Add click event to the new link
            newForgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (typeof onForgotPassword === 'function') {
                    onForgotPassword();
                }
            });
        }
        
        // Handle Enter key in username/email input
        usernameOrEmailInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                passwordInput.focus();
            }
        });
        
        // Handle Enter key in password input
        passwordInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSignIn();
            }
        });
        
        // Add click handler to close when clicking outside
        modalElement.addEventListener('click', handleModalOutsideClick);
    }
    
    /**
     * Handler for modal background click to close modal
     */
    function handleModalOutsideClick(e) {
        if (e.target === modalElement) {
            hideModal();
        }
    }
    
    /**
     * Validates the sign in form
     * @returns {Object} Validation result with success flag and message
     */
    function validateForm() {
        const usernameOrEmail = usernameOrEmailInput.value.trim();
        const password = passwordInput.value;
        
        // Check required fields
        if (!usernameOrEmail || !password) {
            return { 
                success: false, 
                message: 'Username/Email and password are required' 
            };
        }
        
        return { success: true };
    }
    
    /**
     * Handle the sign in process
     */
    function handleSignIn() {
        // Validate form inputs
        const validation = validateForm();
        
        if (!validation.success) {
            // Show validation error feedback
            modalFeedback.textContent = validation.message;
            modalFeedback.style.backgroundColor = 'rgba(254, 242, 242, 0.98)'; // Light red
            modalFeedback.style.color = '#991b1b'; // Dark red
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // Reset styling after animation completes
            setTimeout(() => {
                modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)';
                modalFeedback.style.color = '#0c652f';
            }, 2500);
            
            return;
        }
        
        // Gather form data
        const credentials = {
            usernameOrEmail: usernameOrEmailInput.value.trim(),
            password: passwordInput.value,
            rememberMe: rememberMeCheckbox ? rememberMeCheckbox.checked : false
        };
        
        // Disable the button while authenticating
        signInBtn.disabled = true;
        signInBtn.textContent = 'Signing in...';
        
        // Show processing feedback
        modalFeedback.textContent = 'Signing in...';
        modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
        modalFeedback.style.color = '#0c652f'; // Default color
        showFeedbackMessage(modalFeedback, true);
        
        // Authenticate the user
        const result = loginUser(credentials);
        
        // Re-enable the button
        signInBtn.disabled = false;
        signInBtn.textContent = 'Sign In';
        
        if (result.success) {
            // Show success feedback in the modal
            modalFeedback.textContent = 'Sign in successful!';
            modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
            modalFeedback.style.color = '#0c652f'; // Default color
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // Close the modal after a delay
            setTimeout(() => {
                hideModal();
                
                // Call success callback if provided
                if (typeof onSignInSuccess === 'function') {
                    onSignInSuccess(result);
                }
            }, 1500);
        } else {
            // Show error feedback in the modal
            modalFeedback.textContent = result.message || 'Invalid username/email or password';
            modalFeedback.style.backgroundColor = 'rgba(254, 242, 242, 0.98)'; // Light red
            modalFeedback.style.color = '#991b1b'; // Dark red
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // Reset styling after animation completes
            setTimeout(() => {
                modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)';
                modalFeedback.style.color = '#0c652f';
            }, 2500);
        }
    }
    
    // Public API
    return {
        showModal,
        hideModal,
        handleSignIn
    };
}

export default initSignInModal;