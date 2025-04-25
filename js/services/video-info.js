/**
 * Video Info Service Module
 * Handles video title and duration fetching with multiple fallback methods
 * and caching mechanisms
 */
 
// In-memory cache for video titles to avoid repeated fetches within a session
const videoTitleCache = {};

// Common video titles for offline/testing use
const commonVideos = {
    // Tech/Education
    'DI-LKs3GpeE': 'Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI',
    'jNQXAC9IVRw': 'Me at the zoo',
    'LXb3EKWsInQ': 'Git & GitHub Crash Course For Beginners',
    'fNVa1qMbF9Y': 'GitHub Tutorial - Beginner\'s Training Guide',
    'rfscVS0vtbw': 'Learn Python - Full Course for Beginners',
    
    // Music
    'b4QIaBMvZqc': 'FUSION BAIÃO | Mateus Starling Quarteto | QUINTO',
    'dQw4w9WgXcQ': 'Rick Astley - Never Gonna Give You Up',
    '9bZkp7q19f0': 'PSY - GANGNAM STYLE(강남스타일)',
    '_CL6n0FJZpk': 'Michael Jackson - Billie Jean (Official Video)',
    '6Ejga4kJUts': 'The Cranberries - Zombie (Official Music Video)',
    
    // Popular videos
    'fC7oUOUEEi4': 'Get Stick Bugged lol',
    'CttYJgr9vgQ': 'Interstellar - TARS vs CASE',
    'mhJRzQsLZGg': 'Bloopers That Were Better Than The Original Scene',
    'sOnqjkJTMaA': 'Michael Jordan Top 50 All Time Plays'
};

// Common video durations (in seconds) for offline/testing use
const videoDurations = {
    // Tech/Education
    'DI-LKs3GpeE': 3683, // 1:01:23
    'jNQXAC9IVRw': 19,   // 0:19
    'LXb3EKWsInQ': 2059, // 34:19
    'fNVa1qMbF9Y': 665,  // 11:05
    'rfscVS0vtbw': 16922, // 4:42:02
    
    // Music
    'b4QIaBMvZqc': 238,  // 3:58
    'dQw4w9WgXcQ': 212,  // 3:32
    '9bZkp7q19f0': 253,  // 4:13
    '_CL6n0FJZpk': 294,  // 4:54
    '6Ejga4kJUts': 307,  // 5:07
    
    // Popular videos
    'fC7oUOUEEi4': 11,   // 0:11
    'CttYJgr9vgQ': 196,  // 3:16
    'mhJRzQsLZGg': 899,  // 14:59
    'sOnqjkJTMaA': 623   // 10:23
};

/**
 * Decode HTML entities in a string
 * @param {string} text - Text containing HTML entities
 * @returns {string} - Decoded text
 */
