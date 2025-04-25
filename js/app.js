// Main orchestrator, initialization and core setup

// Import modules
import initPanelResizer from './components/panel-resizer.js';
import { 
    createTextCard, 
    createLinkCard, 
    getCurrentLinksFromCards, 
    resetCardCounter,
    clearCards,
    setActiveCard 
} from './components/card-manager.js';
import {
    parseLinkWithTitle,
    isValidUrl,
    fixHtmlEntitiesInUrls,
    processInputText
} from './components/link-processor.js';

// DOM elements
let resizer, leftPanel, rightPanel, goButton, linksContainer, viewer;
let clipboardFeedback, themeToggleIcon, htmlElement, urlInput, inputSection;

// Initialize DOM elements
function initDOMElements() {
    // Panel elements
    resizer = document.getElementById('resizer');
    leftPanel = document.getElementById('left-panel');
    rightPanel = document.getElementById('right-panel');
    
    // Content and interaction elements
    goButton = document.getElementById('go-button');
    linksContainer = document.getElementById('links-container');
    viewer = document.getElementById('viewer');
    
    // Theme and UI elements
    clipboardFeedback = document.getElementById('clipboard-feedback');
    themeToggleIcon = document.getElementById('theme-toggle-icon');
    htmlElement = document.documentElement;
    urlInput = document.getElementById('url-input');
    inputSection = document.querySelector('.input-section');
}

// Toggle visibility of the input section
function toggleInputSection(show) {
    if (inputSection) {
        inputSection.style.display = show ? 'block' : 'none';
    }
}

// Initialize panel resizer functionality
function initPanelResizing() {
    if (resizer && leftPanel && rightPanel) {
        // Initialize with default settings
        const panelResizer = initPanelResizer({
            resizer,
            leftPanel,
            rightPanel,
            onResize: () => {
                // This will be used for responsive UI updates in future steps
                if (typeof updateIconSizes === 'function') {
                    updateIconSizes();
                }
            }
        });
        
        // Expose to window for easy console testing
        window.panelResizer = panelResizer;
        
        console.log('Panel resizer initialized successfully');
    } else {
        console.error('Could not initialize panel resizer - required DOM elements not found');
    }
}

// Process links from the input field
// Now uses the link-processor.js module for advanced parsing
async function processLinks() {
    console.log('Processing links...');
    
    // Clear existing content and reset counter
    clearCards(linksContainer);
    
    if (!urlInput || !linksContainer) {
        console.error('Required DOM elements not found');
        return;
    }
    
    // Process the input text into structured items (links and text)
    const processedItems = processInputText(urlInput.value);
    
    // Track the first link card for automatic activation
    let firstLinkCard = null;
    
    // Keep track of the last videoId to group related clips under one title
    let lastVideoId = null;
    
    // Process each item and create appropriate cards
    for (const item of processedItems) {
        if (item.type === 'text') {
            // Create a text card
            const textCard = createTextCard(item.content);
            linksContainer.appendChild(textCard);
        } else if (item.type === 'link') {
            // For links, first check if we should display a title
            if (item.hasCustomTitle && item.customTitle) {
                // Create a video title element (will be displayed above the cards)
                const titleElement = document.createElement('div');
                titleElement.className = 'video-title';
                titleElement.textContent = item.customTitle;
                
                // Store original data
                titleElement.dataset.originalInput = item.originalInput;
                
                // Add to container
                linksContainer.appendChild(titleElement);
            }
            
            // Then create the link card (without the title in the card itself)
            const card = createLinkCard({
                originalInput: item.originalInput,
                link: item.link,
                hasCustomContext: item.hasCustomContext,
                customContext: item.customContext,
                onCardClick: (videoLink) => {
                    console.log('Card clicked, video link:', videoLink);
                    // In a future step, this will call loadVideo from the video service
                },
                getFormattedDisplay: async (link) => {
                    // For now, just show a simplified display with the URL or timestamp
                    // In future steps, this will be replaced with proper timestamp formatting
                    return link.substring(0, 50) + (link.length > 50 ? '...' : '');
                }
            });
            
            linksContainer.appendChild(card);
            
            // Save the first link card for activation
            if (!firstLinkCard) {
                firstLinkCard = card;
            }
        }
    }
    
    // Activate the first link card if one exists
    if (firstLinkCard) {
        setActiveCard(firstLinkCard);
    }
    
    console.log('Link processing complete');
}

// Set up event listeners
function setupEventListeners() {
    // Go button event listener
    if (goButton) {
        goButton.addEventListener('click', async () => {
            // On Go button click, add new links to existing ones
            await processLinks();
            toggleInputSection(false); // Hide input after processing links
        });
    }
    
    // Edit text icon listener - show input section when clicked
    const editTextIcon = document.getElementById('edit-text-icon');
    if (editTextIcon) {
        editTextIcon.addEventListener('click', () => {
            // If we already have cards, get their content to allow editing
            if (linksContainer && linksContainer.children.length > 0) {
                // Get current links and text from cards
                const contents = getCurrentLinksFromCards(linksContainer);
                
                // Set the input value to the current content
                if (urlInput && contents.length > 0) {
                    urlInput.value = contents.join('\n');
                }
            }
            
            // Show the input section
            toggleInputSection(true);
            
            // Focus the input
            if (urlInput) {
                urlInput.focus();
            }
        });
    }
}

// Initialize responsive toolbar (placeholder for future implementation)
function initResponsiveToolbar() {
    console.log('Responsive toolbar will be implemented in a future step');
}

// Update icon sizes (placeholder for future implementation)
function updateIconSizes() {
    console.log('Icon sizes update will be implemented in a future step');
}

// Initialize rich text editor (placeholder for future implementation)
function initRichTextEditor() {
    console.log('Rich text editor will be implemented in Step 11');
    
    // Make sure the textarea is visible and working for now
    const urlInput = document.getElementById('url-input');
    if (urlInput) {
        urlInput.style.display = 'block';
    }
    
    // Hide the rich editor until it's implemented
    const richEditor = document.getElementById('rich-editor');
    if (richEditor) {
        richEditor.style.display = 'none';
    }
}

// Parse URL parameters (placeholder for future implementation)
function parseUrlParams() {
    console.log('URL parameter parsing will be implemented in a future step');
}

// Main initialization function
function initApplication() {
    console.log('Initializing application...');
    
    // Initialize DOM elements first
    initDOMElements();
    
    // Set up core functionality
    initPanelResizing();
    setupEventListeners();
    
    console.log('Core application initialization complete');
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApplication);

// Execute on page load for components that need the full page to be loaded
window.addEventListener('load', function() {
    // Initialize the rich text editor
    initRichTextEditor();
    
    // Parse URL parameters if present
    parseUrlParams();
    
    // Initialize responsive toolbar
    initResponsiveToolbar();
    
    // Also update when panel is resized (using the mouseup event)
    if (resizer) {
        resizer.addEventListener('mouseup', function() {
            // Update immediately and also after a small delay to catch any layout changes
            updateIconSizes();
            
            // Additional update after layout settles
            setTimeout(updateIconSizes, 100);
        });
    }
    
    console.log('Page load initialization complete');
});
