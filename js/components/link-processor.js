/**
 * Link Processor Module
 * Handles link parsing, title/context tags, spoiler tags and link validation
 */

// Import the HTML utilities 
import { fixHtmlEntitiesInUrls } from '../utils/html-utils.js';

/**
 * Process spoiler tags in text content
 * @param {string} text - The text to process for spoiler tags
 * @returns {string} - Text with spoiler tags converted to HTML elements
 */
function processSpoilerTags(text) {
    // Replace spoiler tags with HTML elements
    // Pattern: match text between // tags, but not greedy (non-greedy match with .*?)
    return text.replace(/\/\/(.*?)\/\//g, '<span class="spoiler" data-spoiler-text="$1">show answer</span>');
}

/**
 * Toggle a spoiler element between hidden and revealed states
 * @param {Event} event - The click event
 */
function toggleSpoiler(event) {
    const spoilerElement = event.currentTarget;
    
    if (spoilerElement.classList.contains('revealed')) {
        // Hide spoiler text again
        spoilerElement.classList.remove('revealed');
        spoilerElement.textContent = 'show answer';
    } else {
        // Reveal spoiler text
        spoilerElement.classList.add('revealed');
        spoilerElement.textContent = spoilerElement.dataset.spoilerText;
    }
}

/**
 * Check if a string is a valid URL
 * @param {string} string - The string to check
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
 * Parse a link with optional title and context tags
 * @param {string} input - The input string to parse
 * @returns {Object} - Parsed components (title, context, link, etc.)
 */
function parseLinkWithTitle(input) {
    // First, fix any HTML entity conversions in URLs
    // This will convert &amp; back to & for URL parameters
    const fixedInput = fixHtmlEntitiesInUrls(input);
    
    let link = fixedInput;
    let customTitle = null;
    let customContext = null;
    let hasCustomTitle = false;
    let hasCustomContext = false;
    let skipTitle = false;
    
    // Regular expressions for detecting tagged components
    const titleTagRegex = /\[t:(.*?)\]/;
    const contextTagRegex = /\[c:(.*?)\]/;
    
    // Process both tags in any order by iteratively checking for them
    // This allows for [t:Title][c:Context]Link or [c:Context][t:Title]Link
    let currentLink = fixedInput;
    let foundTag = true;
    
    // Keep checking for tags until no more are found at the beginning of the string
    while (foundTag && currentLink.startsWith('[')) {
        // Check for context tag
        if (currentLink.startsWith('[c:')) {
            const contextMatch = currentLink.match(contextTagRegex);
            if (contextMatch) {
                hasCustomContext = true;
                // Replace // with line breaks in context
                customContext = contextMatch[1].replace(/\/\//g, '\n');
                // Remove the context tag from input
                currentLink = currentLink.substring(contextMatch[0].length);
                // Continue looking for more tags
                continue;
            }
        }
        
        // Check for title tag
        if (currentLink.startsWith('[t:')) {
            const titleMatch = currentLink.match(titleTagRegex);
            if (titleMatch) {
                hasCustomTitle = true;
                customTitle = titleMatch[1];
                skipTitle = customTitle === ''; // Skip title if it's empty
                // Remove the title tag from input
                currentLink = currentLink.substring(titleMatch[0].length);
                // Continue looking for more tags
                continue;
            }
        }
        
        // If we got here, no valid tag was found, exit the loop
        foundTag = false;
    }
    
    // Update link to the current state after processing all tags
    link = currentLink;
    
    // Always skip title unless a non-empty title tag was found
    skipTitle = !hasCustomTitle || customTitle === '';
    
    return {
        hasCustomTitle,
        customTitle,
        hasCustomContext,
        customContext,
        link,
        skipTitle
    };
}

/**
 * Split and process input into an array of lines
 * @param {string} input - The input text
 * @returns {Array<string>} - Array of processed input lines
 */
function splitAndProcessInput(input) {
    // Split the input by line breaks and filter out empty lines
    return input.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

/**
 * Process links from input text
 * @param {string} inputText - The input text containing links and text
 * @returns {Array<Object>} - Array of processed items (links and text)
 */
function processInputText(inputText) {
    // Split the input into lines
    const inputs = splitAndProcessInput(inputText);
    
    // Process each line
    return inputs.map(input => {
        // Fix HTML entities in URLs
        const fixedInput = fixHtmlEntitiesInUrls(input);
        
        // Check if the input contains a URL pattern
        const containsUrl = fixedInput.match(/https?:\/\/[^\s]+/);
        
        if (!containsUrl) {
            // This is a text entry
            return {
                type: 'text',
                content: fixedInput
            };
        } else {
            // Parse the link with any title or context tags
            const parsedLink = parseLinkWithTitle(fixedInput);
            
            // Validate the URL
            if (!isValidUrl(parsedLink.link)) {
                // If URL is invalid, treat as text
                return {
                    type: 'text',
                    content: fixedInput
                };
            }
            
            // This is a valid link
            return {
                type: 'link',
                originalInput: fixedInput,
                ...parsedLink
            };
        }
    });
}

// Export the public API
export {
    fixHtmlEntitiesInUrls,
    isValidUrl,
    parseLinkWithTitle,
    splitAndProcessInput,
    processInputText,
    processSpoilerTags,
    toggleSpoiler
};