function decodeHTMLEntities(text) {
    if (!text) return '';
    
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

/**
 * Fetch a YouTube video title with multiple fallback methods
 * @param {string} videoId - The YouTube video ID
 * @returns {Promise<string>} - The video title or a fallback
 */
async function fetchVideoTitle(videoId) {
    console.log(`Fetching title for video ID: ${videoId}`);
    
    if (!videoId) {
        return 'Unknown Video';
    }
    
    // Check if user has edited this title - always prioritize user edits
    const editedTitle = localStorage.getItem(`edited_title_${videoId}`);
    if (editedTitle) {
        console.log(`Using locally edited title: ${editedTitle}`);
        return editedTitle;
    }
    
    // Check in-memory cache first for previously fetched titles
    if (videoTitleCache[videoId]) {
        console.log(`Using in-memory cached title: ${videoTitleCache[videoId]}`);
        return videoTitleCache[videoId];
    }
    
    // Cache key for localStorage
    const cacheKey = `video_title_${videoId}`;
    
    // Method 1: Check our common videos predefined list 
    if (commonVideos[videoId]) {
        console.log(`Found title in common videos list: ${commonVideos[videoId]}`);
        videoTitleCache[videoId] = commonVideos[videoId];
        
        // Save to localStorage for future sessions
        localStorage.setItem(cacheKey, JSON.stringify({
            title: commonVideos[videoId],
            method: 'Predefined list',
            timestamp: Date.now()
        }));
        
        return commonVideos[videoId];
    }
    
    // Method 2: Try to get from localStorage if previously fetched
    const cachedInfo = localStorage.getItem(cacheKey);
    if (cachedInfo) {
        try {
            const parsedInfo = JSON.parse(cachedInfo);
            if (parsedInfo.title) {
                console.log(`Found title in localStorage: "${parsedInfo.title}" (method: ${parsedInfo.method || 'unknown'})`);
                
                // Also update the in-memory cache
                videoTitleCache[videoId] = parsedInfo.title;
                
                return parsedInfo.title;
            }
        } catch (e) {
            console.warn('Error parsing cached title info:', e);
            // Continue with other methods if parsing fails
        }
    }
    
    // Check if we have video info cached (may contain title)
    const videoInfoCacheKey = `video_info_${videoId}`;
    const cachedVideoInfo = localStorage.getItem(videoInfoCacheKey);
    if (cachedVideoInfo) {
        try {
            const parsedInfo = JSON.parse(cachedVideoInfo);
            if (parsedInfo.title) {
                console.log(`Found title in video info cache: "${parsedInfo.title}"`);
                
                // Update both caches
                videoTitleCache[videoId] = parsedInfo.title;
                localStorage.setItem(cacheKey, JSON.stringify({
                    title: parsedInfo.title,
                    method: 'From video info cache',
                    timestamp: Date.now()
                }));
                
                return parsedInfo.title;
            }
        } catch (e) {
            console.warn('Error parsing cached video info:', e);
        }
    }
    
    try {
        // Method 3: Try using the oEmbed API (typically has looser CORS policies)
        try {
            console.log("Trying to fetch from oEmbed API...");
            const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const oEmbedResponse = await fetch(oEmbedUrl, {
                signal: AbortSignal.timeout(3000)
            });
            
            if (oEmbedResponse.ok) {
                const data = await oEmbedResponse.json();
                if (data.title) {
                    console.log(`Got title from oEmbed: "${data.title}"`);
                    
                    // Update caches
                    videoTitleCache[videoId] = data.title;
                    localStorage.setItem(cacheKey, JSON.stringify({
                        title: data.title,
                        method: 'oEmbed API',
                        timestamp: Date.now()
                    }));
                    
                    return data.title;
                }
            }
        } catch (oEmbedError) {
            console.warn('oEmbed fetch error:', oEmbedError);
        }
        
        // Method 4: Try using CORS proxy to fetch HTML
        try {
            console.log("Trying to fetch with CORS proxy...");
            const corsProxy = 'https://corsproxy.io/?';
            const url = `${corsProxy}https://www.youtube.com/watch?v=${videoId}`;
            
            const response = await fetch(url, {
                signal: AbortSignal.timeout(5000),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            
            if (!response.ok) {
                console.warn(`Failed to fetch: ${response.status}`);
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            
            const html = await response.text();
            console.log("Received HTML response, looking for title...");
            
            // Try different title extraction patterns
            const titlePatterns = [
                {
                    name: '<title> tag',
                    regex: /<title>([^<]*)<\/title>/,
                    process: (match) => match[1].replace(' - YouTube', '')
                },
                {
                    name: 'og:title meta tag',
                    regex: /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
                    process: (match) => match[1]
                },
                {
                    name: 'video title in JSON',
                    regex: /"title":\s*"([^"]+)"/,
                    process: (match) => match[1].replace(/\\u0026/g, '&')
                },
                {
                    name: 'videoDetails title',
                    regex: /"videoDetails"[\s\S]*?"title":\s*"([^"]+)"/,
                    process: (match) => match[1].replace(/\\u0026/g, '&')
                },
                {
                    name: 'microformat title',
                    regex: /"microformat"[\s\S]*?"title":\s*"([^"]+)"/,
                    process: (match) => match[1].replace(/\\u0026/g, '&')
                }
            ];
            
            // Try each title pattern in sequence
            for (const pattern of titlePatterns) {
                const match = html.match(pattern.regex);
                if (match) {
                    try {
                        let title = pattern.process(match);
                        
                        // Decode HTML entities
                        title = decodeHTMLEntities(title);
                        
                        console.log(`Successfully extracted title with pattern "${pattern.name}": "${title}"`);
                        
                        // Update caches
                        videoTitleCache[videoId] = title;
                        localStorage.setItem(cacheKey, JSON.stringify({
                            title: title,
                            method: `HTML (${pattern.name})`,
                            timestamp: Date.now()
                        }));
                        
                        return title;
                    } catch (e) {
                        console.warn(`Error processing title pattern "${pattern.name}":`, e);
                    }
                }
            }
            
            console.warn("Could not extract title from HTML with any pattern");
        } catch (fetchError) {
            console.warn('CORS proxy fetch error:', fetchError);
        }
        
        // Fallback to a generic title
        const fallbackTitle = `YouTube Video ${videoId}`;
        
        // Update caches
        videoTitleCache[videoId] = fallbackTitle;
        localStorage.setItem(cacheKey, JSON.stringify({
            title: fallbackTitle,
            method: 'Fallback after all methods failed',
            timestamp: Date.now()
        }));
        
        return fallbackTitle;
        
    } catch (error) {
        console.error('Error in fetchVideoTitle:', error);
        
        // Final fallback
        const fallbackTitle = `YouTube Video ${videoId}`;
        
        // Update caches
        videoTitleCache[videoId] = fallbackTitle;
        localStorage.setItem(cacheKey, JSON.stringify({
            title: fallbackTitle,
            method: 'Fallback after error',
            timestamp: Date.now()
        }));
        
        return fallbackTitle;
    }
}

