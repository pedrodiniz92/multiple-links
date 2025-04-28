/**
 * Authentication service for handling user registration, login, and session management
 * Uses localStorage for client-side persistence of user data
 */

// Constants for localStorage keys
const USERS_KEY = 'watch_it_users';
const CURRENT_USER_KEY = 'watch_it_current_user';
const SESSION_EXPIRY_KEY = 'watch_it_session_expiry';
const RESET_TOKENS_KEY = 'watch_it_reset_tokens';

// Session timeout in milliseconds (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
// Reset token expiry in milliseconds (1 hour)
const RESET_TOKEN_EXPIRY = 60 * 60 * 1000;

/**
 * Simple hash function for password storage
 * Note: This is NOT secure for production use, just for demonstration
 * @param {string} input - String to hash
 * @returns {string} - Hashed string
 */
function simpleHash(input) {
    let hash = 0;
    if (input.length === 0) return hash.toString();
    
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(16); // Convert to hex string
}

/**
 * Gets all registered users from localStorage
 * @returns {Array} - Array of user objects
 */
function getUsers() {
    const usersJson = localStorage.getItem(USERS_KEY);
    return usersJson ? JSON.parse(usersJson) : [];
}

/**
 * Saves users array to localStorage
 * @param {Array} users - Array of user objects
 */
function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/**
 * Gets all reset tokens from localStorage
 * @returns {Object} - Object with reset tokens
 */
function getResetTokens() {
    const tokensJson = localStorage.getItem(RESET_TOKENS_KEY);
    return tokensJson ? JSON.parse(tokensJson) : {};
}

/**
 * Saves reset tokens object to localStorage
 * @param {Object} tokens - Object with reset tokens
 */
function saveResetTokens(tokens) {
    localStorage.setItem(RESET_TOKENS_KEY, JSON.stringify(tokens));
}

/**
 * Checks if a username is already taken
 * @param {string} username - Username to check
 * @returns {boolean} - True if username exists, false otherwise
 */
function isUsernameTaken(username) {
    const users = getUsers();
    return users.some(user => user.username.toLowerCase() === username.toLowerCase());
}

/**
 * Checks if an email is already registered
 * @param {string} email - Email to check
 * @returns {boolean} - True if email exists, false otherwise
 */
function isEmailRegistered(email) {
    const users = getUsers();
    return users.some(user => user.email.toLowerCase() === email.toLowerCase());
}

/**
 * Finds a user by email
 * @param {string} email - Email to find
 * @returns {Object|null} - User object or null if not found
 */
function findUserByEmail(email) {
    const users = getUsers();
    return users.find(user => user.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Generates a random token
 * @returns {string} - Random token
 */
function generateToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

/**
 * Registers a new user
 * @param {Object} userData - User data
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password (will be hashed)
 * @returns {Object} - Result object with success flag and message
 */
function registerUser(userData) {
    // Validate input
    if (!userData.username || !userData.email || !userData.password) {
        return { success: false, message: 'All fields are required' };
    }
    
    if (userData.username.length < 3) {
        return { success: false, message: 'Username must be at least 3 characters' };
    }
    
    if (userData.password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters' };
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
        return { success: false, message: 'Invalid email format' };
    }
    
    // Check if username or email is already registered
    if (isUsernameTaken(userData.username)) {
        return { success: false, message: 'Username is already taken' };
    }
    
    if (isEmailRegistered(userData.email)) {
        return { success: false, message: 'Email is already registered' };
    }
    
    // Create new user with hashed password
    const newUser = {
        id: Date.now().toString(),
        username: userData.username,
        email: userData.email,
        passwordHash: simpleHash(userData.password),
        createdAt: new Date().toISOString()
    };
    
    // Add user to storage
    const users = getUsers();
    users.push(newUser);
    saveUsers(users);
    
    return { 
        success: true, 
        message: 'Registration successful',
        userId: newUser.id
    };
}

/**
 * Authenticates a user
 * @param {Object} credentials - Login credentials
 * @param {string} credentials.usernameOrEmail - Username or email
 * @param {string} credentials.password - Password
 * @param {boolean} credentials.rememberMe - Whether to remember the session
 * @returns {Object} - Result object with success flag and user data
 */
function loginUser(credentials) {
    const { usernameOrEmail, password, rememberMe } = credentials;
    
    // Validate input
    if (!usernameOrEmail || !password) {
        return { success: false, message: 'All fields are required' };
    }
    
    // Get users and find matching user
    const users = getUsers();
    const user = users.find(
        u => (u.username.toLowerCase() === usernameOrEmail.toLowerCase() || 
              u.email.toLowerCase() === usernameOrEmail.toLowerCase())
    );
    
    // Check if user exists
    if (!user) {
        return { success: false, message: 'Invalid username/email or password' };
    }
    
    // Verify password
    const passwordHash = simpleHash(password);
    if (passwordHash !== user.passwordHash) {
        return { success: false, message: 'Invalid username/email or password' };
    }
    
    // Set session expiry time
    let expiryTime;
    if (rememberMe) {
        // Extended session (30 days)
        expiryTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
    } else {
        // Standard session (24 hours)
        expiryTime = Date.now() + SESSION_TIMEOUT;
    }
    
    // Store session info
    const userInfo = {
        id: user.id,
        username: user.username,
        email: user.email
    };
    
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userInfo));
    localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
    
    return { 
        success: true, 
        message: 'Login successful',
        user: userInfo
    };
}

/**
 * Checks if user session is valid and not expired
 * @returns {boolean} - True if session is valid, false otherwise
 */
