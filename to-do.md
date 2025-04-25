# What we are doing

I had many functions in a single js file (backup-app.js, which you can look up for reference if necessary) and we are migrating to a modular system, with app.js as an orchestator, but most functions relegated to specific .js files.
Below, you will find the file structure we ought to build.
Then, you will find the steps. 

## IMPORTANT
We will perform each step at a time. 
Backup-app.js is there just for reference. We are not going to reference it in our code anymore.
After you implement each step, write on progress.md what step you have done and what functions I have to test before we can move forward to the next step.

## File Structure

```
/js
|-- app.js                  # Main orchestrator, initialization and core setup
|-- components/
|   |-- panel-resizer.js    # Panel resizing functionality
|   |-- card-manager.js     # Card creation and management
|   |-- link-processor.js   # Link parsing and processing
|-- services/
|   |-- url-service.js      # URL handling, validation, and sharing
|   |-- youtube-service.js  # YouTube-specific functionality
|   |-- video-info.js       # Video title and duration fetching
|-- ui/
|   |-- theme-manager.js    # Theme toggling and management
|   |-- feedback.js         # User feedback and notifications
|   |-- responsive-ui.js    # Responsive toolbar and UI adjustments
|-- editor/
|   |-- rich-editor.js      # Quill editor setup and management
|   |-- youtube-modal.js    # YouTube link modal functionality
|-- utils/
|   |-- time-utils.js       # Time formatting and parsing
|   |-- html-utils.js       # HTML entity handling and conversion
|-- data/
|   |-- video-data.js       # Common video data (titles, durations)
|   |-- storage.js          # LocalStorage wrapper functions
```

## Module Responsibilities

### Step 0. File structure
- Create the file structure listed above
- Ensure index.html points to the app.js in the proper location.

### Step 1. app.js
- DOM elements initialization
- Event listener setup (high-level)
- Module orchestration
- Page load initialization
- **Lines in backup-app.js**: 1-13 (DOM elements), 439-444 (Go button event), 2319-2341 (page load initialization)

### Step 2. components/panel-resizer.js
- Panel resizing event listeners and calculations
- Handling minimum and maximum sizes
- Coordination with responsive UI updates
- **Lines in backup-app.js**: 22-48 (resize event listeners and calculations)

### Step 3. components/card-manager.js
- Card counter management
- Text card creation
- Link card creation
- Card ordering and sorting
- Card event listeners
- **Lines in backup-app.js**: 124-130 (card counter), 264-295 (text card creation), 446-474 (link extraction)

### Step 4. components/link-processor.js
- Link parsing logic (title/context tags)
- Splitting and processing input
- Converting between different formats
- **Lines in backup-app.js**: 132-224 (link parsing), 297-437 (processing links and creating cards)

### Step 5. services/url-service.js
- URL validation
- URL parameter handling
- Shareable URL generation
- URL cleanup and normalization
- **Lines in backup-app.js**: 59-80 (URL parameter parsing), 82-86 (shareable URL generation), 247-262 (URL validation)

### Step 6. services/youtube-service.js
- YouTube URL parsing
- Video ID extraction
- YouTube embed URL generation
- YouTube iframe management
- Video loading and error handling
- **Lines in backup-app.js**: 531-619 (YouTube info extraction), 1308-1460 (video loading)

### Step 7. services/video-info.js
- Video title fetching (multiple methods)
- Video duration fetching (multiple methods)
- Title and duration caching
- **Lines in backup-app.js**: 729-944 (video duration fetching), 1040-1306 (video title fetching)

### Step 8. ui/theme-manager.js
- Theme preference loading/saving
- Theme toggling functionality
- Theme-related UI updates
- **Lines in backup-app.js**: 1462-1508 (theme toggle functionality)

### Step 9. ui/feedback.js
- Feedback message system
- Animation handling for notifications
- Clipboard feedback
- **Lines in backup-app.js**: 88-122 (feedback message system), 476-496 (clipboard feedback)

### Step 10. ui/responsive-ui.js
- Responsive toolbar implementation
- Icon sizing and spacing
- ResizeObserver setup
- **Lines in backup-app.js**: 2183-2284 (responsive toolbar)

### Step 11. editor/rich-editor.js
- Quill editor initialization
- Editor content synchronization
- Content conversion between formats
- **Lines in backup-app.js**: 1589-1622 (rich text editor init), 2119-2181 (content conversion)

### Step 12. editor/youtube-modal.js
- YouTube modal UI management
- Form handling for YouTube links
- Integration with video info services
- **Lines in backup-app.js**: 1624-2117 (YouTube link button and modal)

### Step 13. utils/time-utils.js
- Time formatting (seconds to MM:SS)
- Time string parsing (MM:SS to seconds)
- Time parameter handling
- **Lines in backup-app.js**: 524-529 (time formatting), 620-727 (time parameter handling), 1816-1854 (time to seconds conversion)

### Step 14. utils/html-utils.js
- HTML entity fixing in URLs
- HTML entity decoding
- HTML escaping
- **Lines in backup-app.js**: 226-245 (HTML entity fixing), 987-992 (HTML entity decoding), 2175-2181 (HTML escaping)

### Step 15. data/video-data.js
- Common video titles
- Common video durations
- Testing/fallback data
- **Lines in backup-app.js**: 994-1038 (common video data)

### Step 16. data/storage.js
- LocalStorage wrapper functions
- Cache management
- Data serialization/deserialization
- **Lines in backup-app.js**: Storage operations are distributed throughout the code, mainly in 656-676, 698-719, 903-905, 1067-1071, 1216-1221, 1440-1444, 1550-1552, 1797-1809

## Migration Strategy

1. Start by creating the directory structure
2. Create each file with proper import/export statements
3. Move related functions to their respective files
4. Update references in app.js to import from the modules
5. Test each module individually as it's extracted
6. Convert app.js to be the orchestrator that initializes and connects all modules

This modular approach will make the codebase:
- More maintainable (smaller, focused files)
- Easier to test (isolated functionality)
- More reusable (functions grouped by purpose)
- Easier to extend (clear separation of concerns)