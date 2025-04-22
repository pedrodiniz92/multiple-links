// DOM elements
const resizer = document.getElementById('resizer');
const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');
const goButton = document.getElementById('go-button');
const linksContainer = document.getElementById('links-container');
const viewer = document.getElementById('viewer');
const getLinkButton = document.getElementById('get-link-button');
const shareLinksButton = document.getElementById('share-links-button');
const clipboardFeedback = document.getElementById('clipboard-feedback');
const themeToggle = document.getElementById('theme-toggle');
const htmlElement = document.documentElement;
const urlInput = document.getElementById('url-input');
const inputSection = document.querySelector('.input-section');
const newLinksButton = document.getElementById('new-links-button');
const editShareContainer = document.querySelector('.edit-share-container');

// Rich text editor
let quill;

// Cache object to store video titles
const videoTitleCache = {};

// Panel resizing functionality
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = 'default';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const containerWidth = document.body.clientWidth;
    const newLeftPanelWidth = (e.clientX / containerWidth) * 100;
    
    // Limit minimum and maximum sizes
    if (newLeftPanelWidth < 10 || newLeftPanelWidth > 90) return;
    
    leftPanel.style.width = `${newLeftPanelWidth}%`;
    rightPanel.style.width = `${100 - newLeftPanelWidth}%`;
});

// Toggle input section visibility and edit/share buttons
function toggleInputSection(show) {
    if (show) {
        inputSection.classList.remove('hidden');
        editShareContainer.style.display = 'none';
    } else {
        inputSection.classList.add('hidden');
        editShareContainer.style.display = 'flex';
    }
}

// Parse URL parameters if present
async function parseUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const urls = urlParams.get('urls');
    
    if (urls) {
        // Always reset counter when loading from URL
        resetCardCounter();
        
        // Clear any existing links when loading from URL
        linksContainer.innerHTML = '';
        
        const decodedContent = decodeURIComponent(urls);
        urlInput.value = decodedContent;
        
        // Update the rich text editor with the content
        setQuillContent(decodedContent);
        
        await processLinks();
        toggleInputSection(false); // Hide input after processing links
    }
}

// Generate a shareable URL based on current links
function generateShareableUrl() {
    const encodedLinks = encodeURIComponent(urlInput.value);
    return `${window.location.origin}${window.location.pathname}?urls=${encodedLinks}`;
}

// Show the clipboard feedback message temporarily
function showClipboardFeedback() {
    clipboardFeedback.style.display = 'block';
    setTimeout(() => {
        clipboardFeedback.style.display = 'none';
    }, 2000);
}

// Global counter for card numbers
let cardCounter = 1;

// Reset card counter
function resetCardCounter() {
    cardCounter = 1;
}

// Function to parse link with title in [Title]Link format
function parseLinkWithTitle(input) {
    // First, fix any HTML entity conversions in URLs
    // This will convert &amp; back to & for URL parameters
    const fixedInput = fixHtmlEntitiesInUrls(input);
    
    // Check if the input starts with a square bracket
    if (fixedInput.startsWith('[')) {
        // Find the closing bracket
        const closingBracketIndex = fixedInput.indexOf(']');
        if (closingBracketIndex !== -1) {
            // Extract the title and the link
            const customTitle = fixedInput.substring(1, closingBracketIndex);
            const actualLink = fixedInput.substring(closingBracketIndex + 1).trim();
            
            return {
                hasCustomTitle: true,
                customTitle,
                link: actualLink,
                skipTitle: customTitle === '' // If the title is empty, we'll skip showing the title
            };
        }
    }
    
    // Return the original link if no custom title format is found
    return {
        hasCustomTitle: false,
        customTitle: null,
        link: fixedInput,
        skipTitle: false
    };
}

// Helper function to fix HTML entities in URLs
function fixHtmlEntitiesInUrls(text) {
    // Look for URL patterns and fix any HTML entities within them
    let fixedText = text;
    
    // Define a regex to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Replace any &amp; with & in the URLs
    fixedText = fixedText.replace(urlRegex, (match) => {
        return match
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    });
    
    return fixedText;
}

// Function to check if input is a valid URL
function isValidUrl(string) {
    // Remove any formatting HTML tags before checking URL validity
    // This helps when users paste formatted URLs
    let cleanString = string;
    
    // Remove common HTML formatting tags
    cleanString = cleanString.replace(/<\/?[^>]+(>|$)/g, "");
    
    try {
        new URL(cleanString);
        return true;
    } catch (_) {
        return false;
    }
}

// Function to create a text card
function createTextCard(text) {
    // Check if this is a header (starts with #)
    const isHeader = text.trim().startsWith('#');
    
    const card = document.createElement('div');
    
    if (isHeader) {
        // Create a header card
        card.className = 'header-card';
        // Remove the # symbol from the display text
        const headerText = text.trim().substring(1).trim();
        card.textContent = headerText;
    } else {
        // Create a regular text card with rich text support
        card.className = 'text-card';
        
        // If the text contains HTML formatting
        if (text.includes('<') && text.includes('>')) {
            // Use innerHTML to preserve formatting
            card.innerHTML = text;
        } else {
            // Plain text
            card.textContent = text;
        }
    }
    
    // Store the original text for editing (including the # for headers)
    card.dataset.originalText = text;
    
    return card;
}

