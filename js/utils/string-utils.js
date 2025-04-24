/**
 * Decode HTML entities in a string
 * @param {string} text - Text with HTML entities
 * @returns {string} Decoded text
 */
function decodeHTMLEntities(text) {
    const element = document.createElement('div');
    element.innerHTML = text;
    return element.textContent;
}

/**
 * Fix HTML entities in URLs
 * @param {string} text - Text that may contain URLs with HTML entities
 * @returns {string} Text with fixed URLs
 */
function fixHtmlEntitiesInUrls(text) {
    if (!text) return text;
    
    // Regex to find URLs in text
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Replace each URL with decoded version
    return text.replace(urlRegex, (url) => {
        // Handle &amp; in URLs
        let decodedUrl = url.replace(/&amp;/g, '&');
        
        // Handle other common HTML entities in URLs
        decodedUrl = decodedUrl.replace(/&lt;/g, '<');
        decodedUrl = decodedUrl.replace(/&gt;/g, '>');
        decodedUrl = decodedUrl.replace(/&quot;/g, '"');
        
        return decodedUrl;
    });
}

// Export the functions globally
window.decodeHTMLEntities = decodeHTMLEntities;
window.fixHtmlEntitiesInUrls = fixHtmlEntitiesInUrls;