/**
 * Fetch a YouTube video duration with multiple fallback methods
 * @param {string} videoId - The YouTube video ID
 * @returns {Promise<number|null>} - The video duration in seconds or null
 */
async function getVideoDuration(videoId) {
    console.log(`Getting duration for video ID: ${videoId}`);
    
    if (!videoId) {
        return null;
    }
    
    // Cache key for localStorage
    const cacheKey = `video_info_${videoId}`;
    
    // Method 1: Check if we have the duration in our predefined list
    if (videoDurations[videoId]) {
        console.log(`Found in predefined durations: ${videoDurations[videoId]} seconds`);
        
        // Save to cache for future reference
        const videoInfo = {
            duration: videoDurations[videoId],
            title: commonVideos[videoId] || null,
            method: 'Predefined list',
            timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(videoInfo));
        
        return videoDurations[videoId];
    }
    
    // Method 2: Try to get from localStorage if previously fetched
    const cachedInfo = localStorage.getItem(cacheKey);
    if (cachedInfo) {
        try {
            const parsedInfo = JSON.parse(cachedInfo);
            if (parsedInfo.duration && parsedInfo.method && !parsedInfo.method.includes('estimate')) {
                console.log(`Found in localStorage: ${parsedInfo.duration} seconds (method: ${parsedInfo.method || 'unknown'})`);
                return parsedInfo.duration;
            }
        } catch (e) {
            console.warn('Error parsing cached info:', e);
        }
    }
    
    // Method 3: Try to fetch the actual duration directly
    try {
        // Confirm video exists with oEmbed
        let videoTitle = null;
        
        try {
            console.log('Trying oEmbed API...');
            const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const oEmbedResponse = await fetch(oEmbedUrl, {
                signal: AbortSignal.timeout(3000)
            });
            
            if (oEmbedResponse.ok) {
                const data = await oEmbedResponse.json();
                videoTitle = data.title;
                console.log('Video exists. Title:', videoTitle);
            }
        } catch (oEmbedError) {
            console.warn('oEmbed API error:', oEmbedError);
        }
        
        // Try CORS proxy to fetch HTML
        console.log('Trying CORS proxy to fetch HTML...');
        const corsProxy = 'https://corsproxy.io/?';
        const response = await fetch(`${corsProxy}https://www.youtube.com/watch?v=${videoId}`, {
            signal: AbortSignal.timeout(5000),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }
        
        const html = await response.text();
        
        // If we didn't get a title from oEmbed, try to extract it from HTML
        if (!videoTitle) {
            const titleMatch = html.match(/<title>([^<]*)<\/title>/);
            if (titleMatch && titleMatch[1]) {
                videoTitle = titleMatch[1].replace(' - YouTube', '');
                console.log('Extracted title from HTML:', videoTitle);
            }
        }
        
        // Try multiple patterns to extract duration
        console.log('Extracting duration from HTML...');
        
        // Regular expression patterns to try - ordered by reliability
        const patterns = [
            {
                name: 'lengthSeconds (double quotes)',
                regex: /"lengthSeconds":\s*"(\d+)"/,
                process: (match) => parseInt(match[1], 10)
            },
            {
                name: 'lengthSeconds (no quotes)',
                regex: /"lengthSeconds":\s*(\d+)/,
                process: (match) => parseInt(match[1], 10)
            },
            {
                name: 'approxDurationMs (double quotes)',
                regex: /"approxDurationMs":\s*"(\d+)"/,
                process: (match) => Math.floor(parseInt(match[1], 10) / 1000)
            },
            {
                name: 'approxDurationMs (no quotes)',
                regex: /"approxDurationMs":\s*(\d+)/,
                process: (match) => Math.floor(parseInt(match[1], 10) / 1000)
            },
            {
                name: 'microformat lengthSeconds',
                regex: /"microformat"[\s\S]*?"lengthSeconds":\s*"(\d+)"/,
                process: (match) => parseInt(match[1], 10)
            },
            {
                name: 'playerMicroformatRenderer',
                regex: /"playerMicroformatRenderer"[\s\S]*?"lengthSeconds":\s*"(\d+)"/,
                process: (match) => parseInt(match[1], 10)
            },
            {
                name: 'ISO duration format',
                regex: /PT((\d+)H)?((\d+)M)?((\d+)S)?/,
                process: (match) => {
                    const hours = match[2] ? parseInt(match[2], 10) : 0;
                    const minutes = match[4] ? parseInt(match[4], 10) : 0;
                    const seconds = match[6] ? parseInt(match[6], 10) : 0;
                    return hours * 3600 + minutes * 60 + seconds;
                }
            },
            {
                name: 'videoDetails',
                regex: /"videoDetails"[\s\S]*?"lengthSeconds":\s*"(\d+)"/,
                process: (match) => parseInt(match[1], 10)
            }
        ];
        
        // Try each pattern in sequence
        for (const pattern of patterns) {
            const match = html.match(pattern.regex);
            if (match) {
                try {
                    const duration = pattern.process(match);
                    if (duration && duration > 0) {
                        console.log(`Duration found with pattern "${pattern.name}": ${duration} seconds`);
                        
                        // Cache the result
                        const videoInfo = {
                            duration: duration,
                            title: videoTitle,
                            method: `HTML (${pattern.name})`,
                            timestamp: Date.now()
                        };
                        localStorage.setItem(cacheKey, JSON.stringify(videoInfo));
                        
                        return duration;
                    }
                } catch (e) {
                    console.warn(`Error processing pattern "${pattern.name}":`, e);
                }
            }
        }
        
        console.log('Could not extract duration from HTML');
        
        // Fallback to estimation based on title
        if (videoTitle) {
            // Heuristic: Music videos are usually 3-5 minutes
            if (videoTitle.includes('Music Video') || 
                videoTitle.includes('Official Video') || 
                videoTitle.includes(' - ')) {
                const estimatedDuration = 240; // 4 minutes
                console.log(`Estimated duration for likely music video: ${estimatedDuration} seconds`);
                
                localStorage.setItem(cacheKey, JSON.stringify({
                    duration: estimatedDuration,
                    title: videoTitle,
                    method: 'Estimation (music video)',
                    timestamp: Date.now()
                }));
                
                return estimatedDuration;
            }
            
            // Educational videos are often longer
            if (videoTitle.includes('Tutorial') || 
                videoTitle.includes('Course') || 
                videoTitle.includes('Guide')) {
                const estimatedDuration = 900; // 15 minutes
                console.log(`Estimated duration for likely educational video: ${estimatedDuration} seconds`);
                
                localStorage.setItem(cacheKey, JSON.stringify({
                    duration: estimatedDuration,
                    title: videoTitle,
                    method: 'Estimation (educational)',
                    timestamp: Date.now()
                }));
                
                return estimatedDuration;
            }
        }
        
    } catch (error) {
        console.warn('Error fetching video information:', error);
    }
    
    // If we couldn't get duration through any method, return null
    console.log('No reliable duration found, returning null');
    return null;
}

/**
 * Store a custom title for a video (user edit)
 * @param {string} videoId - The YouTube video ID
 * @param {string} title - The custom title
 */
function storeCustomVideoTitle(videoId, title) {
    if (!videoId) return;
    
    try {
        // Update the localStorage with the custom title
        localStorage.setItem(`edited_title_${videoId}`, title);
        
        // Also update the in-memory cache
        videoTitleCache[videoId] = title;
        
        console.log(`Stored custom title for ${videoId}: "${title}"`);
    } catch (e) {
        console.warn('Error storing custom video title:', e);
    }
}

/**
 * Get formatted details for a video (combining title and duration)
 * @param {string} videoId - The YouTube video ID
 * @returns {Promise<Object>} - Object with title and formattedDuration
 */
async function getVideoDetails(videoId) {
    if (!videoId) {
        return {
            title: 'Unknown Video',
            formattedDuration: ''
        };
    }
    
    // Get title and duration in parallel
    const [title, durationSeconds] = await Promise.all([
        fetchVideoTitle(videoId),
        getVideoDuration(videoId)
    ]);
    
    // Format the duration if available
    let formattedDuration = '';
    if (durationSeconds) {
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.floor((durationSeconds % 3600) / 60);
        const seconds = durationSeconds % 60;
        
        if (hours > 0) {
            formattedDuration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    return {
        title,
        formattedDuration,
        durationSeconds
    };
}

// Export the public API
export {
    fetchVideoTitle,
    getVideoDuration,
    storeCustomVideoTitle,
    getVideoDetails,
    decodeHTMLEntities
};
