// Main orchestrator, initialization and core setup

// Import the panel resizer module
import initPanelResizer from './components/panel-resizer.js';

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application...');
    
    // Get DOM elements needed for panel resizer
    const resizer = document.getElementById('resizer');
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    
    // Initialize panel resizer if elements exist
    if (resizer && leftPanel && rightPanel) {
        // Initialize with default settings
        const panelResizer = initPanelResizer({
            resizer,
            leftPanel,
            rightPanel,
            onResize: () => {
                console.log('Panel resized');
                // This will be used for responsive UI updates in future steps
            }
        });
        
        // Expose to window for easy console testing
        window.panelResizer = panelResizer;
        
        console.log('Panel resizer initialized successfully');
    } else {
        console.error('Could not initialize panel resizer - required DOM elements not found');
    }
});