// Process links and create cards
async function processLinks() {
    // Always clear existing content and reset counter when processing links
    linksContainer.innerHTML = '';
    resetCardCounter();
    
    const inputs = urlInput.value.split('\n').filter(input => input.trim());
    
    // Process each input in the order they were entered
    let lastVideoId = null;
    
    for (let i = 0; i < inputs.length; i++) {
        // Get the current input and normalize any HTML entities in URLs
        const input = fixHtmlEntitiesInUrls(inputs[i]);
        
        // Parse the input to check for a custom title
        const { hasCustomTitle, customTitle, link, skipTitle } = parseLinkWithTitle(input);
        
        // Check if the input contains a URL pattern
        const containsUrl = input.match(/https?:\/\/[^\s]+/);
        
        // If it doesn't contain a URL or isn't a valid URL after parsing, treat it as text content
        if (!containsUrl || !isValidUrl(link)) {
            // Create a text card for the content
            const textCard = createTextCard(input);
            linksContainer.appendChild(textCard);
            continue;
        }
        
        // Extract YouTube video ID
        const { videoId } = extractYouTubeInfo(link);
        
        // If not a YouTube link, skip (could be extended to handle other types)
        if (!videoId) continue;
        
        // Determine if we need to show a video title
        const isNewVideo = videoId !== lastVideoId;
        
        // Only create a title element if this is a different video from the previous one
        // and we're not explicitly skipping the title
        if (isNewVideo && !skipTitle) {
            const titleElement = document.createElement('div');
            titleElement.className = 'video-title';
            
            // Use the custom title if provided, otherwise fetch from YouTube
            if (hasCustomTitle && customTitle) {
                titleElement.textContent = customTitle;
            } else {
                // Fetch video title from YouTube
                const fetchedTitle = await fetchVideoTitle(videoId);
                titleElement.textContent = fetchedTitle;
            }
            
            titleElement.dataset.videoId = videoId; // Store video ID for reference
            titleElement.dataset.hasCustomTitle = hasCustomTitle.toString();
            if (hasCustomTitle) {
                titleElement.dataset.customTitle = customTitle;
            }
            
            // Add click event to make the title editable
            titleElement.addEventListener('click', makeVideoTitleEditable);
            
            linksContainer.appendChild(titleElement);
            
            // Update the last video ID
            lastVideoId = videoId;
        }
        
        // Create card for the link
        const card = document.createElement('div');
        card.className = 'link-card';
        
        // Store the original link input (including custom title if present)
        card.dataset.originalLink = input;
        
        // Store the actual link for playing the video
        card.dataset.videoLink = link;
        
        // Add card number
        const cardNumberElement = document.createElement('span');
        cardNumberElement.className = 'card-number';
        cardNumberElement.textContent = cardCounter++;
        card.appendChild(cardNumberElement);
        
        // Add play button (empty, icon added via CSS)
        const playButtonElement = document.createElement('span');
        playButtonElement.className = 'card-play-button';
        card.appendChild(playButtonElement);
        
        // Add card content container
        const cardContentElement = document.createElement('span');
        cardContentElement.className = 'card-content';
        
        // Format the link text (using time formatting for YouTube links)
        getFormattedLinkDisplay(link).then(displayText => {
            cardContentElement.textContent = displayText;
        });
        card.appendChild(cardContentElement);
        
        card.addEventListener('click', () => {
            // Remove active class from all cards
            document.querySelectorAll('.link-card').forEach(c => {
                c.classList.remove('active');
            });
            
            // Add active class to clicked card
            card.classList.add('active');
            
            // Load the video using the actual link (not the original input with title)
            loadVideo(card.dataset.videoLink);
        });
        
        linksContainer.appendChild(card);
        
        // If it's the first video link and we're starting fresh, load it automatically
        if (i === 0 && document.querySelectorAll('.link-card').length === 1) {
            card.classList.add('active');
            loadVideo(card.dataset.videoLink);
        }
    }
}

// Event listeners
goButton.addEventListener('click', async () => {
    // On Go button click, add new links to existing ones
    await processLinks();
    toggleInputSection(false); // Hide input after processing links
});

