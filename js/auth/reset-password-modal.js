/**
 * Reset Password modal module for handling password reset process
 * Includes modal UI management, form validation, and integration with auth service
 */

import { requestPasswordReset, resetPassword, validateResetToken } from '../services/auth-service.js';

/**
 * Initialize and set up the Reset Password modal functionality
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.modalElement - The modal container element
 * @param {HTMLElement} options.modalFeedback - Feedback element for notifications
 * @param {HTMLElement} options.emailInput - The email input field
 * @param {HTMLElement} options.tokenInput - The token input field
 * @param {HTMLElement} options.newPasswordInput - The new password input field
 * @param {HTMLElement} options.confirmPasswordInput - The confirm password input field
 * @param {HTMLElement} options.requestResetBtn - Button to request password reset
 * @param {HTMLElement} options.resetPasswordBtn - Button to reset password
 * @param {HTMLElement} options.cancelBtn - Button to cancel and close modal
 * @param {HTMLElement} options.requestStepElement - Element containing the request step form
 * @param {HTMLElement} options.resetStepElement - Element containing the reset step form
 * @param {Function} options.onResetSuccess - Callback for successful password reset
 * @param {Function} options.showFeedbackMessage - Function to display feedback messages
 * @returns {Object} - Public API for the Reset Password modal
 */
