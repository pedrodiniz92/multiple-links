# JavaScript Extraction Testing Checklist

## Current Extractions

We've extracted several utility functions from app.js into separate files:

### 1. HTML Utilities (`js/utils/html-utils.js`)
- `escapeHtml(text)` - Escapes HTML special characters

### 2. Time Utilities (`js/utils/time-utils.js`)
- `formatTime(seconds)` - Formats seconds as MM:SS 
- `timeToSeconds(timeString)` - Converts time format to seconds

### 3. String Utilities (`js/utils/string-utils.js`)
- `decodeHTMLEntities(text)` - Decodes HTML entities
- `fixHtmlEntitiesInUrls(text)` - Fixes HTML entities in URLs

### 4. URL Utilities (`js/utils/url-utils.js`)
- `isValidUrl(string)` - Validates if a string is a URL

### 5. Quill Utilities (`js/utils/quill-utils.js`)
- `convertQuillContentToLines(html)` - Converts Quill HTML to lines
- `setQuillContent(quill, content)` - Sets content in the Quill editor

### 6. UI Service (`js/services/ui-service.js`)
- `showFeedbackMessage(element, isModal)` - Shows animated feedback messages
- `toggleInputSection(show)` - Shows/hides the input section
- `toggleTheme()` - Toggles between light and dark themes
- `updateThemeToggleTooltip()` - Updates the theme toggle tooltip text

## Testing Instructions

Please test the following functionality to ensure our extractions work properly:

### HTML Utilities
- [ ] Add formatted text in the editor
- [ ] Create new text cards by clicking "Go"
- [ ] Check that special characters (< > & etc.) display correctly

### Time Utilities
- [ ] Add a YouTube link with start/end times in the YouTube modal
- [ ] Check that time formats correctly on YouTube cards
- [ ] Verify that timestamps work when clicking YouTube links

### String Utilities
- [ ] Copy/paste a YouTube URL with parameters (like &t=)
- [ ] Verify links with HTML entities work properly
- [ ] Check that decoding works with video titles

### URL Utilities
- [ ] Try entering valid and invalid URLs 
- [ ] Check that URL validation works in the YouTube modal

### Quill Utilities
- [ ] Test adding formatted text (bold, colored text) in the editor
- [ ] Test loading content with the "Edit text" icon
- [ ] Test that formatting is preserved when processing links

### UI Service
- [ ] Test clipboard feedback by clicking the Share icon
- [ ] Test showing/hiding the input section with the Edit text icon
- [ ] Toggle between light and dark themes with the theme toggle icon
- [ ] Verify the theme toggle tooltip changes text correctly

## Lines of Code Saved
- `escapeHtml`: 5 lines
- `formatTime`: 5 lines
- `isValidUrl`: 14 lines
- `decodeHTMLEntities`: 5 lines
- `fixHtmlEntitiesInUrls`: 19 lines
- `showFeedbackMessage`: 29 lines
- `toggleInputSection`: 7 lines
- `toggleTheme`: 13 lines
- `updateThemeToggleTooltip`: 11 lines
- `convertQuillContentToLines`: 29 lines
- `setQuillContent`: 23 lines

Total: 160 lines removed from app.js