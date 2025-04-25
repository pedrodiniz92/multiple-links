/**
 * Time utility functions for formatting and parsing time values
 * Handles conversions between seconds and formatted time strings (MM:SS, H:MM:SS)
 */

/**
 * Format seconds as a time string (MM:SS or H:MM:SS)
 * @param {number} seconds - The time in seconds
 * @returns {string} - Formatted time string
 */
export function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '';
    
    // Convert to number if it's a string
    const totalSeconds = parseInt(seconds, 10);
    
    // Calculate hours, minutes and remaining seconds
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;
    
    // Pad with leading zeros
    const paddedSeconds = remainingSeconds.toString().padStart(2, '0');
    
    if (hours > 0) {
        // Format as H:MM:SS for videos longer than an hour
        const paddedMinutes = minutes.toString().padStart(2, '0');
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    } else {
        // Format as MM:SS for videos under an hour
        return `${minutes}:${paddedSeconds}`;
    }
}

/**
 * Convert time format (MM:SS or H:MM:SS) to seconds
 * @param {string} timeString - Time string in MM:SS or H:MM:SS format
 * @returns {number|null} - Time in seconds or null if invalid format
 */
export function timeToSeconds(timeString) {
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
 * Extract and process time parameters from a YouTube URL
 * @param {Object} options - Options for extracting time parameters
 * @param {string} options.videoId - YouTube video ID
 * @param {URL} options.urlObj - URL object for the YouTube URL
 * @returns {Object} - Object containing video ID and parameters
 */
export function extractTimeParameters({ videoId, urlObj }) {
    try {
        // Parse URL to extract parameters
        const params = {};
        
        // Get time parameters (t/start and end)
        let startTime = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
        let endTime = urlObj.searchParams.get('end');
    
        // Process start time
        if (startTime) {
            // Convert to seconds if it's in a format like "1h10m45s" or "4m20s"
            if (typeof startTime === 'string' && 
                (startTime.includes('h') || startTime.includes('m') || startTime.includes('s'))) {
                const hoursMatch = startTime.match(/(\d+)h/);
                const minutesMatch = startTime.match(/(\d+)m/);
                const secondsMatch = startTime.match(/(\d+)s/);
                let seconds = 0;
                if (hoursMatch) seconds += parseInt(hoursMatch[1]) * 3600;
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
            // Convert to seconds if it's in a format like "1h10m45s" or "4m20s"
            if (typeof endTime === 'string' && 
                (endTime.includes('h') || endTime.includes('m') || endTime.includes('s'))) {
                const hoursMatch = endTime.match(/(\d+)h/);
                const minutesMatch = endTime.match(/(\d+)m/);
                const secondsMatch = endTime.match(/(\d+)s/);
                let seconds = 0;
                if (hoursMatch) seconds += parseInt(hoursMatch[1]) * 3600;
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