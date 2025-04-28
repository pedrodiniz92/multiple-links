/**
 * Auth UI module for managing authentication UI components
 * Handles displaying correct auth-related UI elements based on authentication state
 */

import { getCurrentUser, logoutUser, isSessionValid } from '../services/auth-service.js';
import initSignUpModal from './signup-modal.js';
import initSignInModal from './signin-modal.js';
import initResetPasswordModal from './reset-password-modal.js';

/**
 * Initialize and manage auth-related UI components
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.authLinksContainer - Container for auth links/user info
 * @param {HTMLElement} options.signInModal - Sign in modal element
 * @param {HTMLElement} options.signUpModal - Sign up modal element
 * @param {HTMLElement} options.resetPasswordModal - Reset password modal element
 * @param {HTMLElement} options.signInLink - Sign in link element
 * @param {HTMLElement} options.signUpLink - Sign up link element
 * @param {Function} options.showFeedbackMessage - Function to display feedback messages
 * @returns {Object} - Public API for auth UI management
 */
function initAuthUI(options) {
    const {
        authLinksContainer,
        signInModal,
        signUpModal,
        resetPasswordModal,
        signInLink,
        signUpLink,
        signInModalFeedback,
        signUpModalFeedback,
        resetPasswordModalFeedback,
        showFeedbackMessage
    } = options;
    
    let signInModalInstance = null;
    let signUpModalInstance = null;
    let resetPasswordModalInstance = null;
    
    /**
     * Initialize the auth UI components
     */
    function init() {
        console.log('Initializing Auth UI components');
        
        // Set up sign in modal instance
        if (signInModal) {
            signInModalInstance = initSignInModal({
                modalElement: signInModal,
                modalFeedback: signInModalFeedback,
                usernameOrEmailInput: document.getElementById('signin-username-email'),
                passwordInput: document.getElementById('signin-password'),
                rememberMeCheckbox: document.getElementById('signin-remember-me'),
                signInBtn: document.getElementById('signin-btn'),
                cancelBtn: document.getElementById('signin-cancel-btn'),
                forgotPasswordLink: document.getElementById('forgot-password-link'),
                onSignInSuccess: handleSignInSuccess,
                onForgotPassword: handleForgotPassword,
                showFeedbackMessage
            });
        }
        
        // Set up sign up modal instance
        if (signUpModal) {
            signUpModalInstance = initSignUpModal({
                modalElement: signUpModal,
                modalFeedback: signUpModalFeedback,
                usernameInput: document.getElementById('signup-username'),
                emailInput: document.getElementById('signup-email'),
                passwordInput: document.getElementById('signup-password'),
                confirmPasswordInput: document.getElementById('signup-confirm-password'),
                termsCheckbox: document.getElementById('signup-terms'),
                signUpBtn: document.getElementById('signup-btn'),
                cancelBtn: document.getElementById('signup-cancel-btn'),
                onSignUpSuccess: handleSignUpSuccess,
                showFeedbackMessage
            });
        }
        
        // Set up reset password modal instance
        if (resetPasswordModal) {
            resetPasswordModalInstance = initResetPasswordModal({
                modalElement: resetPasswordModal,
                modalFeedback: resetPasswordModalFeedback,
                emailInput: document.getElementById('reset-email'),
                tokenInput: document.getElementById('reset-token'),
                newPasswordInput: document.getElementById('reset-new-password'),
                confirmPasswordInput: document.getElementById('reset-confirm-password'),
                requestResetBtn: document.getElementById('request-reset-btn'),
                resetPasswordBtn: document.getElementById('reset-password-btn'),
                cancelBtn: document.getElementById('reset-cancel-btn'),
                backToRequestBtn: document.getElementById('back-to-request-btn'),
                requestStepElement: document.getElementById('reset-request-step'),
                resetStepElement: document.getElementById('reset-password-step'),
                onResetSuccess: handleResetSuccess,
                showFeedbackMessage
            });
        }
        
        // Set up link click handlers
        if (signInLink) {
            signInLink.addEventListener('click', e => {
                e.preventDefault();
                showSignInModal();
            });
        }
        
        if (signUpLink) {
            signUpLink.addEventListener('click', e => {
                e.preventDefault();
                showSignUpModal();
            });
        }
        
        // Initialize auth UI based on current state
        updateAuthUI();
    }
    
    /**
     * Update the auth UI based on current authentication state
     */
    function updateAuthUI() {
        const user = getCurrentUser();
        
        if (user && isSessionValid()) {
            // User is logged in
            renderAuthenticatedUI(user);
        } else {
            // User is not logged in
            renderUnauthenticatedUI();
        }
    }
    
    /**
     * Render UI for authenticated users
     * @param {Object} user - Current user object
     */
    function renderAuthenticatedUI(user) {
        if (!authLinksContainer) return;
        
        // Replace auth links with user info and logout
        authLinksContainer.innerHTML = `
            <div class="user-info">
                <span class="username">${user.username}</span>
                <button id="logout-btn" class="logout-button">Logout</button>
            </div>
        `;
        
        // Add event listener to logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
    }
    
    /**
     * Render UI for unauthenticated users
     */
    function renderUnauthenticatedUI() {
        if (!authLinksContainer) return;
        
        // Restore the sign in and sign up links
        authLinksContainer.innerHTML = `
            <a href="#" id="signin-link">Sign in</a>
            <a href="#" id="signup-link">Sign up</a>
        `;
        
        // Re-attach event listeners to the new links
        const newSignInLink = document.getElementById('signin-link');
        const newSignUpLink = document.getElementById('signup-link');
        
        if (newSignInLink) {
            newSignInLink.addEventListener('click', e => {
                e.preventDefault();
                showSignInModal();
            });
        }
        
        if (newSignUpLink) {
            newSignUpLink.addEventListener('click', e => {
                e.preventDefault();
                showSignUpModal();
            });
        }
    }
    
    /**
     * Handle successful sign in
     * @param {Object} result - Sign in result
     */
    function handleSignInSuccess(result) {
        console.log('Sign in successful:', result);
        updateAuthUI();
    }
    
    /**
     * Handle successful sign up
     * @param {Object} result - Sign up result
     */
    function handleSignUpSuccess(result) {
        console.log('Sign up successful:', result);
        // After successful signup, show the sign in modal
        setTimeout(() => {
            showSignInModal();
        }, 500);
    }
    
    /**
     * Handle forgot password click
     */
    function handleForgotPassword() {
        if (resetPasswordModalInstance) {
            // Hide sign in modal
            if (signInModalInstance) {
                signInModalInstance.hideModal();
            }
            
            // Show reset password modal
            setTimeout(() => {
                resetPasswordModalInstance.showModal('request');
            }, 300);
        }
    }
    
    /**
     * Handle successful password reset
     * @param {Object} result - Reset result
     */
    function handleResetSuccess(result) {
        console.log('Password reset successful:', result);
        // After successful reset, show the sign in modal
        setTimeout(() => {
            showSignInModal();
        }, 500);
    }
    
    /**
     * Handle user logout
     */
    function handleLogout() {
        logoutUser();
        updateAuthUI();
    }
    
    /**
     * Show the sign in modal
     */
    function showSignInModal() {
        if (signInModalInstance) {
            signInModalInstance.showModal();
        }
    }
    
    /**
     * Show the sign up modal
     */
    function showSignUpModal() {
        if (signUpModalInstance) {
            signUpModalInstance.showModal();
        }
    }
    
    /**
     * Show the reset password modal
     * @param {string} [step='request'] - The step to show
     * @param {string} [token] - Optional token for reset step
     */
    function showResetPasswordModal(step = 'request', token = null) {
        if (resetPasswordModalInstance) {
            resetPasswordModalInstance.showModal(step, token);
        }
    }
    
    // Public API
    return {
        init,
        updateAuthUI,
        showSignInModal,
        showSignUpModal,
        showResetPasswordModal
    };
}

export default initAuthUI;