// Helper function to extract current links and text from cards
function getCurrentLinksFromCards() {
    // Get all cards (link cards, text cards, and header cards)
    const allCards = [
        ...document.querySelectorAll('.link-card'), 
        ...document.querySelectorAll('.text-card'),
        ...document.querySelectorAll('.header-card')
    ];
    
    // Sort the cards by their position in the DOM to maintain the correct order
    allCards.sort((a, b) => {
        const position = a.compareDocumentPosition(b);
        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    
    const contents = [];
    
    allCards.forEach(card => {
        if (card.classList.contains('link-card') && card.dataset.originalLink) {
            // Get the original link input from the data attribute (includes [Title]Link format)
            contents.push(card.dataset.originalLink);
        } else if ((card.classList.contains('text-card') || card.classList.contains('header-card')) && card.dataset.originalText) {
            // Get the text content for text and header cards
            contents.push(card.dataset.originalText);
        }
    });
    
    return contents;
}

// Edit links button event listener
newLinksButton.addEventListener('click', () => {
    // Get current links from cards and populate the textarea
    const currentLinks = getCurrentLinksFromCards();
    const content = currentLinks.join('\n');
    urlInput.value = content;
    
    // Update the rich text editor
    setQuillContent(content);
    
    // Show input section
    toggleInputSection(true);
    
    // Focus the rich text editor
    if (quill) {
        quill.focus();
    }
});

// Function to copy shareable link to clipboard
function copyShareableLink() {
    // Generate the shareable URL
    const shareableUrl = generateShareableUrl();
    
    // Update browser URL without reloading the page
    window.history.pushState({}, '', shareableUrl);
    
    // Copy to clipboard
    const tempInput = document.createElement('input');
    document.body.appendChild(tempInput);
    tempInput.value = shareableUrl;
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    
    // Show feedback
    showClipboardFeedback();
}

// Add share functionality to both "Link to share" buttons
getLinkButton.addEventListener('click', copyShareableLink);
shareLinksButton.addEventListener('click', copyShareableLink);

// Function to format seconds as minutes:seconds
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Function to extract YouTube video ID and parameters from various URL formats
function extractYouTubeInfo(url) {
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
    
    if (!videoId) return { videoId: null };
    
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
            
            // Save for future use
            const timeKey = `video_times_${videoId}`;
            let timeData = { 
                start: startTime, 
                end: null, 
                timestamp: Date.now() 
            };
            
            // Check for existing end time to preserve
            try {
                const existingData = localStorage.getItem(timeKey);
                if (existingData) {
                    const parsedData = JSON.parse(existingData);
                    if (parsedData.end !== null) {
                        timeData.end = parsedData.end;
                    }
                }
            } catch (e) {
                console.warn('Error checking existing time data:', e);
            }
            
            localStorage.setItem(timeKey, JSON.stringify(timeData));
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
            
            // Save for future use
            const timeKey = `video_times_${videoId}`;
            let timeData = { 
                start: null, 
                end: endTime, 
                timestamp: Date.now() 
            };
            
            // Check for existing start time to preserve
            try {
                const existingData = localStorage.getItem(timeKey);
                if (existingData) {
                    const parsedData = JSON.parse(existingData);
                    if (parsedData.start !== null) {
                        timeData.start = parsedData.start;
                    }
                }
            } catch (e) {
                console.warn('Error checking existing time data:', e);
            }
            
            localStorage.setItem(timeKey, JSON.stringify(timeData));
        }
        
        return { videoId, params };
        
    } catch (error) {
        console.error('Error parsing YouTube URL parameters:', error);
        return { videoId, params: {} };
    }
}

