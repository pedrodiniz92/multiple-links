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
    fixHtmlEntitiesInUrls,
    processInputText
} from './components/link-processor.js';
import {
    isValidUrl,
    normalizeUrl,
    generateShareableUrl,
    parseUrlParams,
    cleanupUrl
} from './services/url-service.js';
import {
    isYouTubeUrl,
    loadYouTubeVideo,
    extractYouTubeInfo,
    generateYouTubeEmbedUrl
} from './services/youtube-service.js';

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
            
            // Extract YouTube info if it's a YouTube URL
            let videoInfo = null;
            if (isYouTubeUrl(item.link)) {
                videoInfo = extractYouTubeInfo(item.link);
            }
            
            // Then create the link card (without the title in the card itself)
            const card = createLinkCard({
                originalInput: item.originalInput,
                link: item.link,
                hasCustomContext: item.hasCustomContext,
                customContext: item.customContext,
                onCardClick: (videoLink) => {
                    console.log('Card clicked, video link:', videoLink);
                    // Load the video into the iframe
                    loadVideo(videoLink);
                },
                getFormattedDisplay: async (link) => {
                    // If it's a YouTube URL with time parameters, format the display
                    if (videoInfo && videoInfo.videoId) {
                        const { params } = videoInfo;
                        let formattedTime = '';
                        
                        // Start time only
                        if (params.start && !params.end) {
                            return formatTime(params.start);
                        }
                        
                        // Both start and end times
                        if (params.start && params.end) {
                            return `${formatTime(params.start)} - ${formatTime(params.end)}`;
                        }
                        
                        // End time only
                        if (!params.start && params.end) {
                            return `- ${formatTime(params.end)}`;
                        }
                    }
                    
                    // If there's a custom title, use it
                    if (item.hasCustomTitle && item.customTitle) {
                        return item.customTitle;
                    }
                    
                    // Fallback to a truncated URL
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
    
    // Share icon listener - generate shareable URL
    const shareIcon = document.getElementById('share-icon');
    if (shareIcon) {
        shareIcon.addEventListener('click', () => {
            // Only generate a URL if we have content
            if (linksContainer && linksContainer.children.length > 0) {
                // Get current links and text from cards
                const contents = getCurrentLinksFromCards(linksContainer);
                
                if (contents.length > 0) {
                    // Generate shareable URL from the current content
                    const shareableUrl = generateShareableUrl(contents.join('\n'));
                    
                    // Copy to clipboard
                    navigator.clipboard.writeText(shareableUrl)
                        .then(() => {
                            // Show feedback to user
                            if (clipboardFeedback) {
                                clipboardFeedback.textContent = 'Shareable link copied to clipboard!';
                                clipboardFeedback.style.opacity = 1;
                                
                                // Hide the feedback after 2 seconds
                                setTimeout(() => {
                                    clipboardFeedback.style.opacity = 0;
                                }, 2000);
                            }
                            
                            console.log('Shareable URL copied to clipboard:', shareableUrl);
                        })
                        .catch(err => {
                            console.error('Failed to copy to clipboard:', err);
                        });
                }
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

/**
 * Format a time in seconds to a readable format (H:MM:SS or MM:SS)
 * @param {number} seconds - The time in seconds
 * @returns {string} - Formatted time string
 */
function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '';
    
    // Convert to number if it's a string
    const totalSeconds = parseInt(seconds, 10);
    
    // Calculate hours, minutes and remaining seconds
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    
    // Pad with leading zeros
    const paddedSeconds = remainingSeconds.toString().padStart(2, '0');
    
    if (hours > 0) {
        // Format as H:MM:SS for videos longer than an hour
        const paddedMinutes = minutes.toString().padStart(2, '0');
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    } else {
        // Format as MM:SS for videos under an hour
        return `${minutes}:${paddedSeconds}`;
    }
}

/**
 * Load a video into the viewer iframe
 * @param {string} url - The URL to load
 * @returns {boolean} - True if loading was successful
 */
function loadVideo(url) {
    if (!url || !viewer) {
        console.error('Invalid URL or viewer iframe not found');
        return false;
    }
    
    console.log('Loading video:', url);
    
    // Check if it's a YouTube URL
    if (isYouTubeUrl(url)) {
        return loadYouTubeVideo(url, viewer);
    } else {
        // For non-YouTube URLs, load directly
        try {
            // Ensure URL uses HTTPS for security
            let secureUrl = url;
            if (url.startsWith('http:')) {
                secureUrl = url.replace('http:', 'https:');
                console.log('Upgrading URL to HTTPS for security');
            }
            
            viewer.src = secureUrl;
            return true;
        } catch (error) {
            console.error('Error loading non-YouTube URL:', error);
            return false;
        }
    }
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

// Parse URL parameters from the query string
async function handleUrlParams() {
    console.log('Parsing URL parameters...');
    
    // Use the url-service module to parse URL parameters
    const urlContent = await parseUrlParams(async (content) => {
        if (content && urlInput) {
            // Set the input value to the content from URL parameters
            urlInput.value = content;
            
            // Process the links from the URL parameters
            await processLinks();
            
            // Hide the input section after processing
            toggleInputSection(false);
        }
    });
    
    return urlContent !== null;
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
window.addEventListener('load', async function() {
    // Initialize the rich text editor
    initRichTextEditor();
    
    // Parse URL parameters if present
    await handleUrlParams();
    
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
