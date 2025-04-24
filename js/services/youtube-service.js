// YouTube service that handles all YouTube-related functionality

// Create window.App namespace if it doesn't exist
window.App = window.App || {};

// Create YouTube service module
window.App.YouTube = (function() {
    // Private variables and state
    let serviceCache = {};
    
    // Import from utils
    const { 
        formatTime, 
        timeToSeconds 
    } = window.App.TimeUtils;
    
    const {
        decodeHTMLEntities,
        fixHtmlEntitiesInUrls
    } = window.App.StringUtils;
    
    // Import data
    const {
        commonVideos,
        videoDurations
    } = window.App.YouTubeData;
    
    /**
     * Extract information from a YouTube URL
     * @param {string} url - YouTube URL to process
     * @returns {Object} Video information including ID and parameters
     */
    function extractYouTubeInfo(url) {
        // Clean and prepare the URL
        url = url.trim();
        url = fixHtmlEntitiesInUrls(url);
        
        // Default values
        const result = {
            videoId: null,
            startTime: null,
            endTime: null,
            list: null,
            isShorts: false,
            customContext: null,
            customTitle: null
        };
        
        // Process YouTube Shorts
        if (url.includes('youtube.com/shorts/')) {
            const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
            if (shortsMatch) {
                result.videoId = shortsMatch[1];
                result.isShorts = true;
                
                // Extract any parameters
                if (url.includes('?')) {
                    const params = new URLSearchParams(url.split('?')[1]);
                    if (params.has('list')) {
                        result.list = params.get('list');
                    }
                }
                
                return result;
            }
        }
        
        // Process embedded context and title
        const contextMatch = url.match(/\/\/(.*?)\|{3}(.*?)$/);
        if (contextMatch) {
            result.customContext = contextMatch[1].trim();
            // Check if the second part contains a title
            if (contextMatch[2]) {
                result.customTitle = contextMatch[2].trim();
            }
            // Remove the context part from the URL
            url = url.replace(/\/\/.*?$/, '');
        } else {
            // Check for just the title
            const titleMatch = url.match(/\|{3}(.*?)$/);
            if (titleMatch) {
                result.customTitle = titleMatch[1].trim();
                // Remove the title part from the URL
                url = url.replace(/\|{3}.*?$/, '');
            }
        }
        
        // Parse URL for video ID and parameters
        try {
            let videoId = null;
            
            // Extract video ID from different YouTube URL formats
            if (url.includes('youtube.com/watch')) {
                const urlObj = new URL(url);
                const params = new URLSearchParams(urlObj.search);
                
                if (params.has('v')) {
                    videoId = params.get('v');
                }
                
                // Check for timestamps
                if (params.has('t')) {
                    let timeParam = params.get('t');
                    if (timeParam.endsWith('s')) {
                        timeParam = timeParam.slice(0, -1);
                    }
                    
                    if (!isNaN(timeParam)) {
                        result.startTime = parseInt(timeParam);
                    } else {
                        // Handle complex time formats
                        let seconds = 0;
                        const hourMatch = timeParam.match(/(\d+)h/);
                        const minuteMatch = timeParam.match(/(\d+)m/);
                        const secondMatch = timeParam.match(/(\d+)s/);
                        
                        if (hourMatch) seconds += parseInt(hourMatch[1]) * 3600;
                        if (minuteMatch) seconds += parseInt(minuteMatch[1]) * 60;
                        if (secondMatch) seconds += parseInt(secondMatch[1]);
                        
                        if (seconds > 0) {
                            result.startTime = seconds;
                        }
                    }
                }
                
                // Check for end time
                if (params.has('end')) {
                    const endTime = params.get('end');
                    if (!isNaN(endTime)) {
                        result.endTime = parseInt(endTime);
                    }
                }
                
                // Check for playlist
                if (params.has('list')) {
                    result.list = params.get('list');
                }
            } else if (url.includes('youtu.be/')) {
                // Handle youtu.be short links
                const match = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                if (match) {
                    videoId = match[1];
                    
                    // Check for parameters
                    if (url.includes('?')) {
                        const params = new URLSearchParams(url.split('?')[1]);
                        
                        // Handle start time
                        if (params.has('t')) {
                            let timeParam = params.get('t');
                            if (timeParam.endsWith('s')) {
                                timeParam = timeParam.slice(0, -1);
                            }
                            
                            if (!isNaN(timeParam)) {
                                result.startTime = parseInt(timeParam);
                            }
                        }
                        
                        // Handle list parameter
                        if (params.has('list')) {
                            result.list = params.get('list');
                        }
                    }
                }
            } else if (url.includes('youtube.com/embed/')) {
                // Handle embed links
                const match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
                if (match) {
                    videoId = match[1];
                    
                    // Check for parameters
                    if (url.includes('?')) {
                        const params = new URLSearchParams(url.split('?')[1]);
                        
                        // Handle start time
                        if (params.has('start')) {
                            const startTime = params.get('start');
                            if (!isNaN(startTime)) {
                                result.startTime = parseInt(startTime);
                            }
                        }
                        
                        // Handle end time
                        if (params.has('end')) {
                            const endTime = params.get('end');
                            if (!isNaN(endTime)) {
                                result.endTime = parseInt(endTime);
                            }
                        }
                        
                        // Handle list parameter
                        if (params.has('list')) {
                            result.list = params.get('list');
                        }
                    }
                }
            }
            
            // Process video ID
            if (videoId) {
                result.videoId = videoId;
                
                // Check localStorage for saved times
                const savedTimes = localStorage.getItem(`video_times_${videoId}`);
                if (savedTimes) {
                    try {
                        const times = JSON.parse(savedTimes);
                        if (times.startTime && !result.startTime) {
                            result.startTime = times.startTime;
                        }
                        if (times.endTime && !result.endTime) {
                            result.endTime = times.endTime;
                        }
                    } catch (e) {
                        console.error('Error parsing saved times:', e);
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing YouTube URL:', e);
        }
        
        return result;
    }
    
    /**
     * Get video duration in seconds
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<number>} Duration in seconds
     */
    async function getVideoDuration(videoId) {
        if (!videoId) return 0;
        
        // Check cache first
        if (serviceCache[`duration_${videoId}`]) {
            return serviceCache[`duration_${videoId}`];
        }
        
        // Check predefined durations
        if (videoDurations[videoId]) {
            serviceCache[`duration_${videoId}`] = videoDurations[videoId];
            return videoDurations[videoId];
        }
        
        // Check localStorage
        const storedInfo = localStorage.getItem(`video_info_${videoId}`);
        if (storedInfo) {
            try {
                const info = JSON.parse(storedInfo);
                if (info.duration) {
                    serviceCache[`duration_${videoId}`] = info.duration;
                    return info.duration;
                }
            } catch (e) {
                console.error('Error parsing stored video info:', e);
            }
        }
        
        // We'll need to fetch the duration from YouTube
        // This is normally done via API, but for this example we'll return a default
        console.warn('Video duration not found in cache for:', videoId);
        return 0;
    }
    
    /**
     * Format YouTube link display
     * @param {string} url - YouTube URL
     * @returns {string} Formatted display text
     */
    function getFormattedLinkDisplay(url) {
        const info = extractYouTubeInfo(url);
        let displayText = 'YouTube';
        
        if (info.isShorts) {
            displayText = 'YouTube Shorts';
        }
        
        if (info.startTime) {
            getVideoDuration(info.videoId).then(duration => {
                if (duration > 0) {
                    const formattedTime = formatTime(info.startTime);
                    const formattedDuration = formatTime(duration);
                    displayText = `${displayText} (${formattedTime}/${formattedDuration})`;
                } else {
                    const formattedTime = formatTime(info.startTime);
                    displayText = `${displayText} (${formattedTime})`;
                }
            });
        }
        
        return displayText;
    }
    
    /**
     * Fetch video title
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<string>} Video title
     */
    async function fetchVideoTitle(videoId) {
        if (!videoId) return 'Unknown Video';
        
        // Check if we have an edited title
        const editedTitle = localStorage.getItem(`edited_title_${videoId}`);
        if (editedTitle) {
            return editedTitle;
        }
        
        // Check in-memory cache
        if (window.videoTitleCache && window.videoTitleCache[videoId]) {
            return window.videoTitleCache[videoId];
        }
        
        // Check common videos
        if (commonVideos[videoId]) {
            // Store in cache
            if (!window.videoTitleCache) window.videoTitleCache = {};
            window.videoTitleCache[videoId] = commonVideos[videoId];
            return commonVideos[videoId];
        }
        
        // Check localStorage
        const storedTitle = localStorage.getItem(`video_title_${videoId}`);
        if (storedTitle) {
            // Store in cache
            if (!window.videoTitleCache) window.videoTitleCache = {};
            window.videoTitleCache[videoId] = storedTitle;
            return storedTitle;
        }
        
        try {
            // In a real implementation, this would fetch from YouTube API
            // For now, we'll just return a placeholder
            const title = `Video ${videoId}`;
            
            // Store in cache
            if (!window.videoTitleCache) window.videoTitleCache = {};
            window.videoTitleCache[videoId] = title;
            
            // Store in localStorage for future use
            localStorage.setItem(`video_title_${videoId}`, title);
            
            return title;
        } catch (error) {
            console.error('Error fetching video title:', error);
            return 'Unknown Video';
        }
    }
    
    /**
     * Check if a URL is a YouTube URL
     * @param {string} url - URL to check
     * @returns {boolean} True if it's a YouTube URL
     */
    function isYouTubeUrl(url) {
        return /youtube\.com|youtu\.be/.test(url);
    }
    
    // Public API
    return {
        extractYouTubeInfo,
        getVideoDuration,
        getFormattedLinkDisplay,
        fetchVideoTitle,
        isYouTubeUrl
    };
})();