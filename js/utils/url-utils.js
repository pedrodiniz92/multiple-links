/**
 * Function to check if input is a valid URL
 * @param {string} string - String to check
 * @returns {boolean} True if it's a valid URL
 */
function isValidUrl(string) {
    // Remove any formatting HTML tags before checking URL validity
    // This helps when users paste formatted URLs
    let cleanString = string;
    
    // Remove common HTML formatting tags
    cleanString = cleanString.replace(/<\/?[^>]+(>|$)/g, "");
    
    try {
        new URL(cleanString);
        return true;
    } catch (_) {
        return false;
    }
}

// Export the function globally
window.isValidUrl = isValidUrl;