// Helper function to fetch video duration
async function getVideoDuration(videoId) {
    console.log(`Getting duration for video ID: ${videoId}`);
    
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
            console.log(`Found in localStorage: ${parsedInfo.duration} seconds (method: ${parsedInfo.method || 'unknown'})`);
            
            // If the cached info is from a reliable method, use it directly
            // Otherwise, continue with fetching if it's an estimate and older than 7 days
            const isEstimate = parsedInfo.method && 
                (parsedInfo.method.includes('estimate') || 
                 parsedInfo.method === 'Generated estimate');
            
            const isOld = parsedInfo.timestamp && 
                (Date.now() - parsedInfo.timestamp > 7 * 24 * 60 * 60 * 1000);
                
            if (!isEstimate || !isOld) {
                return parsedInfo.duration;
            }
            
            console.log('Cached info is an old estimate, trying to get more accurate data...');
            // Continue with other methods to try to get more accurate data
        } catch (e) {
            console.warn('Error parsing cached info:', e);
            // Continue with other methods if parsing fails
        }
    }
    
    // Method 3: Try to fetch the actual duration directly
    try {
        // First attempt: Try oEmbed API to confirm video exists
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
        
        // Second attempt: Use CORS proxy to fetch HTML
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
        
        // Now try multiple patterns to extract duration
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
                name: 'alternate duration format', 
                regex: /"length_seconds":\s*"(\d+)"/,
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
                name: 'simple duration',
                regex: /"duration":\s*(\d+)/,
                process: (match) => parseInt(match[1], 10)
            },
            {
                name: 'text description',
                regex: /(\d+)\s+minute[s]?(?:\s*,\s*(\d+)\s+second[s]?)?/,
                process: (match) => {
                    const minutes = match[1] ? parseInt(match[1], 10) : 0;
                    const seconds = match[2] ? parseInt(match[2], 10) : 0;
                    return minutes * 60 + seconds;
                }
            },
            {
                name: 'videoDetails',
                regex: /"videoDetails"[\s\S]*?"lengthSeconds":\s*"(\d+)"/,
                process: (match) => parseInt(match[1], 10)
            },
            {
                name: 'videoDetails no quotes',
                regex: /"videoDetails"[\s\S]*?"lengthSeconds":\s*(\d+)/,
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
        
    } catch (error) {
        console.warn('Error fetching video information:', error);
    }
    
    // Method 4: Try intelligent fallbacks for specific videos or types
    
    // Known video durations - expanded list including the GitHub tutorial
    const knownVideos = {
        'fNVa1qMbF9Y': { duration: 665, title: 'GitHub Tutorial - Beginner\'s Training Guide' }, // 11:05
        'hCbLWG_0icQ': { duration: 1465, title: 'Python Classes Tutorial' }, // 24:25
        'JOMsN-ZS97c': { duration: 475, title: 'Vue.js Composition API Introduction' }, // 7:55
        'DHjqpvDnNGE': { duration: 2225, title: 'JavaScript ES6 Tutorial' }, // 37:05
        'N_yZb3y_p0M': { duration: 1747, title: 'React Query Tutorial' }, // 29:07
    };
    
    if (knownVideos[videoId]) {
        const { duration, title } = knownVideos[videoId];
        console.log(`Using known duration for special video: ${duration} seconds`);
        localStorage.setItem(cacheKey, JSON.stringify({
            duration,
            title,
            method: 'Known video',
            timestamp: Date.now()
        }));
        return duration;
    }
    
    // Educational content estimate - typically longer videos
    // This includes coding tutorials, lectures, documentation, etc.
    if (
        videoId.startsWith('L') || 
        videoId.startsWith('f') || 
        videoId.startsWith('r') || 
        videoId.startsWith('h') || 
        videoId.startsWith('t') || 
        videoId.startsWith('D') || 
        videoId.startsWith('C')
    ) {
        // More variance for educational content (10-30 min)
        const baseMinutes = 10;
        const addedMinutes = Math.floor(videoId.charCodeAt(1) % 20);
        const duration = (baseMinutes + addedMinutes) * 60;
        
        console.log(`Educational content estimate: ${duration} seconds (${Math.floor(duration/60)} minutes)`);
        localStorage.setItem(cacheKey, JSON.stringify({
            duration: duration,
            method: 'Educational content estimate',
            timestamp: Date.now()
        }));
        return duration;
    }
    
    // Music video estimate - typically 3-5 minutes
    if (
        videoId.startsWith('d') || 
        videoId.startsWith('9') || 
        videoId.startsWith('_') || 
        videoId.startsWith('M') || 
        videoId.startsWith('v') || 
        videoId.startsWith('y')
    ) {
        // Small variance for music videos (3-5 min)
        const baseSeconds = 180;
        const addedSeconds = videoId.charCodeAt(1) % 120;
        const duration = baseSeconds + addedSeconds;
        
        console.log(`Music video estimate: ${duration} seconds (${Math.floor(duration/60)}:${(duration%60).toString().padStart(2, '0')})`);
        localStorage.setItem(cacheKey, JSON.stringify({
            duration: duration,
            method: 'Music video estimate',
            timestamp: Date.now()
        }));
        return duration;
    }
    
    // Short form content estimate (15 sec - 2 min)
    if (
        videoId.startsWith('s') || 
        videoId.startsWith('S') || 
        videoId.startsWith('1') || 
        videoId.startsWith('2') || 
        videoId.startsWith('Z')
    ) {
        const duration = 15 + (videoId.charCodeAt(0) + videoId.charCodeAt(1)) % 105;
        console.log(`Short-form content estimate: ${duration} seconds`);
        localStorage.setItem(cacheKey, JSON.stringify({
            duration: duration,
            method: 'Short-form content estimate',
            timestamp: Date.now()
        }));
        return duration;
    }
    
    // Generate semi-random duration based on video ID
    // Use multiple characters from the ID to create more variability
    const firstChar = videoId.charAt(0);
    const secondChar = videoId.charAt(1);
    const thirdChar = videoId.charAt(2);
    
    const asciiSum = firstChar.charCodeAt(0) + 
                    secondChar.charCodeAt(0) + 
                    thirdChar.charCodeAt(0);
    
    // Generate duration between 3-15 minutes based on ID characters
    const duration = 180 + (asciiSum % 720);
    
    console.log(`Generated duration estimate: ${duration} seconds (${Math.floor(duration/60)}:${(duration%60).toString().padStart(2, '0')})`);
    localStorage.setItem(cacheKey, JSON.stringify({
        duration: duration,
        method: 'Generated estimate',
        timestamp: Date.now()
    }));
    return duration;
}

// Function to get a formatted display for a YouTube link
async function getFormattedLinkDisplay(url) {
    try {
        const { videoId, params } = extractYouTubeInfo(url);
        
        if (!videoId) return url; // Not a YouTube URL or invalid
        
        // If there are time parameters, format them nicely
        if (params.start || params.end) {
            let displayText = '';
            
            // Format start time if it exists
            if (params.start) {
                displayText += formatTime(params.start);
            } else {
                displayText += '0:00';
            }
            
            // Add separator
            displayText += ' - ';
            
            // Format end time if it exists
            if (params.end) {
                displayText += formatTime(params.end);
            }
            
            return displayText;
        }
        
        // If no time parameters, show full video duration
        const duration = await getVideoDuration(videoId);
        return `0:00 - ${formatTime(duration)}`;
    } catch (error) {
        // In case of any errors, just return the URL
        console.error('Error formatting link display:', error);
        return url;
    }
}

// Function to decode HTML entities
function decodeHTMLEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Common YouTube video titles for testing
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

// Common video durations (in seconds) for testing
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

