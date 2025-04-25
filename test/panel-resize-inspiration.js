// Modified panel-resizer.js using requestAnimationFrame AND iframe pointer-events fix

function initPanelResizer(options) {
    // Extract options with defaults
    const {
        resizer,
        leftPanel,
        rightPanel,
        onResize,
        minWidth = 15,
        maxWidth = 50,
        initialWidth = 30
    } = options;

    // Find the iframe (assuming it has the ID 'viewer')
    const iframeViewer = document.getElementById('viewer');

    // Track resizing state
    let isResizing = false;
    let animationFrameId = null;
    let lastEvent = null;

    // Initialize panel widths (same)
    if (!leftPanel.style.width) { /* ... */ }

    // Core function to perform the width update (same as previous rAF version)
    function performWidthUpdate() {
        if (!lastEvent || !isResizing) {
             animationFrameId = null;
             return;
        }
        const containerWidth = document.body.clientWidth;
        let clientX = lastEvent.clientX;
        if (lastEvent.touches && lastEvent.touches.length > 0) {
            clientX = lastEvent.touches[0].clientX;
        } else if (lastEvent.changedTouches && lastEvent.changedTouches.length > 0) {
             clientX = lastEvent.changedTouches[0].clientX;
        }
        let newLeftPanelWidth = (clientX / containerWidth) * 100;
        newLeftPanelWidth = Math.max(minWidth, Math.min(newLeftPanelWidth, maxWidth));
        leftPanel.style.width = `${newLeftPanelWidth}%`;
        rightPanel.style.width = `${100 - newLeftPanelWidth}%`;
        if (typeof onResize === 'function') { onResize(); }
        animationFrameId = null;
    }

    // Request an animation frame (same as previous rAF version)
    function requestUpdate(event) {
        lastEvent = event;
        if (isResizing && animationFrameId === null) {
            animationFrameId = requestAnimationFrame(performWidthUpdate);
        }
    }

    // --- Handlers with iframe pointer-events logic ---

    function handleMouseDown(e) {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        // *** Disable iframe events ON START ***
        if (iframeViewer) {
             iframeViewer.style.pointerEvents = 'none';
        }
        e.preventDefault();
    }

    function handleTouchStart(e) {
        if (e.target === resizer) {
             isResizing = true;
             document.body.style.cursor = 'col-resize';
             // *** Disable iframe events ON START ***
             if (iframeViewer) {
                 iframeViewer.style.pointerEvents = 'none';
             }
        }
    }

    function handleMouseMove(e) {
        if (!isResizing) return;
        requestUpdate(e);
    }

    function handleTouchMove(e) {
        if (!isResizing) return;
        e.preventDefault();
        requestUpdate(e);
    }

    // Cleanup function used by mouseup, touchend, mouseleave, touchcancel
    function cleanupAfterResize() {
         if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            // *** Re-enable iframe events ON END ***
            if (iframeViewer) {
                 iframeViewer.style.pointerEvents = 'auto';
            }

            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            if (typeof onResize === 'function') {
                 setTimeout(onResize, 0);
             }
        }
        lastEvent = null;
    }

    // Attach event listeners (same)
    resizer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', cleanupAfterResize);
    document.addEventListener('mouseleave', cleanupAfterResize);
    resizer.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', cleanupAfterResize);
    document.addEventListener('touchcancel', cleanupAfterResize);

    // Return public API (destroy needs iframe logic too)
    return {
        getWidths() { /* ... */ },
        setWidths(leftWidthPercent) { /* ... */ },
        reset() { /* ... */ },
        destroy() {
             // Ensure iframe pointer events are reset on destroy
             if (iframeViewer) {
                 iframeViewer.style.pointerEvents = 'auto';
             }
             if (animationFrameId !== null) {
                 cancelAnimationFrame(animationFrameId);
                 animationFrameId = null;
             }
            // Remove listeners (same)
            resizer.removeEventListener('mousedown', handleMouseDown);
            // ... other removeEventListener calls
            document.removeEventListener('touchcancel', cleanupAfterResize);
        }
    };
}

export default initPanelResizer;