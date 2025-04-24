// Common video titles for testing and fallback
const commonVideos = {
    'dQw4w9WgXcQ': 'Rick Astley - Never Gonna Give You Up',
    '9bZkp7q19f0': 'PSY - GANGNAM STYLE(강남스타일) M/V',
    'jNQXAC9IVRw': 'Me at the zoo',
    'J---aiyznGQ': 'Keyboard Cat',
    'kJQP7kiw5Fk': 'Luis Fonsi - Despacito ft. Daddy Yankee',
    'OPf0YbXqDm0': 'Mark Ronson - Uptown Funk ft. Bruno Mars',
    '9bZkp7q19f0': 'PSY - GANGNAM STYLE(강남스타일) M/V',
    '0KSOMA3QBU0': 'Katy Perry - Dark Horse (Official) ft. Juicy J',
    '2Vv-BfVoq4g': 'Ed Sheeran - Perfect (Official Music Video)'
};

// Common video durations in seconds
const videoDurations = {
    'dQw4w9WgXcQ': 213,
    '9bZkp7q19f0': 253,
    'jNQXAC9IVRw': 19,
    'J---aiyznGQ': 54,
    'kJQP7kiw5Fk': 282,
    'OPf0YbXqDm0': 271,
    '0KSOMA3QBU0': 237,
    '2Vv-BfVoq4g': 263
};

// Create global namespace for data if not already defined
window.App = window.App || {};
window.App.YouTubeData = {
    commonVideos,
    videoDurations
};