// Main orchestrator, initialization and core setup

// Import the panel resizer module
import initPanelResizer from './components/panel-resizer.js';

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
// This is a placeholder that will be replaced with actual implementation in future steps
async function processLinks() {
    console.log('Processing links...');
    // This will be implemented in later steps with link-processor.js
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
    console.log('Rich text editor will be implemented in a future step');
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
