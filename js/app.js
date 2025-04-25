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
import {
    fetchVideoTitle,
    getVideoDuration,
    getVideoDetails,
    storeCustomVideoTitle
} from './services/video-info.js';
import initThemeManager from './ui/theme-manager.js';
import initFeedback from './ui/feedback.js';
import initResponsiveUI from './ui/responsive-ui.js';
import initRichEditor from './editor/rich-editor.js';
import initYouTubeModal from './editor/youtube-modal.js';
import { formatTime } from './utils/time-utils.js';

// DOM elements
let resizer, leftPanel, rightPanel, goButton, linksContainer, viewer;
let clipboardFeedback, themeToggleIcon, htmlElement, urlInput, inputSection;
let richEditor, editorContainer, addYouTubeBtn;

// YouTube modal elements
let youtubeModal, modalFeedback, youtubeUrlInput, youtubeTitleInput, youtubeContextInput;
let startTimeInput, endTimeInput, fetchTitleBtn, insertLinkBtn, cancelBtn, lineBreakBtn;

// Module instances
let richEditorInstance;
let youtubeModalInstance;

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
    
    // Rich editor elements
    richEditor = document.getElementById('rich-editor');
    editorContainer = document.getElementById('editor-container');
    addYouTubeBtn = document.getElementById('add-youtube-link');
    
    // YouTube modal elements
    youtubeModal = document.getElementById('add-youtube-modal');
    modalFeedback = document.getElementById('modal-title-feedback');
    youtubeUrlInput = document.getElementById('youtube-url');
    youtubeTitleInput = document.getElementById('youtube-title');
    youtubeContextInput = document.getElementById('youtube-context');
    startTimeInput = document.getElementById('youtube-start-time');
    endTimeInput = document.getElementById('youtube-end-time');
    fetchTitleBtn = document.getElementById('fetch-youtube-title-btn');
    insertLinkBtn = document.getElementById('insert-youtube-link-btn');
    cancelBtn = document.getElementById('cancel-youtube-link-btn');
    lineBreakBtn = document.getElementById('add-linebreak-btn');
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
            let videoTitle = null;
            
            // If there is a custom title in the link, use it for display
            if (item.hasCustomTitle && item.customTitle) {
                videoTitle = item.customTitle;
            }
            
            // If it's a YouTube URL, get detailed info
            if (isYouTubeUrl(item.link)) {
                videoInfo = extractYouTubeInfo(item.link);
                
                // If no custom title was provided, try to display the video title from YouTube if available
                if (!item.hasCustomTitle && videoInfo && videoInfo.videoId) {
                    // For title display in the title element, fetch video title in background
                    fetchVideoTitle(videoInfo.videoId).then(title => {
                        if (!item.hasCustomTitle && title) {
                            // Create a video title element if it doesn't already exist
                            if (!document.querySelector(`.video-title[data-video-id="${videoInfo.videoId}"]`)) {
                                const titleElement = document.createElement('div');
                                titleElement.className = 'video-title';
                                titleElement.textContent = title;
                                titleElement.dataset.videoId = videoInfo.videoId;
                                
                                // If the card is still in the DOM, add the title before it
                                if (document.contains(card) && card.parentNode) {
                                    card.parentNode.insertBefore(titleElement, card);
                                }
                            }
                        }
                    }).catch(e => {
                        console.warn('Error fetching video title:', e);
                    });
                }
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
                        const { videoId, params } = videoInfo;
                        
                        // First try to get the video title if possible
                        try {
                            // Get video details in the background
                            getVideoDetails(videoId).then(details => {
                                if (details) {
                                    // Format the display text based on timestamps
                                    let displayText;
                                    
                                    // Always prioritize showing timestamps 
                                    // Start time only
                                    if (params.start && !params.end) {
                                        displayText = formatTime(params.start);
                                    }
                                    // Both start and end times
                                    else if (params.start && params.end) {
                                        displayText = `${formatTime(params.start)} - ${formatTime(params.end)}`;
                                    }
                                    // End time only
                                    else if (!params.start && params.end) {
                                        displayText = `0:00 - ${formatTime(params.end)}`;
                                    }
                                    // Full video case - show 0:00 to end
                                    else if (details.durationSeconds) {
                                        displayText = `0:00 - ${formatTime(details.durationSeconds)}`;
                                    }
                                    // Fallback to title with duration
                                    else if (details.title) {
                                        displayText = details.title;
                                        if (details.formattedDuration) {
                                            displayText += ` (${details.formattedDuration})`;
                                        }
                                    }
                                    
                                    // Update the card content if it's still in the DOM
                                    if (document.contains(card)) {
                                        const contentElement = card.querySelector('.card-content');
                                        if (contentElement) {
                                            contentElement.textContent = displayText;
                                        }
                                    }
                                }
                            });
                        } catch (e) {
                            console.warn('Error fetching video details:', e);
                        }
                        
                        // Meanwhile, show an initial display
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
                            return `0:00 - ${formatTime(params.end)}`;
                        }
                        
                        // No timestamps yet, show loading indicator (will be replaced with full duration)
                        return 'Loading timestamp...';
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
                
                if (contents.length > 0) {
                    const joinedContent = contents.join('\n');
                    
                    // Set content in rich editor if available
                    if (richEditorInstance && richEditorInstance.getQuill()) {
                        richEditorInstance.setQuillContent(joinedContent);
                    } else if (urlInput) {
                        // Fallback to textarea
                        urlInput.value = joinedContent;
                    }
                }
            }
            
            // Show the input section
            toggleInputSection(true);
            
            // Focus the editor
            if (richEditorInstance) {
                richEditorInstance.focus();
            } else if (urlInput) {
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
                    
                    // If we have the feedback system initialized, use it
                    if (feedbackSystem) {
                        feedbackSystem.copyToClipboard(
                            shareableUrl, 
                            'Link copied!'
                        );
                        
                        // Update browser URL without reloading the page
                        window.history.pushState({}, '', shareableUrl);
                        
                        console.log('Shareable URL copied to clipboard using feedback system');
                    } else {
                        // Fallback to direct clipboard API if feedback system isn't ready
                        navigator.clipboard.writeText(shareableUrl)
                            .then(() => {
                                // Show feedback to user
                                if (clipboardFeedback) {
                                    clipboardFeedback.textContent = 'Link copied!';
                                    clipboardFeedback.style.opacity = 1;
                                    
                                    // Hide the feedback after 1.7 seconds
                                    setTimeout(() => {
                                        clipboardFeedback.style.opacity = 0;
                                    }, 1700);
                                }
                                
                                // Update browser URL without reloading the page
                                window.history.pushState({}, '', shareableUrl);
                                
                                console.log('Shareable URL copied to clipboard:', shareableUrl);
                            })
                            .catch(err => {
                                console.error('Failed to copy to clipboard:', err);
                            });
                    }
                }
            }
        });
    }
}