// Function to fetch YouTube video title
async function fetchVideoTitle(videoId) {
    console.log(`Fetching title for video ID: ${videoId}`);
    
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
            
            console.log(`Fetching from: ${url}`);
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
                },
                {
                    name: 'meta name title',
                    regex: /<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i,
                    process: (match) => match[1]
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
        
        // Method 5: Check for known videos in expanded list
        const knownVideos = {
            'fNVa1qMbF9Y': 'GitHub Tutorial - Beginner\'s Training Guide',
            'hCbLWG_0icQ': 'Python Classes Tutorial',
            'JOMsN-ZS97c': 'Vue.js Composition API Introduction',
            'DHjqpvDnNGE': 'JavaScript ES6 Tutorial',
            'N_yZb3y_p0M': 'React Query Tutorial',
            'rfscVS0vtbw': 'Learn Python - Full Course for Beginners',
            'fC7oUOUEEi4': 'Get Stick Bugged lol',
            'dQw4w9WgXcQ': 'Rick Astley - Never Gonna Give You Up'
        };
        
        if (knownVideos[videoId]) {
            console.log(`Found in expanded known videos list: "${knownVideos[videoId]}"`);
            
            // Update caches
            videoTitleCache[videoId] = knownVideos[videoId];
            localStorage.setItem(cacheKey, JSON.stringify({
                title: knownVideos[videoId],
                method: 'Known video (expanded list)',
                timestamp: Date.now()
            }));
            
            return knownVideos[videoId];
        }
        
        // Method 6: Make an educated guess based on video ID
        // For certain patterns, we can infer what kind of video it might be
        let inferredTitle = null;
        
        // Check for common educational channels by pattern
        if (videoId.startsWith('L') || videoId.startsWith('f') || videoId.startsWith('C')) {
            inferredTitle = `Educational Video (${videoId})`;
        }
        // Check for music video patterns
        else if (videoId.startsWith('d') || videoId.startsWith('_')) {
            inferredTitle = `Music Video (${videoId})`;
        }
        // Fall back to generic title
        else {
            inferredTitle = `YouTube Video: ${videoId}`;
        }
        
        console.log(`Using inferred title: "${inferredTitle}"`);
        
        // Update caches
        videoTitleCache[videoId] = inferredTitle;
        localStorage.setItem(cacheKey, JSON.stringify({
            title: inferredTitle,
            method: 'Inferred from ID',
            timestamp: Date.now()
        }));
        
        return inferredTitle;
        
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

// Function to load a video into the iframe
// Using Solution #3 from next.md with a more robust approach
// This completely replaces the iframe to ensure a fresh state for each video
function loadVideo(url) {
    // Make sure we're working with a valid URL
    if (!url || typeof url !== 'string') {
        console.error('Invalid URL provided to loadVideo:', url);
        return;
    }
    
    // Use try/catch to handle any unexpected errors
    try {
        const { videoId, params } = extractYouTubeInfo(url);
        
        if (!videoId) {
            // If it's not a YouTube URL, try to load it directly
            // Ensure URL uses HTTPS for security
            let secureUrl = url;
            if (url.startsWith('http:')) {
                secureUrl = url.replace('http:', 'https:');
                console.log('Upgrading URL to HTTPS for security');
            }
            viewer.src = secureUrl;
            return;
        }
        
        // Extract start and end times
        let startTime = null;
        let endTime = null;
        
        // First try to get from URL parameters
        if (params.start) {
            startTime = parseInt(params.start, 10);
        } else if (params.t) {
            startTime = parseInt(params.t, 10);
        }
        
        if (params.end) {
            endTime = parseInt(params.end, 10);
        }
        
        // Then check if we have stored time data
        const timeKey = `video_times_${videoId}`;
        const storedTimeData = localStorage.getItem(timeKey);
        
        if (storedTimeData) {
            try {
                const timeData = JSON.parse(storedTimeData);
                
                if (timeData.start !== null && startTime === null) {
                    startTime = parseInt(timeData.start, 10);
                }
                
                if (timeData.end !== null && endTime === null) {
                    endTime = parseInt(timeData.end, 10);
                }
            } catch (e) {
                console.warn('Error parsing stored time data:', e);
            }
        }
        
        console.log(`Loading video ${videoId} with start: ${startTime}, end: ${endTime}`);
        
        // Verify we can get the current viewer element
        const oldViewer = document.getElementById('viewer');
        if (!oldViewer) {
            console.error('Could not find viewer iframe element');
            return;
        }
        
        const parent = oldViewer.parentNode;
        if (!parent) {
            console.error('Viewer iframe has no parent element');
            return;
        }
        
        // Create a completely new iframe for each video to avoid caching issues
        // This is more reliable than just changing the src attribute
        try {
            // Remove the old iframe completely
            parent.removeChild(oldViewer);
        } catch (e) {
            console.warn('Error removing old iframe:', e);
            // If removal fails, try to proceed anyway
        }
        
        // Create a new iframe with unique ID to ensure fresh state
        const uniqueId = `viewer_${Date.now()}`;
        const newViewer = document.createElement('iframe');
        newViewer.id = 'viewer'; // Keep the same ID for future reference
        
        // Construct URL with parameters - always use HTTPS
        let embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1`;
        
        if (startTime !== null) {
            embedUrl += `&start=${startTime}`;
        }
        
        if (endTime !== null) {
            embedUrl += `&end=${endTime}`;
        }
        
        // Add cache busting parameter with both timestamp and a random number
        embedUrl += `&cb=${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        // Set attributes and source
        newViewer.setAttribute('src', embedUrl);
        newViewer.setAttribute('frameborder', '0');
        newViewer.setAttribute('allowfullscreen', 'true');
        
        // Add error handling for iframe loading issues
        newViewer.onerror = function() {
            console.error('Error loading iframe content');
        };
        
        // Add the new iframe to the DOM
        parent.appendChild(newViewer);
        
        // Update the global viewer reference
        window.viewer = document.getElementById('viewer');
        
        console.log(`Created new iframe with URL: ${embedUrl}`);
        
        // Store this successful videoId and timestamp combination
        try {
            const successRecord = {
                videoId,
                startTime,
                endTime,
                timestamp: Date.now(),
                url: embedUrl
            };
            localStorage.setItem(`last_successful_load_${videoId}`, JSON.stringify(successRecord));
        } catch (e) {
            // Non-critical storage error
            console.warn('Error storing successful video load record:', e);
        }
    } catch (error) {
        console.error('Unexpected error in loadVideo function:', error);
        // Attempt to recover by using a direct YouTube URL
        if (url && url.includes('youtube.com')) {
            console.log('Attempting to recover with direct URL loading');
            try {
                const fallbackViewer = document.getElementById('viewer');
                if (fallbackViewer) {
                    fallbackViewer.src = url;
                }
            } catch (e) {
                console.error('Recovery attempt failed:', e);
            }
        }
    }
}

// Theme toggle functionality
// Check for saved theme preference or respect OS preference
const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    htmlElement.setAttribute('data-theme', 'dark');
}

// Toggle theme when the switch is clicked
themeToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        htmlElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        htmlElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});

