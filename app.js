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
    // Clean the URL from any HTML tags that might have been added by the rich text editor
    const cleanUrl = url.replace(/<\/?[^>]+(>|$)/g, "");
    
    // Make sure any HTML entities in the URL are properly decoded
    const decodedUrl = cleanUrl.replace(/&amp;/g, '&');
    
    // Extract video ID
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = decodedUrl.match(regExp);
    const videoId = (match && match[7] && match[7].length === 11) ? match[7] : null;
    
    if (!videoId) return { videoId: null };
    
    try {
        // Parse URL to extract parameters
        const urlObj = new URL(decodedUrl);
        const params = {};
        
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
            params.end = endTime;
        }
        
        return { videoId, params };
        
    } catch (error) {
        console.error('Error parsing YouTube URL parameters:', error);
        return { videoId, params: {} };
    }
}

// Helper function to fetch video duration
async function getVideoDuration(videoId) {
    // Check if we have the duration in our predefined list
    if (videoDurations[videoId]) {
        return videoDurations[videoId];
    }
    
    // Try to get from localStorage if previously fetched
    const cachedDuration = localStorage.getItem(`video_duration_${videoId}`);
    if (cachedDuration) {
        return parseInt(cachedDuration, 10);
    }
    
    // In a real app, we would fetch this from the YouTube API
    // For this demo, we'll use a fallback value
    return 300; // Default to 5 minutes if unknown
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
    'DI-LKs3GpeE': 'Former Google CEO: "China Will Win AI Race Unless We Act Now" | Founder Psychology, Talent Wars, AI',
    'b4QIaBMvZqc': 'FUSION BAIÃO | Mateus Starling Quarteto | QUINTO',
    'dQw4w9WgXcQ': 'Rick Astley - Never Gonna Give You Up',
    '9bZkp7q19f0': 'PSY - GANGNAM STYLE(강남스타일)',
    'jNQXAC9IVRw': 'Me at the zoo'
};

// Common video durations (in seconds) for testing
const videoDurations = {
    'DI-LKs3GpeE': 3683, // 1:01:23
    'b4QIaBMvZqc': 238,  // 3:58
    'dQw4w9WgXcQ': 212,  // 3:32
    '9bZkp7q19f0': 253,  // 4:13
    'jNQXAC9IVRw': 19    // 0:19
};

// Function to fetch YouTube video title
async function fetchVideoTitle(videoId) {
    // Check if user has edited this title
    const editedTitle = localStorage.getItem(`edited_title_${videoId}`);
    if (editedTitle) {
        // Use user's edited title
        return editedTitle;
    }
    
    // Check cache first for original YouTube title
    if (videoTitleCache[videoId]) {
        return videoTitleCache[videoId];
    }
    
    // Check our common video list first
    if (commonVideos[videoId]) {
        videoTitleCache[videoId] = commonVideos[videoId];
        return commonVideos[videoId];
    }
    
    try {
        // For demo purposes, we'll use a simple fake title if we can't get it from CORS proxy
        const corsProxy = 'https://corsproxy.io/?';
        
        try {
            const response = await fetch(`${corsProxy}https://www.youtube.com/watch?v=${videoId}`, {
                // Add a timeout so we don't wait too long
                signal: AbortSignal.timeout(3000)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch: ${response.status}`);
            }
            
            const html = await response.text();
            
            // Try to extract title from the HTML
            const titleMatch = html.match(/<title>([^<]*)<\/title>/);
            if (titleMatch && titleMatch[1]) {
                let title = titleMatch[1];
                
                // Clean up title (remove " - YouTube" suffix)
                title = title.replace(' - YouTube', '');
                
                // Decode HTML entities
                title = decodeHTMLEntities(title);
                
                // Store in cache
                videoTitleCache[videoId] = title;
                return title;
            }
        } catch (fetchError) {
            console.warn('CORS fetch error, falling back to generated title', fetchError);
        }
        
        // If we couldn't fetch, create a fake title that still looks nice
        const fakeTitle = `YouTube Video ${videoId.substring(0, 6)}...`;
        videoTitleCache[videoId] = fakeTitle;
        return fakeTitle;
    } catch (error) {
        console.error('Error fetching video title:', error);
        const fallbackTitle = `YouTube Video ${videoId.substring(0, 6)}...`;
        videoTitleCache[videoId] = fallbackTitle;
        return fallbackTitle;
    }
}

// Function to load a video into the iframe
function loadVideo(url) {
    const { videoId, params } = extractYouTubeInfo(url);
    
    if (videoId) {
        let embedUrl = `https://www.youtube.com/embed/${videoId}`;
        
        // Add parameters if they exist
        if (Object.keys(params).length > 0) {
            embedUrl += '?';
            for (const [key, value] of Object.entries(params)) {
                embedUrl += `${key}=${value}&`;
            }
            embedUrl = embedUrl.slice(0, -1); // Remove the trailing &
        }
        
        viewer.src = embedUrl;
    } else {
        // If it's not a YouTube URL, try to load it directly
        // This will work for other websites that allow embedding
        viewer.src = url;
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