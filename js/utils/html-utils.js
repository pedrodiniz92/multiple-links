/**
 * HTML Utilities Module
 * Handles HTML entity encoding/decoding and HTML manipulation utilities
 */

/**
 * Fix HTML entities in URLs (like &amp; to &)
 * @param {string} text - The text containing URLs with HTML entities
 * @returns {string} - The text with HTML entities in URLs fixed
 */
function fixHtmlEntitiesInUrls(text) {
    // Look for URL patterns and fix any HTML entities within them
    let fixedText = text;
    
    // Define a regex to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Replace any HTML entities in the URLs
    fixedText = fixedText.replace(urlRegex, (match) => {
        return match
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    });
    
    return fixedText;
}

/**
 * Decode HTML entities to their corresponding characters
 * @param {string} text - The text containing HTML entities
 * @returns {string} - The decoded text
 */
function decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - The plain text to escape
 * @returns {string} - HTML-escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Strip HTML tags from a string
 * @param {string} html - The HTML string to strip
 * @returns {string} - The text with HTML tags removed
 */
function stripHtmlTags(html) {
    return html.replace(/<\/?[^>]+(>|$)/g, "");
}

/**
 * Convert HTML content to plain text
 * @param {string} html - The HTML content
 * @returns {string} - The plain text version
 */
function htmlToText(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
}

/**
 * Check if a string contains HTML tags
 * @param {string} text - The string to check
 * @returns {boolean} - True if HTML tags are present
 */
function containsHtml(text) {
    return /<[a-z][\s\S]*>/i.test(text);
}

// Export the public API
export {
    fixHtmlEntitiesInUrls,
    decodeHTMLEntities,
    escapeHtml,
    stripHtmlTags,
    htmlToText,
    containsHtml
};