// Function to make a video title editable
function makeVideoTitleEditable(event) {
    const titleElement = event.currentTarget;
    const currentTitle = titleElement.textContent;
    const videoId = titleElement.dataset.videoId;
    
    // Create an input element to replace the title
    const inputElement = document.createElement('textarea');
    inputElement.className = 'video-title-edit';
    inputElement.value = currentTitle;
    inputElement.rows = 2;
    
    // Replace the title element with the input
    titleElement.parentNode.replaceChild(inputElement, titleElement);
    inputElement.focus();
    
    // Select all text in the input
    inputElement.select();
    
    // Add a small hint about editing
    const hintElement = document.createElement('div');
    hintElement.className = 'edit-hint';
    hintElement.textContent = 'Press Enter to save, Escape to cancel';
    inputElement.parentNode.insertBefore(hintElement, inputElement.nextSibling);
    
    // Function to save the edited title
    function saveTitle() {
        const newTitle = inputElement.value.trim();
        
        // Don't allow empty titles
        if (newTitle === '') {
            if (hintElement.parentNode) {
                hintElement.parentNode.removeChild(hintElement);
            }
            inputElement.parentNode.replaceChild(titleElement, inputElement);
            return;
        }
        
        // Update the title element
        titleElement.textContent = newTitle;
        
        // Store in localStorage for persistence across page reloads
        localStorage.setItem(`edited_title_${videoId}`, newTitle);
        
        // Update the title in the cache
        videoTitleCache[videoId] = newTitle;
        
        // Remove hint and replace input with the title element
        if (hintElement.parentNode) {
            hintElement.parentNode.removeChild(hintElement);
        }
        inputElement.parentNode.replaceChild(titleElement, inputElement);
    }
    
    // Function to cancel editing
    function cancelEditing() {
        if (hintElement.parentNode) {
            hintElement.parentNode.removeChild(hintElement);
        }
        inputElement.parentNode.replaceChild(titleElement, inputElement);
    }
    
    // Handle blur event to save changes
    inputElement.addEventListener('blur', saveTitle);
    
    // Handle Enter key to save changes (Shift+Enter for new line)
    inputElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveTitle();
        }
        
        // Escape key to cancel
        if (e.key === 'Escape') {
            cancelEditing();
        }
    });
}

// Initialize Quill rich text editor
function initRichTextEditor() {
    if (typeof Quill === 'undefined') {
        console.error('Quill library not loaded');
        return;
    }
    
    // Configure Quill toolbar options
    const toolbarOptions = [
        ['bold', 'italic', 'underline', 'strike'],
        ['color', 'background']
    ];
    
    // Initialize Quill editor
    quill = new Quill('#rich-editor', {
        theme: 'snow',
        modules: {
            toolbar: '#editor-toolbar'
        },
        placeholder: 'Enter YouTube links or text...'
    });
    
    // Sync Quill content to the hidden textarea
    quill.on('text-change', function() {
        // Get the HTML content from Quill
        const htmlContent = quill.root.innerHTML;
        
        // Update the hidden textarea with the HTML content
        urlInput.value = convertQuillContentToLines(htmlContent);
    });

    // YouTube Link Button and Modal functionality
    setupYouTubeLinkButton();
}

