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
    
    // Find the parent card element
    const parentCard = spoilerElement.closest('.text-card');
    
    if (spoilerElement.classList.contains('revealed')) {
        // Hide spoiler text again
        spoilerElement.classList.remove('revealed');
        spoilerElement.textContent = 'show answer';
        
        // Update card text alignment for hidden spoiler
        if (parentCard) {
            parentCard.classList.remove('has-revealed-spoiler');
            parentCard.classList.add('has-spoiler');
        }
    } else {
        // Reveal spoiler text
        spoilerElement.classList.add('revealed');
        spoilerElement.textContent = spoilerElement.dataset.spoilerText;
        
        // Update card text alignment for revealed spoiler
        if (parentCard) {
            parentCard.classList.remove('has-spoiler');
            parentCard.classList.add('has-revealed-spoiler');
        }
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
 * Process links from input text, including section tags
 * @param {string} inputText - The input text containing links and text
 * @returns {Array<Object>} - Array of processed items (links and text)
 */
function processInputText(inputText) {
    // Split the input into lines
    const inputs = splitAndProcessInput(inputText);
    
    // Array to store processed items
    const processedItems = [];
    
    // Track section state
    let inSection = false;
    let sectionItems = [];
    
    // Process each line
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        
        // Fix HTML entities in URLs
        const fixedInput = fixHtmlEntitiesInUrls(input);
        
        // Check for section start tag by itself
        if (fixedInput.trim() === '++/') {
            inSection = true;
            continue; // Skip the section start tag itself
        }
        
        // Check for section start tag inline with content
        if (fixedInput.trim().startsWith('++/') && fixedInput.trim() !== '++/') {
            inSection = true;
            // Extract the content after the section tag
            const content = fixedInput.trim().substring(3);
            // Process the content as a normal item
            processInlineContent(content, sectionItems, processedItems, inSection);
            continue;
        }
        
        // Check for break tag
        if (fixedInput.trim() === '---') {
            // Add a break item to processed items
            processedItems.push({
                type: 'break',
                content: '---'
            });
            continue; // Skip the break tag itself
        }
        
        // Check for section end tag by itself
        if (fixedInput.trim() === '/++') {
            // Process the section items
            if (sectionItems.length > 0) {
                processingSectionItems(sectionItems, processedItems);
                // Reset section items
                sectionItems = [];
            }
            
            inSection = false;
            continue; // Skip the section end tag itself
        }
        
        // Check for content with inline section end tag
        if (inSection && fixedInput.includes('/++')) {
            // Split the line at the section end tag
            const parts = fixedInput.split('/++');
            if (parts.length >= 2) {
                // Process the content before the section end tag
                const contentBeforeEnd = parts[0].trim();
                if (contentBeforeEnd) {
                    processInlineContent(contentBeforeEnd, sectionItems, processedItems, true);
                }
                
                // Process the section items
                if (sectionItems.length > 0) {
                    processingSectionItems(sectionItems, processedItems);
                    sectionItems = [];
                    inSection = false;
                }
                
                // Process any content after the section end tag
                const contentAfterEnd = parts.slice(1).join('/++').trim();
                if (contentAfterEnd) {
                    processInlineContent(contentAfterEnd, sectionItems, processedItems, false);
                }
                
                continue;
            }
        }
        
        // Process the current line
        processInlineContent(fixedInput, sectionItems, processedItems, inSection);
    }
    
    // Helper function to process content into the appropriate items array
    function processInlineContent(content, sectionItems, processedItems, isInSection) {
        let processedItem;
        
        // Check if the input contains a URL pattern
        const containsUrl = content.match(/https?:\/\/[^\s]+/);
        
        if (!containsUrl) {
            // This is a text entry
            processedItem = {
                type: 'text',
                content: content
            };
        } else {
            // Parse the link with any title or context tags
            const parsedLink = parseLinkWithTitle(content);
            
            // Validate the URL
            if (!isValidUrl(parsedLink.link)) {
                // If URL is invalid, treat as text
                processedItem = {
                    type: 'text',
                    content: content
                };
            } else {
                // This is a valid link
                processedItem = {
                    type: 'link',
                    originalInput: content,
                    ...parsedLink
                };
            }
        }
        
        // Add to section items if in a section, otherwise add to processed items
        if (isInSection) {
            sectionItems.push(processedItem);
        } else {
            processedItems.push(processedItem);
        }
    }
    
    // Helper function to process section items and add them to processedItems
    function processingSectionItems(items, targetArray) {
        if (items.length > 0) {
            // Add section items to targetArray with section metadata
            const firstItem = { ...items[0], isSection: true, sectionPosition: 'first' };
            
            if (items.length === 1) {
                // If there's only one item, it's both first and last
                firstItem.sectionPosition = 'first-last';
                targetArray.push(firstItem);
            } else if (items.length === 2) {
                // If there are two items, we have first and last
                targetArray.push(firstItem);
                targetArray.push({ 
                    ...items[1], 
                    isSection: true, 
                    sectionPosition: 'last' 
                });
            } else {
                // If there are more than two items, we have first, middle, and last
                targetArray.push(firstItem);
                
                // Middle items
                for (let j = 1; j < items.length - 1; j++) {
                    targetArray.push({ 
                        ...items[j], 
                        isSection: true, 
                        sectionPosition: 'middle' 
                    });
                }
                
                // Last item
                targetArray.push({ 
                    ...items[items.length - 1], 
                    isSection: true, 
                    sectionPosition: 'last' 
                });
            }
            
            return true;
        }
        
        return false;
    }
    
    // If we're still in a section at the end, add remaining section items
    // (this handles the case where a section isn't properly closed)
    if (inSection && sectionItems.length > 0) {
        processingSectionItems(sectionItems, processedItems);
    }
    
    return processedItems;
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