// Initialize responsive toolbar 
function initResponsiveToolbar() {
    const toolbar = document.querySelector('.toolbar-container');
    const toolbarIcons = document.querySelectorAll('.toolbar-icon');
    const iconImages = document.querySelectorAll('.toolbar-icon img, .theme-icon-light, .theme-icon-dark');
    
    if (toolbar && toolbarIcons.length > 0) {
        responsiveUI = initResponsiveUI({
            toolbar,
            toolbarIcons,
            iconImages,
            sizes: {
                defaultIconSize: 36, // px
                defaultImageSize: 20, // px
                minScale: 0.85     // Minimum scaling factor (85%)
            }
        });
        
        if (responsiveUI) {
            responsiveUI.initialize();
            console.log('Responsive toolbar initialized successfully');
        } else {
            console.error('Failed to initialize responsive toolbar');
        }
    } else {
        console.error('Required DOM elements for responsive toolbar not found');
    }
}

// Update icon sizes - Forwards to the responsive UI module
function updateIconSizes() {
    if (responsiveUI) {
        responsiveUI.updateIconSizes();
    }
}

// formatTime is now imported from './utils/time-utils.js'

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
        const result = loadYouTubeVideo(url, viewer);
        
        // Update the global viewer reference to the new iframe
        // This ensures subsequent clicks work properly
        if (result) {
            const viewerId = viewer.id || 'viewer';
            const newViewer = document.getElementById(viewerId);
            if (newViewer) {
                viewer = newViewer;
                console.log('Updated viewer reference to new iframe element');
            } else {
                console.warn('Could not find new iframe element with ID:', viewerId);
            }
        }
        
        return result;
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

/**
 * Initialize rich text editor with robust error handling
 * @returns {boolean} Whether initialization was successful
 */
