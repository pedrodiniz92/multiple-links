/**
 * YouTube modal module for handling YouTube link insertion
 * Includes modal UI management, form handling, and integration with video info services
 */

import { isYouTubeUrl, extractYouTubeInfo } from '../services/youtube-service.js';
import { fetchVideoTitle, getVideoDuration } from '../services/video-info.js';

/**
 * Initialize and set up the YouTube link modal functionality
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.modalElement - The modal container element
 * @param {HTMLElement} options.modalFeedback - Feedback element for notifications
 * @param {HTMLElement} options.youtubeUrlInput - The URL input field
 * @param {HTMLElement} options.youtubeTitleInput - The title input field
 * @param {HTMLElement} options.youtubeContextInput - The context input field
 * @param {HTMLElement} options.startTimeInput - The start time input field
 * @param {HTMLElement} options.endTimeInput - The end time input field
 * @param {HTMLElement} options.fetchTitleBtn - Button to fetch video title
 * @param {HTMLElement} options.insertLinkBtn - Button to insert the link
 * @param {HTMLElement} options.cancelBtn - Button to cancel and close modal
 * @param {HTMLElement} options.lineBreakBtn - Button to add line breaks to context
 * @param {Object} options.richEditorInstance - The rich editor instance for inserting content
 * @param {Function} options.showFeedbackMessage - Function to display feedback messages
 * @returns {Object} - Public API for the YouTube modal
 */
