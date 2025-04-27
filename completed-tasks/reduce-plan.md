# Plan to Fix YouTube Video Loading Issue

## Problem
When clicking on multiple YouTube link cards in succession, only the first click loads the video properly. Subsequent clicks do not update the video in the viewer iframe.

## Root Cause Analysis
Looking at the code, I've identified the following issues:

1. In `youtube-service.js`, the `loadYouTubeVideo` function removes the old iframe and creates a new one. This is good practice for forcing a reload, but there's an issue with the global reference:

2. In `app.js`, the `viewer` variable is initialized once when the page loads, but when the `loadYouTubeVideo` function replaces the iframe element with a new one, the global `viewer` variable isn't updated to reference the new iframe.

3. The subsequent clicks still use the old `viewer` reference which no longer exists in the DOM, causing the function to fail silently.

## Solution
The solution is to update the global `viewer` reference after replacing the iframe in the DOM. This can be done in one of two ways:

### Solution Option 1: Update Global Reference in app.js
Modify the `loadVideo` function in `app.js` to capture and update the returned iframe:

```javascript
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
        if (result) {
            viewer = document.getElementById(viewer.id || 'viewer');
        }
        
        return result;
    } else {
        // Non-YouTube URL handling...
    }
}
```

### Solution Option 2: Modify loadYouTubeVideo to Return the New Iframe
Alter the `loadYouTubeVideo` function in `youtube-service.js` to return the new iframe element instead of a boolean:

```javascript
function loadYouTubeVideo(url, iframeElement) {
    // ...existing code...
    
    // Return the new iframe element so the caller can update references
    return newIframe;
}
```

Then update the `loadVideo` function in `app.js` to use this return value:

```javascript
function loadVideo(url) {
    // ...existing code...
    
    // Check if it's a YouTube URL
    if (isYouTubeUrl(url)) {
        const newIframe = loadYouTubeVideo(url, viewer);
        if (newIframe) {
            viewer = newIframe; // Update the global reference
            return true;
        }
        return false;
    } else {
        // ...existing code...
    }
}
```

### Recommendation
I recommend implementing Solution Option 1 because:
1. It requires minimal changes to the existing code
2. It doesn't change the function signatures or return types
3. It keeps the responsibility for managing the global reference within app.js

This solution ensures that each time a YouTube video is loaded, the global `viewer` reference is updated to point to the newly created iframe element, allowing subsequent clicks to work properly.

## Implementation Steps
1. Update the `loadVideo` function in `app.js` to update the global viewer reference after calling `loadYouTubeVideo`
2. Test with multiple video links to ensure videos load properly on each click
3. Check for any edge cases where the iframe ID might change or the element might not be found