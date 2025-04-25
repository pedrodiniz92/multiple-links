/**
 * URL Service Module
 * Handles URL validation, parameter handling, and sharing functionality
 */

/**
 * Validate if a string is a valid URL
 * @param {string} string - The string to validate as a URL
 * @returns {boolean} - True if the string is a valid URL
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

/**
 * Normalize a URL by cleaning up common issues
 * @param {string} url - The URL to normalize
 * @returns {string} - The normalized URL
 */
function normalizeUrl(url) {
    if (!url) return '';
    
    // Trim whitespace
    let normalizedUrl = url.trim();
    
    // Ensure protocol is present
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + normalizedUrl;
    }
    
    try {
        // Use URL API to standardize the URL
        const urlObj = new URL(normalizedUrl);
        return urlObj.toString();
    } catch (e) {
        // If URL parsing fails, return the input with basic cleanup
        return normalizedUrl;
    }
}

/**
 * Generate a shareable URL based on the provided content
 * @param {string} content - The content to encode in the URL
 * @returns {string} - The shareable URL
 */
function generateShareableUrl(content) {
    const encodedContent = encodeURIComponent(content);
    return `${window.location.origin}${window.location.pathname}?urls=${encodedContent}`;
}

/**
 * Parse URL parameters and extract content
 * @param {Function} callback - Callback function to handle extracted content
 */
async function parseUrlParams(callback) {
    const urlParams = new URLSearchParams(window.location.search);
    const urls = urlParams.get('urls');
    
    if (urls && typeof callback === 'function') {
        const decodedContent = decodeURIComponent(urls);
        await callback(decodedContent);
    }
    
    return urls ? decodeURIComponent(urls) : null;
}

/**
 * Extract parameters from a URL
 * @param {string} url - The URL to extract parameters from
 * @returns {Object} - An object containing the URL parameters
 */
function extractUrlParams(url) {
    try {
        const urlObj = new URL(url);
        const params = {};
        
        for (const [key, value] of urlObj.searchParams.entries()) {
            params[key] = value;
        }
        
        return params;
    } catch (e) {
        return {};
    }
}

/**
 * Clean up a URL by removing tracking parameters
 * @param {string} url - The URL to clean
 * @returns {string} - The cleaned URL
 */
function cleanupUrl(url) {
    try {
        const urlObj = new URL(url);
        
        // Common tracking parameters to remove
        const trackingParams = [
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'fbclid', 'gclid', 'msclkid', 'ref', 'referrer', 'source'
        ];
        
        // Remove tracking parameters
        trackingParams.forEach(param => {
            urlObj.searchParams.delete(param);
        });
        
        return urlObj.toString();
    } catch (e) {
        return url;
    }
}

// Export the public API
export {
    isValidUrl,
    normalizeUrl,
    generateShareableUrl,
    parseUrlParams,
    extractUrlParams,
    cleanupUrl
};
