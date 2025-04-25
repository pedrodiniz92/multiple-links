# App.js Functionality Index

## Core Components and Variables

1. **DOM Elements Initialization** (Lines 1-13)
   - Initializes DOM elements used throughout the application
   - Sets up references to panels, buttons, containers, and UI elements

2. **State Variables** (Lines 15-22)
   - Rich text editor variable (quill)
   - Video title cache object
   - Panel resizing state

## Panel Resizing Functionality

3. **Panel Resizer Implementation** (Lines 24-48)
   - Mouse event listeners for resizing panels (Lines 24-32)
   - Resize calculation logic (Lines 34-47)
   - Dynamic resizing with minimum/maximum size limits
   - Updates toolbar icon sizes during resizing

## UI Management

4. **Input Section Visibility Toggle** (Lines 50-57)
   - Shows/hides the input section based on parameter

5. **URL Parameter Handling** (Lines 59-80)
   - Parses URL parameters to load shared links
   - Resets counter and clears existing links when loading from URL
   - Updates rich text editor with decoded content
   - Processes links and hides input section after processing

6. **Shareable URL Generation** (Lines 82-86)
   - Creates sharable URLs by encoding links

7. **Feedback Message System** (Lines 88-122)
   - Generic feedback message display with animations (Lines 88-117)
   - Clipboard-specific feedback (Lines 119-122)

## Card Counter Management

8. **Card Numbering System** (Lines 124-130)
   - Global counter for card numbers
   - Reset function for card counter

## Link Processing

9. **Link Parsing** (Lines 132-224)
   - Parses links with title and context tags (Lines 133-223)
   - Supports multiple tag formats ([t:Title][c:Context]Link or [c:Context][t:Title]Link)
   - Handles legacy format for backward compatibility
   - Returns parsed link data object

10. **HTML Entity Fixing** (Lines 226-245)
    - Fixes HTML entities in URLs
    - Replaces common HTML entities with their actual characters

11. **URL Validation** (Lines 247-262)
    - Checks if input is a valid URL
    - Removes HTML formatting tags before validation

12. **Text Card Creation** (Lines 264-295)
    - Creates text or header cards from input
    - Handles special header formatting (lines starting with #)
    - Preserves HTML formatting when present
    - Stores original text for editing

13. **Link Processing** (Lines 297-437)
    - Main function for processing links and creating cards
    - Clears existing content and resets counter
    - Processes each input line by line
    - Creates text cards for non-URL content
    - Creates link cards for YouTube URLs
    - Fetches video titles when needed
    - Makes video titles editable
    - Sets up event listeners for cards
    - Automatically loads the first video

## Event Handling

14. **Go Button Event Listener** (Lines 439-444)
    - Processes links when Go button is clicked
    - Hides input section after processing

15. **Link Card Data Extraction** (Lines 446-474)
    - Gets current links and text from cards
    - Sorts cards by DOM position
    - Extracts original link or text data

16. **Share Functionality** (Lines 476-503)
    - Copies shareable link to clipboard
    - Updates browser URL without reloading
    - Shows feedback after copying

17. **Edit Functionality** (Lines 504-522)
    - Gets current links from cards
    - Populates textarea with current content
    - Updates rich text editor
    - Shows input section and focuses editor

## Time and Video Handling

18. **Time Formatting** (Lines 524-529)
    - Formats seconds as minutes:seconds

19. **YouTube Information Extraction** (Lines 531-727)
    - Extracts video ID and parameters from URLs (Lines 532-618)
    - Multi-method extraction for reliability
    - Parses time parameters (start/end times) (Lines 620-719)
    - Saves time data to localStorage

20. **Video Duration Fetching** (Lines 729-944)
    - Multiple methods to fetch video duration
    - Uses predefined list, localStorage cache, CORS proxy
    - Extracts duration from HTML with multiple patterns
    - Falls back to known durations if fetching fails

21. **Link Display Formatting** (Lines 946-985)
    - Gets formatted display text for YouTube links
    - Shows time range for videos with time parameters
    - Shows full video duration for videos without time parameters

22. **HTML Entity Decoding** (Lines 987-992)
    - Decodes HTML entities in text

23. **Common Video Data** (Lines 994-1038)
    - Predefined video titles and durations for testing/fallback

24. **Video Title Fetching** (Lines 1040-1306)
    - Multiple methods to fetch video titles
    - Uses localStorage, in-memory cache, oEmbed API, CORS proxy
    - Extracts title from HTML with multiple patterns
    - Falls back to predefined titles or inferred titles

25. **Video Loading** (Lines 1308-1460)
    - Loads videos into the iframe
    - Extracts video ID and time parameters
    - Creates new iframe for each video to ensure fresh state
    - Adds cache-busting parameters
    - Handles errors and attempts recovery

## Theme Management

26. **Theme Toggle Functionality** (Lines 1462-1508)
    - Checks for saved theme preference or OS preference
    - Updates theme toggle icon tooltip
    - Toggles between light and dark themes
    - Saves theme preference to localStorage

## Title Editing

27. **Video Title Editing** (Lines 1510-1587)
    - Makes video titles editable on click
    - Creates textarea for editing
    - Saves edited titles to localStorage
    - Handles Enter and Escape keys for saving/canceling

## Rich Text Editor

28. **Rich Text Editor Initialization** (Lines 1589-1622)
    - Sets up Quill editor with toolbar options
    - Syncs Quill content to hidden textarea
    - Sets up YouTube link button and modal

29. **YouTube Link Button and Modal** (Lines 1624-2117)
    - Shows YouTube modal with input fields
    - Fetches video titles
    - Formats links with title and context tags
    - Inserts formatted links into editor
    - Stores embed URLs and time data in localStorage

30. **Rich Text Content Conversion** (Lines 2119-2181)
    - Converts Quill HTML content to lines format
    - Sets Quill content from plain text or HTML
    - Escapes HTML special characters

## Responsive UI

31. **Responsive Toolbar** (Lines 2183-2284)
    - Dynamically resizes toolbar icons based on available space
    - Uses animation frames for smooth updates
    - Adjusts icon sizes and spacing
    - Observes toolbar size changes

32. **Line Break Button Setup** (Lines 2286-2317)
    - Sets up line break button functionality for YouTube context input
    - Inserts line break markers (//) at cursor position

## Initialization

33. **Page Load Initialization** (Lines 2319-2341)
    - Initializes rich text editor
    - Parses URL parameters
    - Initializes responsive toolbar
    - Sets up additional event listeners for panel resizing