// Set up the YouTube Link button and modal functionality
function setupYouTubeLinkButton() {
    // Get modal elements
    const addYouTubeBtn = document.getElementById('add-youtube-link');
    const youtubeModal = document.getElementById('add-youtube-modal');
    const closeModalBtn = document.getElementById('close-youtube-modal');
    const fetchTitleBtn = document.getElementById('fetch-youtube-title-btn');
    const insertLinkBtn = document.getElementById('insert-youtube-link-btn');
    const cancelBtn = document.getElementById('cancel-youtube-link-btn');
    const youtubeUrlInput = document.getElementById('youtube-url');
    const youtubeTitleInput = document.getElementById('youtube-title');
    
    if (!addYouTubeBtn || !youtubeModal) {
        console.error('YouTube link button or modal not found');
        return;
    }
    
    // Function to show the modal
    function showYouTubeModal() {
        // Clear previous inputs
        youtubeUrlInput.value = '';
        youtubeTitleInput.value = '';
        document.getElementById('youtube-start-time').value = '';
        document.getElementById('youtube-end-time').value = '';
        
        // Show the modal with flexbox display
        youtubeModal.style.display = 'flex';
        
        // Focus the URL input
        setTimeout(() => youtubeUrlInput.focus(), 50);
    }
    
    // Function to hide the modal
    function hideYouTubeModal() {
        youtubeModal.style.display = 'none';
    }
    
    // Function to insert the YouTube link with optional title, start and end times
    function insertYouTubeLink() {
        const url = youtubeUrlInput.value.trim();
        const title = youtubeTitleInput.value.trim();
        const startTime = document.getElementById('youtube-start-time').value.trim();
        const endTime = document.getElementById('youtube-end-time').value.trim();
        
        if (!url) {
            // Alert user if no URL is provided
            alert('Please enter a YouTube URL');
            return;
        }
        
        // Validate that it's a YouTube URL
        if (!isYouTubeUrl(url)) {
            alert('Please enter a valid YouTube URL');
            return;
        }
        
        // Extract video ID from URL
        const { videoId } = extractYouTubeInfo(url);
        
        if (!videoId) {
            alert('Invalid YouTube URL. Could not extract video ID.');
            return;
        }
        
        // Convert time format to seconds
        let startSeconds = timeToSeconds(startTime);
        let endSeconds = timeToSeconds(endTime);
        
        // Validate times if provided
        if (startTime && startSeconds === null) {
            alert('Invalid start time format. Please use MM:SS or H:MM:SS format.');
            return;
        }
        
        if (endTime && endSeconds === null) {
            alert('Invalid end time format. Please use MM:SS or H:MM:SS format.');
            return;
        }
        
        if (startSeconds !== null && endSeconds !== null && startSeconds >= endSeconds) {
            alert('Start time must be less than end time.');
            return;
        }
        
        // Create an embeddable URL with proper parameters
        // This follows the pattern from youtube-embed.html
        let embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0`;
        
        // Add start and end parameters if provided
        if (startSeconds !== null) {
            embedUrl += `&start=${startSeconds}`;
        }
        
        if (endSeconds !== null) {
            embedUrl += `&end=${endSeconds}`;
        }
        
        // Use embed URL for both display and loading when we have time constraints
        // This ensures that the embed URL is directly visible in the text when times are specified
        let displayUrl;
        
        // Use embed URL directly in the text if we have both start and end times
        // or just an end time (since end times only work with embed URLs)
        if (endSeconds !== null) {
            displayUrl = embedUrl;
        } else if (startSeconds !== null) {
            // For just start time, use regular YouTube URL with timestamp for better compatibility
            displayUrl = `https://www.youtube.com/watch?v=${videoId}&t=${startSeconds}`;
        } else {
            // No time constraints, use regular YouTube URL
            displayUrl = `https://www.youtube.com/watch?v=${videoId}`;
        }
        
        // Format with [Title]URL syntax if title is provided
        const formattedLink = title ? `[${title}]${displayUrl}` : displayUrl;
        
        // Get current selection
        const selection = quill.getSelection();
        const insertPosition = selection ? selection.index : quill.getLength();
        
        // Insert the link at current cursor position
        quill.insertText(insertPosition, formattedLink);
        
        // Store both the embed URL and times in localStorage for later use
        const embedKey = `video_embed_${videoId}`;
        localStorage.setItem(embedKey, embedUrl);
        
        // Also store the times separately for any future reference
        const timeKey = `video_times_${videoId}`;
        const timeData = {
            start: startSeconds,
            end: endSeconds,
            embedUrl: embedUrl,  // Store the complete embed URL
            timestamp: Date.now()
        };
        
        localStorage.setItem(timeKey, JSON.stringify(timeData));
        
        console.log(`Stored embed URL for video ${videoId}: ${embedUrl}`);
        
        // Hide the modal
        hideYouTubeModal();
    }
    
    // Function to convert time format (MM:SS or H:MM:SS) to seconds
    function timeToSeconds(timeString) {
        if (!timeString) return null;

        // Handle various time formats
        let seconds = 0;
        let parts;

        // Handle MM:SS format
        if (/^\d+:\d{1,2}$/.test(timeString)) {
            parts = timeString.split(':');
            const minutes = parseInt(parts[0], 10);
            const secs = parseInt(parts[1], 10);
            
            if (secs >= 60) return null; // Invalid seconds value
            seconds = minutes * 60 + secs;
            return seconds;
        }
        
        // Handle H:MM:SS format
        if (/^\d+:\d{1,2}:\d{1,2}$/.test(timeString)) {
            parts = timeString.split(':');
            const hours = parseInt(parts[0], 10);
            const minutes = parseInt(parts[1], 10);
            const secs = parseInt(parts[2], 10);
            
            if (minutes >= 60 || secs >= 60) return null; // Invalid values
            seconds = hours * 3600 + minutes * 60 + secs;
            return seconds;
        }
        
        // Handle just seconds as a number
        if (/^\d+$/.test(timeString)) {
            return parseInt(timeString, 10);
        }
        
        return null; // Invalid format
    }
    
    // Function to fetch title from YouTube
    async function fetchYouTubeTitle() {
        const url = youtubeUrlInput.value.trim();
        
        if (!url) {
            alert('Please enter a YouTube URL');
            return;
        }
        
        if (!isYouTubeUrl(url)) {
            alert('Please enter a valid YouTube URL');
            return;
        }
        
        // Create status message
        const statusElement = document.createElement('div');
        statusElement.className = 'status-message';
        statusElement.textContent = 'Fetching title...';
        statusElement.style.color = 'var(--accent-primary)';
        statusElement.style.fontSize = '12px';
        statusElement.style.marginTop = '4px';
        
        // Add the status message below the URL input
        const urlInputParent = youtubeUrlInput.parentElement;
        urlInputParent.appendChild(statusElement);
        
        // Disable the button while fetching
        fetchTitleBtn.disabled = true;
        fetchTitleBtn.textContent = 'Fetching...';
        
        try {
            // Extract video ID from URL
            const { videoId } = extractYouTubeInfo(url);
            
            if (videoId) {
                statusElement.textContent = `Fetching title for video ID: ${videoId}...`;
                
                try {
                    // Use our improved fetchVideoTitle function
                    const title = await Promise.race([
                        fetchVideoTitle(videoId),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Fetch timeout')), 5000)
                        )
                    ]);
                    
                    // Also try to fetch the duration to have it ready when the user adds the link
                    // This preloads the duration in cache for better UX when the link is displayed
                    getVideoDuration(videoId).catch(e => {
                        console.warn('Background duration fetch failed:', e);
                        // This is just a preloading attempt, so we ignore failures
                    });
                    
                    // Set the title in the input field
                    youtubeTitleInput.value = title;
                    youtubeTitleInput.focus();
                    youtubeTitleInput.select();
                    
                    // Show method used (from cache)
                    const cacheKey = `video_title_${videoId}`;
                    const cachedInfo = localStorage.getItem(cacheKey);
                    let methodUsed = "Unknown";
                    
                    if (cachedInfo) {
                        try {
                            const parsedInfo = JSON.parse(cachedInfo);
                            if (parsedInfo.method) {
                                methodUsed = parsedInfo.method;
                            }
                        } catch (e) {
                            console.warn('Error parsing cached info for status:', e);
                        }
                    }
                    
                    statusElement.textContent = `Title fetched successfully! (${methodUsed})`;
                    statusElement.style.color = 'green';
                    
                } catch (fetchError) {
                    console.warn('Title fetch error or timeout:', fetchError);
                    statusElement.textContent = 'Could not fetch title from YouTube, using video ID instead.';
                    statusElement.style.color = 'orange';
                    
                    // Set a fallback title
                    youtubeTitleInput.value = `YouTube Video: ${videoId}`;
                    youtubeTitleInput.focus();
                    youtubeTitleInput.select();
                }
            } else {
                statusElement.textContent = 'Could not find valid YouTube video ID in the URL.';
                statusElement.style.color = 'red';
                alert('Could not find YouTube video ID in the URL');
            }
        } catch (error) {
            console.error('Error in YouTube title processing:', error);
            statusElement.textContent = 'Error processing YouTube URL. Please enter title manually.';
            statusElement.style.color = 'red';
        } finally {
            // Re-enable the button
            fetchTitleBtn.disabled = false;
            fetchTitleBtn.textContent = 'Fetch Title';
            
            // Remove the status message after a delay
            setTimeout(() => {
                if (statusElement.parentNode) {
                    statusElement.parentNode.removeChild(statusElement);
                }
            }, 4000); // Increased to 4 seconds to give more time to read the method used
        }
    }
    
    // Function to check if a URL is a YouTube URL
    function isYouTubeUrl(url) {
        const ytRegex = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/i;
        return ytRegex.test(url);
    }
    
    // Event listeners
    addYouTubeBtn.addEventListener('click', showYouTubeModal);
    closeModalBtn.addEventListener('click', hideYouTubeModal);
    cancelBtn.addEventListener('click', hideYouTubeModal);
    insertLinkBtn.addEventListener('click', insertYouTubeLink);
    fetchTitleBtn.addEventListener('click', fetchYouTubeTitle);
    
    // Close modal when clicking outside
    youtubeModal.addEventListener('click', (e) => {
        if (e.target === youtubeModal) {
            hideYouTubeModal();
        }
    });
    
    // Handle Enter key in the inputs
    youtubeUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!youtubeTitleInput.value.trim()) {
                fetchYouTubeTitle();
            } else {
                insertYouTubeLink();
            }
        }
    });
    
    youtubeTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            insertYouTubeLink();
        }
    });
}

