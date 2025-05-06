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
    console.log('Generating shareable URL for content:', content);
    
    // Make sure content is a string
    const contentString = content.toString();
    
    // Encode the content, ensuring special characters like & in YouTube URLs are preserved
    const encodedContent = encodeURIComponent(contentString);
    console.log('Encoded content length:', encodedContent.length);
    
    const shareableUrl = `${window.location.origin}${window.location.pathname}?urls=${encodedContent}`;
    return shareableUrl;
}

/**
 * Parse URL parameters and extract content
 * @param {Function} callback - Callback function to handle extracted content
 */
async function parseUrlParams(callback) {
    const urlParams = new URLSearchParams(window.location.search);
    const urls = urlParams.get('urls');
    
    console.log('Parsing URL parameters, found urls param:', !!urls);
    
    if (urls && typeof callback === 'function') {
        try {
            const decodedContent = decodeURIComponent(urls);
            console.log('Decoded content from URL:', decodedContent);
            await callback(decodedContent);
        } catch (error) {
            console.error('Error decoding URL content:', error);
            // Try a more forgiving approach for malformed URLs
            try {
                // This is a fallback in case the standard decoding fails
                let decodedContent = urls.replace(/\+/g, ' ');
                console.log('Using fallback decoding for URL content');
                await callback(decodedContent);
            } catch (fallbackError) {
                console.error('Fallback decoding also failed:', fallbackError);
            }
        }
    }
    
    if (urls) {
        try {
            return decodeURIComponent(urls);
        } catch (error) {
            console.error('Error in final decoding of URL content:', error);
            // Return the raw URL as a last resort
            return urls.replace(/\+/g, ' ');
        }
    }
    
    return null;
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
