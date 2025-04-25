/**
 * YouTube Service Module
 * Handles YouTube URL parsing, video ID extraction, embed URL generation,
 * and video loading in iframes.
 */

/**
 * Extract YouTube video ID and parameters from various URL formats
 * @param {string} url - The YouTube URL to extract information from
 * @returns {Object} - Object containing videoId and params
 */
function extractYouTubeInfo(url) {
    // Make sure we're working with a valid URL
    if (!url || typeof url !== 'string') {
        console.error('Invalid URL provided to extractYouTubeInfo:', url);
        return { videoId: null, params: {} };
    }
    
    console.log("Extracting info from URL:", url);
    
    // Trim any whitespace that might have been included
    let trimmedUrl = url.trim();
    
    // Clean the URL from any HTML tags that might have been added by the rich text editor
    const cleanUrl = trimmedUrl.replace(/<\/?[^>]+(>|$)/g, "");
    
    // Make sure any HTML entities in the URL are properly decoded
    const decodedUrl = cleanUrl
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    
    console.log("Cleaned URL:", decodedUrl);
    
    // Try different methods to extract video ID
    let videoId = null;
    
    // Method 1: Try using URL API to extract the 'v' parameter - most reliable for complex URLs
    try {
        const urlObj = new URL(decodedUrl);
        const searchParams = urlObj.searchParams;
        
        // Check for 'v' parameter which contains the video ID
        if (searchParams.has('v')) {
            const vParam = searchParams.get('v');
            // Validate that it's likely a YouTube video ID (11 characters with specific patterns)
            if (vParam && vParam.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
                videoId = vParam;
                console.log("Extracted video ID from v parameter:", videoId);
            }
        }
    } catch (e) {
        console.warn("Error parsing URL with URL API:", e);
    }
    
    // Method 2: Standard YouTube URL patterns (if method 1 failed)
    if (!videoId) {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = decodedUrl.match(regExp);
        if (match && match[7] && match[7].length === 11) {
            videoId = match[7];
            console.log("Extracted video ID using regex pattern:", videoId);
        }
    }
    
    // Method 3: Direct youtu.be URL (if methods 1-2 failed)
    if (!videoId && decodedUrl.includes('youtu.be/')) {
        const youtubeShortMatch = decodedUrl.match(/youtu\.be\/([^?#&/]{11})/);
        if (youtubeShortMatch && youtubeShortMatch[1]) {
            videoId = youtubeShortMatch[1];
            console.log("Extracted video ID from youtu.be URL:", videoId);
        }
    }
    
    // Method 4: Look for any 11-character string that looks like a YouTube ID
    if (!videoId) {
        // This is a more aggressive method - only use if nothing else worked
        const possibleIdMatch = decodedUrl.match(/[a-zA-Z0-9_-]{11}/g);
        if (possibleIdMatch && possibleIdMatch.length > 0) {
            // If there are multiple matches, use the first one that appears after "v="
            const vIndex = decodedUrl.indexOf("v=");
            if (vIndex !== -1) {
                for (const match of possibleIdMatch) {
                    if (decodedUrl.indexOf(match) > vIndex) {
                        videoId = match;
                        console.log("Extracted video ID by finding first 11-char pattern after v=:", videoId);
                        break;
                    }
                }
            }
            
            // If we still don't have a match, use the first one found
            if (!videoId) {
                videoId = possibleIdMatch[0];
                console.log("Extracted video ID using first 11-char pattern found:", videoId);
            }
        }
    }
    
    console.log("Final extracted video ID:", videoId);
    
    if (!videoId) return { videoId: null, params: {} };
    
    try {
        // Parse URL to extract parameters, ensuring we handle complex URLs properly
        const params = {};
        let urlObj;
        
        try {
            urlObj = new URL(decodedUrl);
        } catch (e) {
            console.warn("Error creating URL object from full URL:", e);
            // If the URL is invalid, create a more permissive one that will still work for params
            urlObj = new URL(`https://www.youtube.com/watch?v=${videoId}`);
        }
        
        // Get time parameters (t/start and end)
        let startTime = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
        let endTime = urlObj.searchParams.get('end');
    
        // Process start time
        if (startTime) {
            // Convert to seconds if it's in the format like "4m20s"
            if (typeof startTime === 'string' && startTime.includes('m')) {
                const minutesMatch = startTime.match(/(\d+)m/);
                const secondsMatch = startTime.match(/(\d+)s/);
                let seconds = 0;
                if (minutesMatch) seconds += parseInt(minutesMatch[1]) * 60;
                if (secondsMatch) seconds += parseInt(secondsMatch[1]);
                startTime = seconds;
            }
            
            // Convert start time to integer if possible
            startTime = parseInt(startTime) || startTime;
            
            // For embed URLs, use 'start' parameter
            params.start = startTime;
        }
        
        // Process end time
        if (endTime) {
            // Convert to seconds if it's in the format like "4m20s"
            if (typeof endTime === 'string' && endTime.includes('m')) {
                const minutesMatch = endTime.match(/(\d+)m/);
                const secondsMatch = endTime.match(/(\d+)s/);
                let seconds = 0;
                if (minutesMatch) seconds += parseInt(minutesMatch[1]) * 60;
                if (secondsMatch) seconds += parseInt(secondsMatch[1]);
                endTime = seconds;
            }
            
            // Convert end time to integer if possible
            endTime = parseInt(endTime) || endTime;
            
            // For embed URLs, use 'end' parameter
            params.end = endTime;
        }
        
        return { videoId, params };
        
    } catch (error) {
        console.error('Error parsing YouTube URL parameters:', error);
        return { videoId, params: {} };
    }
}

/**
 * Generate YouTube embed URL from video ID and parameters
 * @param {string} videoId - The YouTube video ID
 * @param {Object} params - URL parameters like start and end times
 * @returns {string} - The YouTube embed URL
 */
function generateYouTubeEmbedUrl(videoId, params = {}) {
    if (!videoId) return '';
    
    // Base URL with required parameters
    let embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`;
    
    // Add start time if present
    if (params.start) {
        embedUrl += `&start=${params.start}`;
    }
    
    // Add end time if present
    if (params.end) {
        embedUrl += `&end=${params.end}`;
    }
    
    // Add cache busting parameter
    embedUrl += `&cb=${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    return embedUrl;
}

/**
 * Check if a URL is a valid YouTube URL
 * @param {string} url - The URL to check
 * @returns {boolean} - True if it's a valid YouTube URL
 */
function isYouTubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Check if URL contains YouTube domain or youtu.be
    const containsYouTubeDomain = url.includes('youtube.com') || 
                                 url.includes('youtu.be') || 
                                 url.includes('youtube-nocookie.com');
    
    if (!containsYouTubeDomain) return false;
    
    // Check if we can extract a video ID
    const { videoId } = extractYouTubeInfo(url);
    return !!videoId;
}

/**
 * Load a YouTube video into an iframe
 * @param {string} url - The YouTube URL to load
 * @param {HTMLIFrameElement} iframeElement - The iframe element to load the video into
 * @returns {boolean} - True if loading was successful
 */
function loadYouTubeVideo(url, iframeElement) {
    // Make sure we're working with a valid URL and iframe
    if (!url || typeof url !== 'string' || !iframeElement) {
        console.error('Invalid parameters for loadYouTubeVideo');
        return false;
    }
    
    try {
        // Extract video ID and parameters
        const { videoId, params } = extractYouTubeInfo(url);
        
        if (!videoId) {
            console.error('Could not extract YouTube video ID from URL:', url);
            return false;
        }
        
        // Get the parent of the iframe
        const parent = iframeElement.parentNode;
        if (!parent) {
            console.error('Iframe has no parent element');
            return false;
        }
        
        // Remove the old iframe
        try {
            parent.removeChild(iframeElement);
        } catch (e) {
            console.warn('Error removing old iframe:', e);
        }
        
        // Create a new iframe
        const newIframe = document.createElement('iframe');
        newIframe.id = iframeElement.id || 'viewer';
        
        // Generate the embed URL
        const embedUrl = generateYouTubeEmbedUrl(videoId, params);
        
        // Set iframe attributes
        newIframe.setAttribute('src', embedUrl);
        newIframe.setAttribute('frameborder', '0');
        newIframe.setAttribute('allowfullscreen', 'true');
        
        // Add error handling
        newIframe.onerror = function() {
            console.error('Error loading iframe content');
        };
        
        // Add the new iframe to the DOM
        parent.appendChild(newIframe);
        
        console.log(`Loaded YouTube video with ID ${videoId} into iframe`);
        return true;
    } catch (error) {
        console.error('Error loading YouTube video:', error);
        return false;
    }
}

/**
 * Get stored time data for a video
 * @param {string} videoId - The YouTube video ID
 * @returns {Object|null} - Object with start and end times, or null if not found
 */
function getStoredVideoTimes(videoId) {
    if (!videoId) return null;
    
    try {
        const timeKey = `video_times_${videoId}`;
        const storedData = localStorage.getItem(timeKey);
        
        if (!storedData) return null;
        
        return JSON.parse(storedData);
    } catch (e) {
        console.warn('Error retrieving stored video times:', e);
        return null;
    }
}

/**
 * Store time data for a video
 * @param {string} videoId - The YouTube video ID
 * @param {number|null} startTime - The start time in seconds
 * @param {number|null} endTime - The end time in seconds
 */
function storeVideoTimes(videoId, startTime, endTime) {
    if (!videoId) return;
    
    try {
        const timeKey = `video_times_${videoId}`;
        const timeData = {
            start: startTime,
            end: endTime,
            timestamp: Date.now()
        };
        
        localStorage.setItem(timeKey, JSON.stringify(timeData));
    } catch (e) {
        console.warn('Error storing video times:', e);
    }
}

// Export the public API
export {
    extractYouTubeInfo,
    generateYouTubeEmbedUrl,
    isYouTubeUrl,
    loadYouTubeVideo,
    getStoredVideoTimes,
    storeVideoTimes
};
