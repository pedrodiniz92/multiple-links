/**
 * Sign Up modal module for handling user registration
 * Includes modal UI management, form validation, and integration with auth service
 */

import { registerUser } from '../services/auth-service.js';

/**
 * Initialize and set up the Sign Up modal functionality
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.modalElement - The modal container element
 * @param {HTMLElement} options.modalFeedback - Feedback element for notifications
 * @param {HTMLElement} options.usernameInput - The username input field
 * @param {HTMLElement} options.emailInput - The email input field
 * @param {HTMLElement} options.passwordInput - The password input field
 * @param {HTMLElement} options.confirmPasswordInput - The confirm password input field
 * @param {HTMLElement} options.termsCheckbox - The terms and conditions checkbox
 * @param {HTMLElement} options.signUpBtn - Button to register user
 * @param {HTMLElement} options.cancelBtn - Button to cancel and close modal
 * @param {Function} options.onSignUpSuccess - Callback for successful registration
 * @param {Function} options.showFeedbackMessage - Function to display feedback messages
 * @returns {Object} - Public API for the Sign Up modal
 */
function initSignUpModal(options) {
    const {
        modalElement,
        modalFeedback,
        usernameInput,
        emailInput,
        passwordInput,
        confirmPasswordInput,
        termsCheckbox,
        signUpBtn,
        cancelBtn,
        onSignUpSuccess,
        showFeedbackMessage
    } = options;
    
    // Track event handlers to avoid duplication
    let eventHandlersAttached = false;
    
    /**
     * Show the Sign Up modal dialog
     */
    function showModal() {
        if (!modalElement) {
            console.error('Sign Up modal element not found');
            return;
        }
        
        console.log('Showing Sign Up modal and setting up event handlers');
        
        // Clear previous inputs
        usernameInput.value = '';
        emailInput.value = '';
        passwordInput.value = '';
        confirmPasswordInput.value = '';
        if (termsCheckbox) {
            termsCheckbox.checked = false;
        }
        
        // Show the modal with flexbox display
        modalElement.style.display = 'flex';
        
        // Focus the username input
        setTimeout(() => usernameInput.focus(), 50);
        
        // Set up event handlers if not already attached
        if (!eventHandlersAttached) {
            setupEventHandlers();
            eventHandlersAttached = true;
        }
    }
    
    /**
     * Hide the Sign Up modal dialog
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
        console.log('Setting up event handlers for Sign Up modal');
        
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
        
        // Set up Sign Up button
        if (signUpBtn) {
            // Create a new button to remove any existing listeners
            const newSignUpBtn = signUpBtn.cloneNode(true);
            if (signUpBtn.parentNode) {
                signUpBtn.parentNode.replaceChild(newSignUpBtn, signUpBtn);
            }
            
            // Add click event to the new button
            newSignUpBtn.addEventListener('click', handleSignUp);
        }
        
        // Handle Enter key in various inputs
        usernameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                emailInput.focus();
            }
        });
        
        emailInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                passwordInput.focus();
            }
        });
        
        passwordInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmPasswordInput.focus();
            }
        });
        
        confirmPasswordInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSignUp();
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
     * Validates the sign up form
     * @returns {Object} Validation result with success flag and message
     */
    function validateForm() {
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Check required fields
        if (!username || !email || !password || !confirmPassword) {
            return { 
                success: false, 
                message: 'All fields are required' 
            };
        }
        
        // Validate username length
        if (username.length < 3) {
            return { 
                success: false, 
                message: 'Username must be at least 3 characters' 
            };
        }
        
        // Validate email format with regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { 
                success: false, 
                message: 'Please enter a valid email address' 
            };
        }
        
        // Validate password length
        if (password.length < 6) {
            return { 
                success: false, 
                message: 'Password must be at least 6 characters' 
            };
        }
        
        // Check if passwords match
        if (password !== confirmPassword) {
            return { 
                success: false, 
                message: 'Passwords do not match' 
            };
        }
        
        // Check terms and conditions if checkbox exists
        if (termsCheckbox && !termsCheckbox.checked) {
            return { 
                success: false, 
                message: 'You must accept the Terms and Conditions' 
            };
        }
        
        return { success: true };
    }
    
    /**
     * Handle the sign up process
     */
    function handleSignUp() {
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
        const userData = {
            username: usernameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value
        };
        
        // Disable the button while registering
        signUpBtn.disabled = true;
        signUpBtn.textContent = 'Creating account...';
        
        // Show processing feedback
        modalFeedback.textContent = 'Creating your account...';
        modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
        modalFeedback.style.color = '#0c652f'; // Default color
        showFeedbackMessage(modalFeedback, true);
        
        // Register the user
        const result = registerUser(userData);
        
        // Re-enable the button
        signUpBtn.disabled = false;
        signUpBtn.textContent = 'Sign Up';
        
        if (result.success) {
            // Show success feedback in the modal
            modalFeedback.textContent = 'Account created successfully!';
            modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
            modalFeedback.style.color = '#0c652f'; // Default color
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // Close the modal after a delay
            setTimeout(() => {
                hideModal();
                
                // Call success callback if provided
                if (typeof onSignUpSuccess === 'function') {
                    onSignUpSuccess(result);
                }
            }, 1500);
        } else {
            // Show error feedback in the modal
            modalFeedback.textContent = result.message || 'Error creating account';
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
        handleSignUp
    };
}

export default initSignUpModal;