function isSessionValid() {
    const currentUser = localStorage.getItem(CURRENT_USER_KEY);
    const sessionExpiry = localStorage.getItem(SESSION_EXPIRY_KEY);
    
    if (!currentUser || !sessionExpiry) {
        return false;
    }
    
    // Check if session has expired
    const expiryTime = parseInt(sessionExpiry, 10);
    if (isNaN(expiryTime) || Date.now() > expiryTime) {
        // Session expired, clear it
        localStorage.removeItem(CURRENT_USER_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
        return false;
    }
    
    return true;
}

/**
 * Gets current user info if session is valid
 * @returns {Object|null} - User object or null if no valid session
 */
function getCurrentUser() {
    if (!isSessionValid()) {
        return null;
    }
    
    try {
        const userJson = localStorage.getItem(CURRENT_USER_KEY);
        return JSON.parse(userJson);
    } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
    }
}

/**
 * Updates a user's profile information
 * @param {Object} userData - Updated user data
 * @returns {Object} - Result object with success flag
 */
function updateUserProfile(userData) {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        return { success: false, message: 'Not logged in' };
    }
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex === -1) {
        return { success: false, message: 'User not found' };
    }
    
    // Update allowed fields
    const updatedUser = {...users[userIndex]};
    
    if (userData.username && userData.username !== updatedUser.username) {
        // Check if new username is taken by another user
        if (users.some(u => u.id !== currentUser.id && u.username.toLowerCase() === userData.username.toLowerCase())) {
            return { success: false, message: 'Username already taken' };
        }
        updatedUser.username = userData.username;
    }
    
    // Update user in storage
    users[userIndex] = updatedUser;
    saveUsers(users);
    
    // Update current user data
    const userInfo = {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email
    };
    
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userInfo));
    
    return { 
        success: true, 
        message: 'Profile updated',
        user: userInfo
    };
}

/**
 * Logs out the current user
 */
function logoutUser() {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(SESSION_EXPIRY_KEY);
    return { success: true, message: 'Logged out successfully' };
}

/**
 * Changes user password
 * @param {Object} passwordData - Password change data
 * @param {string} passwordData.currentPassword - Current password
 * @param {string} passwordData.newPassword - New password
 * @returns {Object} - Result object with success flag
 */
function changePassword(passwordData) {
    const { currentPassword, newPassword } = passwordData;
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        return { success: false, message: 'Not logged in' };
    }
    
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex === -1) {
        return { success: false, message: 'User not found' };
    }
    
    // Verify current password
    const currentPasswordHash = simpleHash(currentPassword);
    if (currentPasswordHash !== users[userIndex].passwordHash) {
        return { success: false, message: 'Current password is incorrect' };
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'New password must be at least 6 characters' };
    }
    
    // Update password
    users[userIndex].passwordHash = simpleHash(newPassword);
    saveUsers(users);
    
    return { success: true, message: 'Password changed successfully' };
}

/**
 * Initiates a password reset process
 * @param {string} email - User's email address
 * @returns {Object} - Result object with success flag and token
 */
function requestPasswordReset(email) {
    if (!email) {
        return { success: false, message: 'Email is required' };
    }
    
    // Find user with this email
    const user = findUserByEmail(email);
    if (!user) {
        // For security, don't reveal that the email doesn't exist
        return { success: true, message: 'If this email is registered, a reset link will be sent' };
    }
    
    // Generate a reset token
    const token = generateToken();
    const expiryTime = Date.now() + RESET_TOKEN_EXPIRY;
    
    // Store the token
    const resetTokens = getResetTokens();
    resetTokens[token] = {
        userId: user.id,
        email: user.email,
        expires: expiryTime
    };
    saveResetTokens(resetTokens);
    
    // In a real app, we would send an email here with the reset link
    // For this demo app, we'll just return the token
    return { 
        success: true, 
        message: 'Password reset initiated', 
        token,
        expiryTimeFormatted: new Date(expiryTime).toLocaleTimeString()
    };
}

/**
 * Validates a password reset token
 * @param {string} token - Reset token
 * @returns {Object} - Result object with success flag and user info
 */
function validateResetToken(token) {
    if (!token) {
        return { success: false, message: 'Invalid token' };
    }
    
    const resetTokens = getResetTokens();
    const tokenData = resetTokens[token];
    
    if (!tokenData) {
        return { success: false, message: 'Invalid token' };
    }
    
    // Check if token has expired
    if (Date.now() > tokenData.expires) {
        // Remove expired token
        delete resetTokens[token];
        saveResetTokens(resetTokens);
        return { success: false, message: 'Token has expired' };
    }
    
    return { 
        success: true, 
        message: 'Token is valid',
        email: tokenData.email
    };
}

/**
 * Resets a user's password using a token
 * @param {Object} resetData - Reset data
 * @param {string} resetData.token - Reset token
 * @param {string} resetData.newPassword - New password
 * @returns {Object} - Result object with success flag
 */
function resetPassword(resetData) {
    const { token, newPassword } = resetData;
    
    // Validate token
    const validation = validateResetToken(token);
    if (!validation.success) {
        return validation;
    }
    
    // Validate new password
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: 'New password must be at least 6 characters' };
    }
    
    // Get token data
    const resetTokens = getResetTokens();
    const tokenData = resetTokens[token];
    
    // Find user
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === tokenData.userId);
    
    if (userIndex === -1) {
        return { success: false, message: 'User not found' };
    }
    
    // Update password
    users[userIndex].passwordHash = simpleHash(newPassword);
    saveUsers(users);
    
    // Remove the used token
    delete resetTokens[token];
    saveResetTokens(resetTokens);
    
    return { success: true, message: 'Password reset successfully' };
}

export { 
    registerUser, 
    loginUser, 
    logoutUser, 
    getCurrentUser, 
    isSessionValid,
    updateUserProfile,
    changePassword,
    requestPasswordReset,
    validateResetToken,
    resetPassword,
    findUserByEmail
};