function initRichTextEditor() {
    console.log('Initializing rich text editor...');
    
    if (!richEditor || !urlInput || !editorContainer) {
        console.error('Required DOM elements for rich editor not found');
        
        // Fallback to textarea if rich editor can't be initialized
        if (urlInput) {
            urlInput.style.display = 'block';
        }
        
        return false;
    }
    
    // Check if Quill is loaded
    if (typeof Quill === 'undefined') {
        console.error('Quill library not loaded');
        
        // Show loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'editor-loading-message';
        loadingMsg.textContent = 'Loading editor...';
        
        // Insert before textarea
        if (urlInput.parentNode) {
            urlInput.parentNode.insertBefore(loadingMsg, urlInput);
        }
        
        // Try to load Quill dynamically
        const script = document.createElement('script');
        script.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
        script.onload = () => {
            console.log('Quill loaded successfully from CDN');
            
            // Also load CSS if needed
            if (!document.querySelector('link[href*="quill.snow.css"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
                document.head.appendChild(link);
            }
            
            // Remove loading message
            if (loadingMsg.parentNode) {
                loadingMsg.parentNode.removeChild(loadingMsg);
            }
            
            // Initialize after a short delay to ensure DOM is ready
            setTimeout(() => {
                initRichTextEditor();
            }, 200);
        };
        
        script.onerror = () => {
            console.error('Failed to load Quill from CDN');
            // Show error message
            loadingMsg.textContent = 'Failed to load editor. Using plain text mode.';
            loadingMsg.className = 'editor-error-message';
            
            // Show textarea
            urlInput.style.display = 'block';
        };
        
        document.head.appendChild(script);
        
        // Return false as initialization failed (but will be attempted again)
        return false;
    }
    
    // Initialize the rich editor module
    richEditorInstance = initRichEditor({
        editorContainer,
        richEditor,
        urlInput,
        addYouTubeBtn,
        onContentChange: (content) => {
            // Optional callback when content changes
            // Could be used for auto-saving or other features
        }
    });
    
    // Initialize the editor
    if (richEditorInstance) {
        const initSuccess = richEditorInstance.initialize();
        
        if (!initSuccess) {
            console.error('Failed to initialize rich editor, falling back to textarea');
            // Show textarea as fallback
            urlInput.style.display = 'block';
            
            // Add retry button
            const retryBtn = document.createElement('button');
            retryBtn.textContent = 'Retry Editor Loading';
            retryBtn.className = 'retry-editor-button';
            retryBtn.addEventListener('click', () => {
                retryBtn.parentNode.removeChild(retryBtn);
                initRichTextEditor();
            });
            
            // Add before textarea
            if (urlInput.parentNode) {
                urlInput.parentNode.insertBefore(retryBtn, urlInput);
            }
            
            return false;
        }
        
        // Initialize YouTube modal after editor is ready
        initYouTubeModalDialog();
        
        return true;
    } else {
        console.error('Rich editor instance could not be created');
        // Fallback to textarea
        urlInput.style.display = 'block';
        return false;
    }
}

// Initialize YouTube link modal
function initYouTubeModalDialog() {
    console.log('Initializing YouTube modal dialog...');
    
    if (!youtubeModal || !modalFeedback || !youtubeUrlInput || !richEditorInstance) {
        console.error('Required DOM elements for YouTube modal not found or rich editor not initialized');
        return false;
    }
    
    // Initialize the YouTube modal module
    youtubeModalInstance = initYouTubeModal({
        modalElement: youtubeModal,
        modalFeedback,
        youtubeUrlInput,
        youtubeTitleInput,
        youtubeContextInput,
        startTimeInput,
        endTimeInput,
        fetchTitleBtn,
        insertLinkBtn,
        cancelBtn,
        lineBreakBtn,
        richEditorInstance,
        showFeedbackMessage: (element, isModal = false) => {
            // Use the feedback system if available, or create a simple animation otherwise
            if (feedbackSystem && typeof feedbackSystem.showFeedbackMessage === 'function') {
                feedbackSystem.showFeedbackMessage(element, isModal);
            } else {
                // Fallback animation
                element.style.display = 'block';
                element.style.opacity = '1';
                
                setTimeout(() => {
                    element.style.opacity = '0';
                    setTimeout(() => {
                        element.style.display = 'none';
                    }, 500);
                }, 2000);
            }
        }
    });
    
    // Wire up the YouTube button to show the modal
    if (addYouTubeBtn && youtubeModalInstance) {
        // Remove any existing listeners to avoid duplicates
        const newYouTubeBtn = addYouTubeBtn.cloneNode(true);
        if (addYouTubeBtn.parentNode) {
            addYouTubeBtn.parentNode.replaceChild(newYouTubeBtn, addYouTubeBtn);
            // Update the reference
            addYouTubeBtn = newYouTubeBtn;
        }
        
        // Add click event to show the modal
        addYouTubeBtn.addEventListener('click', () => {
            youtubeModalInstance.showModal();
        });
        
        console.log('YouTube modal initialized successfully');
        return true;
    } else {
        console.error('YouTube modal initialization failed');
        return false;
    }
}

// Parse URL parameters from the query string
async function handleUrlParams() {
    console.log('Parsing URL parameters...');
    
    // Use the url-service module to parse URL parameters
    const urlContent = await parseUrlParams(async (content) => {
        if (content) {
            if (richEditorInstance && richEditorInstance.getQuill()) {
                // Set content in rich editor if available
                richEditorInstance.setQuillContent(content);
            } else if (urlInput) {
                // Fallback to textarea
                urlInput.value = content;
            }
            
            // Process the links from the URL parameters
            await processLinks();
            
            // Hide the input section after processing
            toggleInputSection(false);
        }
    });
    
    return urlContent !== null;
}

// Global references
let themeManager;
let feedbackSystem;
let responsiveUI;

// Add a utility function to check if Quill is properly loaded
function checkQuillStatus() {
    // Check if Quill is loaded
    const quillLoaded = typeof Quill !== 'undefined';
    
    // Check if our richEditorInstance exists and has Quill
    const instanceExists = !!richEditorInstance;
    const quillInstanceExists = instanceExists && !!richEditorInstance.getQuill();
    
    console.log('Quill Status:', {
        quillLoaded,
        instanceExists,
        quillInstanceExists
    });
    
    // Return detailed status
    return {
        quillLoaded,
        instanceExists,
        quillInstanceExists,
        canReinitialize: quillLoaded && instanceExists
    };
}

// Add a utility function to reset the editor in case of problems
function resetRichEditor() {
    // First check status
    const status = checkQuillStatus();
    
    if (!status.quillLoaded) {
        console.error('Cannot reset editor: Quill library not loaded');
        return false;
    }
    
    // If instance exists, try to reinitialize
    if (status.instanceExists && richEditorInstance.tryReinitialize) {
        console.log('Attempting to reinitialize existing editor instance');
        return richEditorInstance.tryReinitialize();
    }
    
    // Otherwise do a full initialization
    console.log('Creating new editor instance');
    return initRichTextEditor();
}

// Main initialization function
function initApplication() {
    console.log('Initializing application...');
    
    // Initialize DOM elements first
    initDOMElements();
    
    // Initialize theme manager
    initializeThemeManager();
    
    // Initialize feedback system
    initializeFeedbackSystem();
    
    // Initialize responsive UI components
    initResponsiveToolbar();
    
    // Set up core functionality
    initPanelResizing();
    setupEventListeners();
    
    console.log('Core application initialization complete');
}

// Initialize the theme manager
function initializeThemeManager() {
    if (htmlElement && themeToggleIcon) {
        themeManager = initThemeManager({
            htmlElement,
            themeToggleIcon
        });
        
        if (themeManager) {
            themeManager.initialize();
            console.log('Theme manager initialized successfully');
        } else {
            console.error('Failed to initialize theme manager');
        }
    } else {
        console.error('Required DOM elements for theme manager not found');
    }
}

// Initialize the feedback system
function initializeFeedbackSystem() {
    if (clipboardFeedback) {
        // Get the modal feedback element if it exists
        const modalFeedback = document.getElementById('modal-title-feedback');
        
        feedbackSystem = initFeedback({
            clipboardFeedback,
            modalFeedback
        });
        
        if (feedbackSystem) {
            console.log('Feedback system initialized successfully');
        } else {
            console.error('Failed to initialize feedback system');
        }
    } else {
        console.error('Required DOM elements for feedback system not found');
    }
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApplication);

// Update the page load event handler to use a more robust approach
window.addEventListener('load', async function() {
    // Initialize the rich text editor with retry logic
    let editorInitialized = initRichTextEditor();
    
    // If initial attempt fails, try again after a delay
    if (!editorInitialized) {
        console.log('First editor initialization failed, will retry in 500ms');
        setTimeout(() => {
            editorInitialized = initRichTextEditor();
            
            // If second attempt fails, try one more time
            if (!editorInitialized) {
                console.log('Second editor initialization failed, will retry in 1000ms');
                setTimeout(() => {
                    initRichTextEditor();
                }, 1000);
            }
        }, 500);
    }
    
    // Parse URL parameters if present - this doesn't depend on editor
    await handleUrlParams();
    
    // Initialize responsive toolbar
    initResponsiveToolbar();
    
    console.log('Page load initialization complete');
});
