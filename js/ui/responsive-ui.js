/**
 * Responsive UI module for handling toolbar resizing and dynamic element adjustments
 */

/**
 * Initialize responsive toolbar functionality
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.toolbar - The toolbar container element
 * @param {NodeList|Array} options.toolbarIcons - Collection of toolbar icon elements
 * @param {NodeList|Array} options.iconImages - Collection of icon images to resize
 * @param {Object} [options.sizes] - Optional size configuration
 * @param {number} [options.sizes.defaultIconSize=36] - Default icon size in px
 * @param {number} [options.sizes.defaultImageSize=20] - Default image size in px
 * @param {number} [options.sizes.minScale=0.85] - Minimum scaling factor (0-1)
 * @returns {Object} - Public API for responsive UI functions
 */
function initResponsiveUI(options) {
    const { 
        toolbar, 
        toolbarIcons, 
        iconImages,
        sizes = {}
    } = options;
    
    // Default sizes with fallbacks
    const defaultIconSize = sizes.defaultIconSize || 36; // px
    const defaultImageSize = sizes.defaultImageSize || 20; // px
    const minScale = sizes.minScale || 0.85; // Minimum scaling factor (85%)
    
    // For smoother transitions, keep track of the current scale
    let currentScaleFactor = 1;
    let animationFrameId = null;
    
    /**
     * Update icon sizes based on available container width
     */
    function updateIconSizes() {
        if (!toolbar) return;
        
        // Cancel any pending animation frame for performance
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        // Use requestAnimationFrame for smoother updates
        animationFrameId = requestAnimationFrame(() => {
            const containerWidth = toolbar.offsetWidth;
            const numIcons = toolbarIcons.length;
            
            // Calculate available width per icon (accounting for gap and padding)
            const availableWidth = containerWidth - 20; // subtracting approximate padding
            const idealWidth = (availableWidth / numIcons) - 12; // subtracting gap between icons
            
            // Calculate target scale factor, ensuring we don't go below minScale
            let targetScaleFactor = 1; // Default = 100%
            if (idealWidth < defaultIconSize) {
                // Calculate scale factor between minScale and 100% based on available width
                const iconWidth = Math.max(defaultIconSize * minScale, idealWidth);
                targetScaleFactor = iconWidth / defaultIconSize;
            }
            
            // Smooth transition between scale factors (interpolate for smoothness)
            currentScaleFactor = currentScaleFactor * 0.8 + targetScaleFactor * 0.2;
            
            // Apply scaling to icons with subtle easing
            toolbarIcons.forEach(icon => {
                const size = Math.floor(defaultIconSize * currentScaleFactor);
                icon.style.width = `${size}px`;
                icon.style.height = `${size}px`;
            });
            
            // Apply scaling to images
            iconImages.forEach(img => {
                const size = Math.floor(defaultImageSize * currentScaleFactor);
                img.style.width = `${size}px`;
                img.style.height = `${size}px`;
            });
            
            // Adjust gap if needed for different densities
            if (currentScaleFactor < 0.95) {
                toolbar.style.gap = "0.5rem";
                document.querySelectorAll('.toolbar-group').forEach(group => {
                    group.style.gap = "0.4rem";
                });
            } else {
                toolbar.style.gap = "0.75rem";
                document.querySelectorAll('.toolbar-group').forEach(group => {
                    group.style.gap = "0.5rem";
                });
            }
            
            // Clear animation frame ID
            animationFrameId = null;
        });
    }
    
    /**
     * Set up event listeners for responsive behavior
     */
    function initialize() {
        // Initial update
        updateIconSizes();
        
        // Throttled resize handler
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(updateIconSizes, 50);
        });
        
        // Add resize observer for more accurate tracking of toolbar size changes
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (entry.target === toolbar) {
                        updateIconSizes();
                    }
                }
            });
            
            resizeObserver.observe(toolbar);
        }
        
        console.log('Responsive UI initialized successfully');
    }
    
    // Public API
    return {
        initialize,
        updateIconSizes
    };
}

export default initResponsiveUI;