function initResetPasswordModal(options) {
    const {
        modalElement,
        modalFeedback,
        emailInput,
        tokenInput,
        newPasswordInput,
        confirmPasswordInput,
        requestResetBtn,
        resetPasswordBtn,
        cancelBtn,
        backToRequestBtn,
        requestStepElement,
        resetStepElement,
        onResetSuccess,
        showFeedbackMessage
    } = options;
    
    // Track event handlers to avoid duplication
    let eventHandlersAttached = false;
    
    // Track current step (request or reset)
    let currentStep = 'request';
    
    /**
     * Show the Reset Password modal dialog
     * @param {string} [step='request'] - Which step to show ('request' or 'reset')
     * @param {string} [token] - Optional token for reset step
     */
    function showModal(step = 'request', token = null) {
        if (!modalElement) {
            console.error('Reset Password modal element not found');
            return;
        }
        
        console.log('Showing Reset Password modal and setting up event handlers');
        
        // Clear previous inputs
        emailInput.value = '';
        if (tokenInput) tokenInput.value = token || '';
        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmPasswordInput) confirmPasswordInput.value = '';
        
        // Show the modal with flexbox display
        modalElement.style.display = 'flex';
        
        // Set the step
        setStep(step);
        
        // Focus the appropriate input
        setTimeout(() => {
            if (step === 'request') {
                emailInput.focus();
            } else if (step === 'reset') {
                tokenInput ? tokenInput.focus() : newPasswordInput.focus();
            }
        }, 50);
        
        // Set up event handlers if not already attached
        if (!eventHandlersAttached) {
            setupEventHandlers();
            eventHandlersAttached = true;
        }
    }
    
    /**
     * Hide the Reset Password modal dialog
     */
    function hideModal() {
        if (modalElement) {
            modalElement.style.display = 'none';
        }
    }
    
    /**
     * Switch between request and reset steps
     * @param {string} step - The step to show ('request' or 'reset')
     */
    function setStep(step) {
        currentStep = step;
        
        if (step === 'request') {
            requestStepElement.style.display = 'block';
            resetStepElement.style.display = 'none';
        } else if (step === 'reset') {
            requestStepElement.style.display = 'none';
            resetStepElement.style.display = 'block';
        }
    }
    
    /**
     * Set up all event handlers for the modal
     */
    function setupEventHandlers() {
        console.log('Setting up event handlers for Reset Password modal');
        
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
        
        // Set up Back to Request button
        if (backToRequestBtn) {
            // Create a new button to remove any existing listeners
            const newBackBtn = backToRequestBtn.cloneNode(true);
            if (backToRequestBtn.parentNode) {
                backToRequestBtn.parentNode.replaceChild(newBackBtn, backToRequestBtn);
            }
            
            // Add click event to the new button
            newBackBtn.addEventListener('click', () => setStep('request'));
        }
        
        // Set up Request Reset button
        if (requestResetBtn) {
            // Create a new button to remove any existing listeners
            const newRequestResetBtn = requestResetBtn.cloneNode(true);
            if (requestResetBtn.parentNode) {
                requestResetBtn.parentNode.replaceChild(newRequestResetBtn, requestResetBtn);
            }
            
            // Add click event to the new button
            newRequestResetBtn.addEventListener('click', handleRequestReset);
        }
        
        // Set up Reset Password button
        if (resetPasswordBtn) {
            // Create a new button to remove any existing listeners
            const newResetPasswordBtn = resetPasswordBtn.cloneNode(true);
            if (resetPasswordBtn.parentNode) {
                resetPasswordBtn.parentNode.replaceChild(newResetPasswordBtn, resetPasswordBtn);
            }
            
            // Add click event to the new button
            newResetPasswordBtn.addEventListener('click', handleResetPassword);
        }
        
        // Handle Enter key in the email input
        emailInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleRequestReset();
            }
        });
        
        // Add handlers for reset form inputs if they exist
        if (tokenInput) {
            tokenInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    newPasswordInput.focus();
                }
            });
        }
        
        if (newPasswordInput) {
            newPasswordInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmPasswordInput.focus();
                }
            });
        }
        
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleResetPassword();
                }
            });
        }
        
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
     * Validates the request reset form
     * @returns {Object} Validation result with success flag and message
     */
    function validateRequestForm() {
        const email = emailInput.value.trim();
        
        if (!email) {
            return { 
                success: false, 
                message: 'Email is required' 
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
        
        return { success: true };
    }
    
    /**
     * Validates the reset password form
     * @returns {Object} Validation result with success flag and message
     */
    function validateResetForm() {
        const token = tokenInput ? tokenInput.value.trim() : '';
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Check required fields
        if (tokenInput && !token) {
            return { 
                success: false, 
                message: 'Reset token is required' 
            };
        }
        
        if (!newPassword) {
            return { 
                success: false, 
                message: 'New password is required' 
            };
        }
        
        if (!confirmPassword) {
            return { 
                success: false, 
                message: 'Please confirm your password' 
            };
        }
        
        // Validate password length
        if (newPassword.length < 6) {
            return { 
                success: false, 
                message: 'Password must be at least 6 characters' 
            };
        }
        
        // Check if passwords match
        if (newPassword !== confirmPassword) {
            return { 
                success: false, 
                message: 'Passwords do not match' 
            };
        }
        
        return { success: true };
    }
    
    /**
     * Handle the request password reset process
     */
    function handleRequestReset() {
        // Validate form inputs
        const validation = validateRequestForm();
        
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
        const email = emailInput.value.trim();
        
        // Disable the button while processing
        requestResetBtn.disabled = true;
        requestResetBtn.textContent = 'Processing...';
        
        // Show processing feedback
        modalFeedback.textContent = 'Sending reset instructions...';
        modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
        modalFeedback.style.color = '#0c652f'; // Default color
        showFeedbackMessage(modalFeedback, true);
        
        // Request password reset
        const result = requestPasswordReset(email);
        
        // Re-enable the button
        requestResetBtn.disabled = false;
        requestResetBtn.textContent = 'Request Reset';
        
        if (result.success) {
            // Show success feedback in the modal
            modalFeedback.textContent = result.message;
            modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
            modalFeedback.style.color = '#0c652f'; // Default color
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // In a real app, we would end here since the email has been sent
            // For this demo app, we'll show the reset token and advance to reset step
            
            // Auto-advance to reset step after a delay
            setTimeout(() => {
                // For demo only: Display the token in the token input
                if (tokenInput) {
                    tokenInput.value = result.token;
                }
                
                // Switch to reset step
                setStep('reset');
                
                // Auto-focus the new password field
                setTimeout(() => {
                    newPasswordInput.focus();
                }, 100);
                
            }, 1500);
        } else {
            // Show error feedback in the modal
            modalFeedback.textContent = result.message || 'Error requesting password reset';
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
    
    /**
     * Handle the reset password process
     */
    function handleResetPassword() {
        // Validate form inputs
        const validation = validateResetForm();
        
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
        const token = tokenInput ? tokenInput.value.trim() : '';
        const newPassword = newPasswordInput.value;
        
        // Disable the button while processing
        resetPasswordBtn.disabled = true;
        resetPasswordBtn.textContent = 'Resetting...';
        
        // Show processing feedback
        modalFeedback.textContent = 'Resetting your password...';
        modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
        modalFeedback.style.color = '#0c652f'; // Default color
        showFeedbackMessage(modalFeedback, true);
        
        // Reset password
        const result = resetPassword({ token, newPassword });
        
        // Re-enable the button
        resetPasswordBtn.disabled = false;
        resetPasswordBtn.textContent = 'Reset Password';
        
        if (result.success) {
            // Show success feedback in the modal
            modalFeedback.textContent = 'Password reset successfully!';
            modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
            modalFeedback.style.color = '#0c652f'; // Default color
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // Close the modal after a delay
            setTimeout(() => {
                hideModal();
                
                // Call success callback if provided
                if (typeof onResetSuccess === 'function') {
                    onResetSuccess(result);
                }
            }, 1500);
        } else {
            // Show error feedback in the modal
            modalFeedback.textContent = result.message || 'Error resetting password';
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
        setStep,
        handleRequestReset,
        handleResetPassword
    };
}

export default initResetPasswordModal;