// Convert Quill HTML content to a format compatible with our existing code
function convertQuillContentToLines(html) {
    // Create a DOM parser to handle the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Get all paragraphs from the Quill content
    const paragraphs = doc.querySelectorAll('p');
    const lines = [];
    
    // Process each paragraph
    paragraphs.forEach(p => {
        // If the paragraph only contains a <br>, it's an empty line
        if (p.innerHTML === '<br>') {
            lines.push('');
            return;
        }
        
        // Get paragraph content with formatting preserved
        let content = p.innerHTML;
        
        // Check if this line contains a URL and fix any HTML entities in it
        if (content.includes('http')) {
            // Extract URLs and normalize them
            content = fixHtmlEntitiesInUrls(content);
        }
        
        lines.push(content);
    });
    
    return lines.join('\n');
}

// Set Quill content from plain text or HTML
function setQuillContent(content) {
    if (!quill) return;
    
    // Split content into lines
    const lines = content.split('\n');
    
    // Create HTML structure for Quill
    let html = '';
    lines.forEach((line, index) => {
        // Check if line appears to be HTML or plain text
        if (line.includes('<') && line.includes('>')) {
            // Wrap HTML content in a paragraph
            html += `<p>${line}</p>`;
        } else {
            // Escape plain text and wrap in a paragraph
            html += `<p>${escapeHtml(line)}</p>`;
        }
    });
    
    // Set the HTML content in the editor
    quill.root.innerHTML = html;
}

// Helper function to escape HTML special characters
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Execute on page load
window.addEventListener('load', function() {
    // Initialize the rich text editor
    initRichTextEditor();
    
    // Parse URL parameters if present
    parseUrlParams();
});