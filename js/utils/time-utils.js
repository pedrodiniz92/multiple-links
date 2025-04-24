// Time utility functions

/**
 * Format seconds into MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

/**
 * Convert time string in MM:SS or H:MM:SS format to seconds
 * @param {string} timeString - Time in MM:SS or H:MM:SS format
 * @returns {number} Time in seconds
 */
function timeToSeconds(timeString) {
    if (!timeString) return 0;
    
    // Check if time string is already in seconds
    if (!isNaN(timeString) && timeString.indexOf(':') === -1) {
        return parseInt(timeString);
    }
    
    // Handle different time formats
    const timeMatch = timeString.match(/(?:(\d+):)?(\d+):(\d+)/);
    if (timeMatch) {
        const hours = timeMatch[1] ? parseInt(timeMatch[1]) : 0;
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    // Handle simple MM:SS format
    const simpleMatch = timeString.match(/(\d+):(\d+)/);
    if (simpleMatch) {
        const minutes = parseInt(simpleMatch[1]);
        const seconds = parseInt(simpleMatch[2]);
        return minutes * 60 + seconds;
    }
    
    return 0;
}

// Export the functions globally
window.formatTime = formatTime;
window.timeToSeconds = timeToSeconds;