/**
 * Card Manager Module
 * Handles creating, managing, and ordering cards in the application
 */

// Import processSpoilerTags and toggleSpoiler functions
import { processSpoilerTags, toggleSpoiler } from './link-processor.js';

// Global counter for card numbers
let cardCounter = 1;

/**
 * Reset the card counter to 1
 */
function resetCardCounter() {
    cardCounter = 1;
}

/**
 * Create a text card for plain text or headers
 * @param {string} text - The text content to display
 * @returns {HTMLElement} - The created text card element
 */
function createTextCard(text) {
    // Check if this is a header (starts with #)
    const isHeader = text.trim().startsWith('#');
    
    const card = document.createElement('div');
    
    if (isHeader) {
        // Create a header card
        card.className = 'header-card';
        // Remove the # symbol from the display text
        const headerText = text.trim().substring(1).trim();
        card.textContent = headerText;
    } else {
        // Create a regular text card with rich text support
        card.className = 'text-card';
        
        // Check if text contains spoiler tags
        if (text.includes('//')) {
            // Process text with spoiler tags
            const processedHtml = processSpoilerTags(text);
            card.innerHTML = processedHtml;
            
            // Add click handlers for spoiler elements
            setTimeout(() => {
                const spoilers = card.querySelectorAll('.spoiler');
                spoilers.forEach(spoiler => {
                    spoiler.addEventListener('click', toggleSpoiler);
                });
            }, 0);
        } else if (text.includes('<') && text.includes('>')) {
            // Use innerHTML to preserve formatting for other HTML
            card.innerHTML = text;
        } else {
            // Plain text
            card.textContent = text;
        }
    }
    
    // Store the original text for editing (including the # for headers)
    card.dataset.originalText = text;
    
    return card;
}

/**
 * Create a link card for video or other URLs
 * @param {Object} options - Configuration options
 * @param {string} options.originalInput - The original input text (with title or context if present)
 * @param {string} options.link - The actual link URL to be played
 * @param {boolean} options.hasCustomContext - Whether the card has custom context
 * @param {string} options.customContext - The custom context text
 * @param {Function} options.onCardClick - Callback function when the card is clicked
 * @param {Function} options.getFormattedDisplay - Function to get the formatted display text
 * @returns {HTMLElement} - The created link card element
 */
function createLinkCard(options) {
    const {
        originalInput,
        link,
        hasCustomContext = false,
        customContext = '',
        onCardClick,
        getFormattedDisplay
    } = options;

    // Create card for the link
    const card = document.createElement('div');
    card.className = 'link-card';
    
    // Store the original link input (including custom title if present)
    card.dataset.originalLink = originalInput;
    
    // Store the actual link for playing the video
    card.dataset.videoLink = link;
    
    // Add card number
    const cardNumberElement = document.createElement('span');
    cardNumberElement.className = 'card-number';
    cardNumberElement.textContent = cardCounter++;
    card.appendChild(cardNumberElement);
    
    // Add play button (empty, icon added via CSS)
    const playButtonElement = document.createElement('span');
    playButtonElement.className = 'card-play-button';
    card.appendChild(playButtonElement);
    
    // Add content container
    const cardContentContainer = document.createElement('div');
    cardContentContainer.className = 'card-content-container';
    
    // Group for context and content to maintain alignment
    const contentGroup = document.createElement('div');
    contentGroup.className = 'content-group';
    
    // Add context if present
    if (hasCustomContext && customContext) {
        const contextElement = document.createElement('span');
        contextElement.className = 'card-context';
        // Use innerHTML to properly render line breaks
        contextElement.innerHTML = customContext.replace(/\n/g, '<br>');
        contentGroup.appendChild(contextElement);
    }
    
    // Add main card content (timestamp display)
    const cardContentElement = document.createElement('span');
    cardContentElement.className = 'card-content';
    
    // Format the link text (using callback for display formatting)
    if (typeof getFormattedDisplay === 'function') {
        // Use the provided formatter function
        getFormattedDisplay(link).then(displayText => {
            cardContentElement.textContent = displayText;
        });
    } else {
        // Fallback to just showing the link
        cardContentElement.textContent = link;
    }
    
    contentGroup.appendChild(cardContentElement);
    cardContentContainer.appendChild(contentGroup);
    card.appendChild(cardContentContainer);
    
    // Add click event handler
    if (typeof onCardClick === 'function') {
        card.addEventListener('click', () => {
            // Remove active class from all cards
            document.querySelectorAll('.link-card').forEach(c => {
                c.classList.remove('active');
            });
            
            // Add active class to clicked card
            card.classList.add('active');
            
            // Execute the provided click handler
            onCardClick(card.dataset.videoLink, card);
        });
    }
    
    return card;
}

/**
 * Extract all current links and text from cards in the container
 * @param {HTMLElement} container - The container element holding the cards
 * @returns {Array<string>} - Array of card contents (links or text)
 */
function getCurrentLinksFromCards(container) {
    // Get all cards (link cards, text cards, and header cards)
    const allCards = [
        ...container.querySelectorAll('.link-card'), 
        ...container.querySelectorAll('.text-card'),
        ...container.querySelectorAll('.header-card')
    ];
    
    // Sort the cards by their position in the DOM to maintain the correct order
    allCards.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    
    const contents = [];
    
    allCards.forEach(card => {
        if (card.classList.contains('link-card') && card.dataset.originalLink) {
            // Get the original link input from the data attribute (includes [Title]Link format)
            contents.push(card.dataset.originalLink);
        } else if ((card.classList.contains('text-card') || card.classList.contains('header-card')) && card.dataset.originalText) {
            // Get the text content for text and header cards
            contents.push(card.dataset.originalText);
        }
    });
    
    return contents;
}

/**
 * Clear all cards from the container and reset the card counter
 * @param {HTMLElement} container - The container element to clear
 */
function clearCards(container) {
    if (container) {
        container.innerHTML = '';
        resetCardCounter();
    }
}

/**
 * Set a card as active and clear active state from other cards
 * @param {HTMLElement} card - The card to set as active
 */
function setActiveCard(card) {
    if (!card) return;
    
    // Remove active class from all cards
    document.querySelectorAll('.link-card').forEach(c => {
        c.classList.remove('active');
    });
    
    // Add active class to the specified card
    card.classList.add('active');
}

// Export the public API
export {
    createTextCard,
    createLinkCard,
    getCurrentLinksFromCards,
    resetCardCounter,
    clearCards,
    setActiveCard
};