function initYouTubeModal(options) {
    const {
        modalElement,
        modalFeedback,
        youtubeUrlInput,
        youtubeTitleInput,
        youtubeContextInput,
        startTimeInput,
        endTimeInput,
        fetchTitleBtn,
        insertLinkBtn,
        cancelBtn,
        lineBreakBtn,
        richEditorInstance,
        showFeedbackMessage
    } = options;
    
    // Track event handlers to avoid duplication
    let eventHandlersAttached = false;
    
    /**
     * Show the YouTube modal dialog
     */
    function showModal() {
        if (!modalElement) {
            console.error('YouTube modal element not found');
            return;
        }
        
        console.log('Showing YouTube modal and setting up event handlers');
        
        // Clear previous inputs
        youtubeUrlInput.value = '';
        youtubeTitleInput.value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';
        youtubeContextInput.value = '';
        
        // Show the modal with flexbox display
        modalElement.style.display = 'flex';
        
        // Focus the URL input
        setTimeout(() => youtubeUrlInput.focus(), 50);
        
        // Set up event handlers if not already attached
        if (!eventHandlersAttached) {
            setupEventHandlers();
            eventHandlersAttached = true;
        }
    }
    
    /**
     * Hide the YouTube modal dialog
     */
    function hideModal() {
        if (modalElement) {
            modalElement.style.display = 'none';
        }
    }
    
    /**
     * Set up all event handlers for the modal
     */
    function setupEventHandlers() {
        console.log('Setting up event handlers for YouTube modal');
        
        // Set up Line Break button functionality
        if (lineBreakBtn && youtubeContextInput) {
            // Create a new button to remove any existing listeners
            const newLineBreakBtn = lineBreakBtn.cloneNode(true);
            if (lineBreakBtn.parentNode) {
                lineBreakBtn.parentNode.replaceChild(newLineBreakBtn, lineBreakBtn);
            }
            
            // Add event listener with a single click handler
            newLineBreakBtn.addEventListener('click', function() {
                console.log('Line break button clicked');
                
                // If the context input has focus, insert // at the cursor position
                if (document.activeElement === youtubeContextInput) {
                    const cursorPos = youtubeContextInput.selectionStart;
                    const textBefore = youtubeContextInput.value.substring(0, cursorPos);
                    const textAfter = youtubeContextInput.value.substring(cursorPos);
                    
                    // Insert // at cursor position (just two slashes for a single line break)
                    youtubeContextInput.value = textBefore + '//' + textAfter;
                    
                    // Move cursor after the inserted line break
                    youtubeContextInput.selectionStart = cursorPos + 2;
                    youtubeContextInput.selectionEnd = cursorPos + 2;
                } else {
                    // Otherwise, add // at the end of the context input
                    youtubeContextInput.value += '//';
                }
                
                // Focus the context input after adding the line break
                youtubeContextInput.focus();
            });
        }
        
        // Set up Cancel button
        if (cancelBtn) {
            // Create a new button to remove any existing listeners
            const newCancelBtn = cancelBtn.cloneNode(true);
            if (cancelBtn.parentNode) {
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            }
            
            // Add click event to the new button
            newCancelBtn.addEventListener('click', hideModal);
        }
        
        // Set up Insert button
        if (insertLinkBtn) {
            // Create a new button to remove any existing listeners
            const newInsertBtn = insertLinkBtn.cloneNode(true);
            if (insertLinkBtn.parentNode) {
                insertLinkBtn.parentNode.replaceChild(newInsertBtn, insertLinkBtn);
            }
            
            // Add click event to the new button
            newInsertBtn.addEventListener('click', insertYouTubeLink);
        }
        
        // Set up Fetch Title button
        if (fetchTitleBtn) {
            // Create a new button to remove any existing listeners
            const newFetchTitleBtn = fetchTitleBtn.cloneNode(true);
            if (fetchTitleBtn.parentNode) {
                fetchTitleBtn.parentNode.replaceChild(newFetchTitleBtn, fetchTitleBtn);
            }
            
            // Add click event to the new button
            newFetchTitleBtn.addEventListener('click', fetchYouTubeTitle);
        }
        
        // Handle Enter key in the URL input (clone approach doesn't work well for inputs)
        // Just add the listener directly, and rely on the modal being recreated for cleanup
        youtubeUrlInput.addEventListener('keydown', handleUrlInputKeydown);
        
        // Add event listener for context input
        youtubeContextInput.addEventListener('keydown', handleContextInputKeydown);
        
        // Add click handler to close when clicking outside
        modalElement.addEventListener('click', handleModalOutsideClick);
    }
    
    // Separate handler functions to avoid anonymous functions
    function handleUrlInputKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!youtubeTitleInput.value.trim()) {
                fetchYouTubeTitle();
            } else {
                insertYouTubeLink();
            }
        }
    }
    
    function handleContextInputKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Move focus to title input
            youtubeTitleInput.focus();
        }
    }
    
    function handleModalOutsideClick(e) {
        if (e.target === modalElement) {
            hideModal();
        }
    }
    
    /**
     * Insert YouTube link with optional title, context, start and end times
     */
    function insertYouTubeLink() {
        const url = youtubeUrlInput.value.trim();
        const title = youtubeTitleInput.value.trim();
        const context = youtubeContextInput.value.trim();
        const startTime = startTimeInput.value.trim();
        const endTime = endTimeInput.value.trim();
        
        if (!url) {
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
        let embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0`;
        
        // Add start and end parameters if provided
        if (startSeconds !== null) {
            embedUrl += `&start=${startSeconds}`;
        }
        
        if (endSeconds !== null) {
            embedUrl += `&end=${endSeconds}`;
        }
        
        // Use embed URL for both display and loading when we have time constraints
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
        
        // Format with tagged syntax [t:Title][c:Context]URL
        let formattedLink = displayUrl;
        
        // Add context tag first if context is provided (not empty)
        if (context !== '') {
            formattedLink = `[c:${context}]${formattedLink}`;
        }
        
        // Then handle title (context comes before title in the link)
        // Only add a title tag if title has actual content
        if (title !== '') {
            formattedLink = `[t:${title}]${formattedLink}`;
        }
        
        console.log("Formatted link:", formattedLink);
        
        // Insert link into the rich editor
        if (richEditorInstance) {
            richEditorInstance.insertContent(formattedLink);
        } else {
            console.error('Rich editor not available for inserting link');
        }
        
        // Store both the embed URL and times in localStorage for later use
        const embedKey = `video_embed_${videoId}`;
        localStorage.setItem(embedKey, embedUrl);
        
        // Also store the times separately for any future reference
        const timeKey = `video_times_${videoId}`;
        const timeData = {
            start: startSeconds,
            end: endSeconds,
            embedUrl: embedUrl,
            timestamp: Date.now()
        };
        
        localStorage.setItem(timeKey, JSON.stringify(timeData));
        
        console.log(`Stored embed URL for video ${videoId}: ${embedUrl}`);
        
        // Hide the modal
        hideModal();
    }
    
    /**
     * Convert time format (MM:SS or H:MM:SS) to seconds
     * @param {string} timeString - Time string in MM:SS or H:MM:SS format
     * @returns {number|null} - Time in seconds or null if invalid format
     */
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
    
    /**
     * Fetch video title from YouTube and populate the form
     */
    async function fetchYouTubeTitle() {
        const url = youtubeUrlInput.value.trim();
        
        if (!url) {
            alert('Please enter a YouTube URL');
            return;
        }
        
        if (!isYouTubeUrl(url)) {
            // Show error feedback in the modal
            modalFeedback.textContent = 'Please enter a valid YouTube URL';
            modalFeedback.style.backgroundColor = 'rgba(254, 242, 242, 0.98)'; // Light red
            modalFeedback.style.color = '#991b1b'; // Dark red
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // Reset styling after animation completes
            setTimeout(() => {
                modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)';
                modalFeedback.style.color = '#0c652f';
            }, 2500);
            
            return;
        }
        
        // Show feedback that we're fetching
        modalFeedback.textContent = 'Fetching title...';
        modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
        modalFeedback.style.color = '#0c652f'; // Default color
        showFeedbackMessage(modalFeedback, true);
        
        // Disable the button while fetching
        fetchTitleBtn.disabled = true;
        fetchTitleBtn.textContent = 'Fetching...';
        
        try {
            // Extract video ID from URL
            const { videoId } = extractYouTubeInfo(url);
            
            if (videoId) {
                // Update the feedback message
                modalFeedback.textContent = `Fetching title for video ID: ${videoId}...`;
                
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
                    
                    // Focus the context field first since it's now between URL and title
                    youtubeContextInput.focus();
                    
                    // Show success feedback in the modal
                    modalFeedback.textContent = `Title fetched successfully!`;
                    modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
                    modalFeedback.style.color = '#0c652f'; // Default color
                    
                    // Show the feedback with animation
                    showFeedbackMessage(modalFeedback, true);
                    
                } catch (fetchError) {
                    console.warn('Title fetch error or timeout:', fetchError);
                    
                    // Set a fallback title
                    youtubeTitleInput.value = `YouTube Video: ${videoId}`;
                    youtubeTitleInput.focus();
                    youtubeTitleInput.select();
                    
                    // Show error feedback in the modal
                    modalFeedback.textContent = 'Could not fetch title from YouTube';
                    modalFeedback.style.backgroundColor = 'rgba(254, 242, 242, 0.98)'; // Light red
                    modalFeedback.style.color = '#991b1b'; // Dark red
                    
                    // Show the feedback with animation
                    showFeedbackMessage(modalFeedback, true);
                    
                    // Reset styling after animation completes
                    setTimeout(() => {
                        modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)';
                        modalFeedback.style.color = '#0c652f';
                    }, 2500);
                }
            } else {
                // Show error feedback in the modal
                modalFeedback.textContent = 'Could not find YouTube video ID in the URL';
                modalFeedback.style.backgroundColor = 'rgba(254, 242, 242, 0.98)'; // Light red
                modalFeedback.style.color = '#991b1b'; // Dark red
                
                // Show the feedback with animation
                showFeedbackMessage(modalFeedback, true);
                
                // Reset styling after animation completes
                setTimeout(() => {
                    modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)';
                    modalFeedback.style.color = '#0c652f';
                }, 2500);
            }
        } catch (error) {
            console.error('Error in YouTube title processing:', error);
            
            // Show error feedback in the modal
            modalFeedback.textContent = 'Error processing YouTube URL';
            modalFeedback.style.backgroundColor = 'rgba(254, 242, 242, 0.98)'; // Light red
            modalFeedback.style.color = '#991b1b'; // Dark red
            
            // Show the feedback with animation
            showFeedbackMessage(modalFeedback, true);
            
            // Reset styling after animation completes
            setTimeout(() => {
                modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)';
                modalFeedback.style.color = '#0c652f';
            }, 2500);
        } finally {
            // Re-enable the button
            fetchTitleBtn.disabled = false;
            fetchTitleBtn.textContent = 'Fetch Title';
        }
    }
    
    // Public API
    return {
        showModal,
        hideModal,
        insertYouTubeLink,
        fetchYouTubeTitle
    };
}

export default initYouTubeModal;