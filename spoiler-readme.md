# INTRO: Here's what I want

# Spoiler tags
If text comes between // tags, it gets spoiler treatment.
The text is shown as a light gray background with ?. When clicked, it is revealed, still with the light gray background. Clicked again, it goes back to spoiler mode.

This can happen inline, as part of a card

## Spoiler Syntax
Question: Where is the Eiffel Tower? //In Paris, France.//

Prompt #4
# Spoiler button
Create a ? Button in the rich text editor.
If I have text selected and click it, it wraps that text in // tags.
If I have no selected text, it opens a modal for me to enter text, then wraps // tags around it and adds it to the material.

# INSPIRATION: Here's what worked in a different project
This was written for a different project, so use your own judgment to figure out how much we can use from it. Remember that the current project has a modular js approach, so we need to respect that.

# Spoiler Tag Implementation

This document explains the implementation of spoiler tags in our web application. Spoiler tags allow content to be hidden by default, showing "show answer" text that reveals the actual content when clicked.

## Table of Contents

1. [Overview](#overview)
2. [HTML Structure](#html-structure)
3. [CSS Styling](#css-styling)
4. [JavaScript Implementation](#javascript-implementation)
5. [Integration in Text Processing](#integration-in-text-processing)
6. [Quill Editor Integration](#quill-editor-integration)
7. [Full Code Reference](#full-code-reference)

## Overview

The spoiler functionality consists of three main parts:
1. Text processing to convert `//content//` tags to spoiler HTML elements
2. CSS styling to create the spoiler appearance
3. JavaScript for toggling between hidden and revealed states

## HTML Structure

When processed, a spoiler tag in the text (written as `//hidden content//`) is transformed into the following HTML:

```html
<span class="spoiler spoiler-v2" data-spoiler-text="hidden content">show answer</span>
```

Key components:
- `class="spoiler spoiler-v2"`: Classes for styling
- `data-spoiler-text`: Attribute storing the hidden content
- Text content initially shows "show answer"

## CSS Styling

The spoiler element is styled with a light grey background and rounded corners:

```css
.spoiler-v2 {
    display: inline-block !important;
    background-color: #f1f1f1 !important; /* Solid light grey background */
    padding: 4px 10px !important;
    border-radius: 6px !important;
    cursor: pointer !important;
    color: #666 !important;
    font-style: normal !important; /* No italics */
    font-size: 0.9em !important;
    transition: all 0.2s ease !important;
    user-select: none !important;
    margin: 4px 2px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
    border: 1px solid #e0e0e0 !important;
}

.spoiler-v2:hover {
    background-color: #e8e8e8 !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important;
}

.spoiler-v2.revealed {
    background-color: #f1f1f1 !important; /* Keep the same background when revealed */
    color: #333 !important;
    font-style: normal !important;
}
```

Note: The `!important` flags were added to overcome CSS specificity issues and are optional in new implementations.

## JavaScript Implementation

### 1. Initial Styling

This function applies initial styling to spoiler elements as soon as they're created:

```javascript
function applyInitialSpoilerStyling(spoilerElement) {
    // Apply the initial "show answer" styling
    spoilerElement.style.display = 'inline-block';
    spoilerElement.style.backgroundColor = '#f1f1f1';
    spoilerElement.style.color = '#666';
    spoilerElement.style.fontStyle = 'normal'; // No italics
    spoilerElement.style.borderRadius = '6px';
    spoilerElement.style.padding = '4px 10px';
    spoilerElement.style.margin = '4px 2px';
    spoilerElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    spoilerElement.style.border = '1px solid #e0e0e0';
    spoilerElement.style.cursor = 'pointer';
    spoilerElement.style.fontSize = '0.9em';
}
```

### 2. Toggle Functionality

This function toggles between showing "show answer" and revealing the actual content:

```javascript
function toggleSpoiler(event) {
    const spoilerElement = event.currentTarget;
    
    if (spoilerElement.classList.contains('revealed')) {
        // Hide spoiler text again
        spoilerElement.classList.remove('revealed');
        spoilerElement.textContent = 'show answer';
        
        // Force style refresh
        void spoilerElement.offsetWidth;
        spoilerElement.style.backgroundColor = '#f1f1f1';
        spoilerElement.style.color = '#666';
        spoilerElement.style.fontStyle = 'normal'; // No italics
        spoilerElement.style.borderRadius = '6px';
        spoilerElement.style.padding = '4px 10px';
        spoilerElement.style.margin = '4px 2px';
        spoilerElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        spoilerElement.style.border = '1px solid #e0e0e0';
    } else {
        // Reveal spoiler text
        spoilerElement.classList.add('revealed');
        spoilerElement.textContent = spoilerElement.dataset.spoilerText;
        
        // Force style refresh
        void spoilerElement.offsetWidth;
        spoilerElement.style.backgroundColor = '#f1f1f1';
        spoilerElement.style.color = '#333';
        spoilerElement.style.fontStyle = 'normal';
        spoilerElement.style.borderRadius = '6px';
        spoilerElement.style.padding = '4px 10px';
        spoilerElement.style.margin = '4px 2px';
        spoilerElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        spoilerElement.style.border = '1px solid #e0e0e0';
    }
}
```

## Integration in Text Processing

This function processes text content and converts `//content//` patterns to spoiler elements:

```javascript
function processSpoilerTags(text) {
    // Replace spoiler tags with HTML elements
    // Pattern: match text between // tags, but not greedy (non-greedy match with .*?)
    return text.replace(/\/\/(.*?)\/\//g, '<span class="spoiler spoiler-v2" data-spoiler-text="$1">show answer</span>');
}
```

Then when creating text cards, we check for spoiler tags and add the event listeners:

```javascript
// Inside your text card creation function
if (text.includes('//')) {
    // Process text with spoiler tags
    const processedHtml = processSpoilerTags(text);
    card.innerHTML = processedHtml;
    
    // Add click handlers for spoiler elements and apply initial styling
    setTimeout(() => {
        const spoilers = card.querySelectorAll('.spoiler');
        spoilers.forEach(spoiler => {
            // Apply initial styling immediately
            applyInitialSpoilerStyling(spoiler);
            
            // Add click event
            spoiler.addEventListener('click', toggleSpoiler);
        });
    }, 0);
}
```

## Quill Editor Integration

### Spoiler Button in the Toolbar

Add a spoiler button to your editor toolbar:

```html
<button id="add-spoiler" class="quill-button" title="Add Spoiler">
    <svg viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M12,2C17.52,2 22,6.48 22,12C22,17.52 17.52,22 12,22C6.48,22 2,17.52 2,12C2,6.48 6.48,2 12,2M12,4C7.58,4 4,7.58 4,12C4,16.42 7.58,20 12,20C16.42,20 20,16.42 20,12C20,7.58 16.42,4 12,4M13,10.25H11V5.75H13V10.25M12,18C11.45,18 11,17.55 11,17C11,16.45 11.45,16 12,16C12.55,16 13,16.45 13,17C13,17.55 12.55,18 12,18Z" />
    </svg>
    <span class="custom-tooltip">Add Spoiler</span>
</button>
```

### Spoiler Modal for Entering Text

Create a modal for entering spoiler text when no text is selected:

```javascript
function createSpoilerModal() {
    // Check if modal already exists
    if (document.getElementById('spoiler-modal')) {
        return;
    }
    
    // Create modal elements
    const modal = document.createElement('div');
    modal.id = 'spoiler-modal';
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Add modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = '<h3>Add Spoiler Text</h3>';
    modalContent.appendChild(modalHeader);
    
    // Add modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    // Add form elements
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    formGroup.innerHTML = `
        <label for="spoiler-text">Enter text to hide as spoiler:</label>
        <textarea id="spoiler-text" rows="3"></textarea>
    `;
    modalBody.appendChild(formGroup);
    
    // Add buttons
    const modalActions = document.createElement('div');
    modalActions.className = 'modal-actions';
    modalActions.innerHTML = `
        <button id="insert-spoiler-btn" class="primary-button">Insert</button>
        <button id="cancel-spoiler-btn" class="cancel-button">Cancel</button>
    `;
    modalBody.appendChild(modalActions);
    
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    
    // Add modal to the DOM
    document.body.appendChild(modal);
    
    // Set up event listeners
    document.getElementById('cancel-spoiler-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    document.getElementById('insert-spoiler-btn').addEventListener('click', () => {
        const spoilerText = document.getElementById('spoiler-text').value.trim();
        if (spoilerText) {
            if (quill) {
                // Get current selection
                const selection = quill.getSelection();
                if (selection) {
                    // Insert the spoiler tag with the entered text
                    quill.insertText(selection.index, `//${spoilerText}//`);
                } else {
                    // Insert at the end if no selection
                    quill.insertText(quill.getLength() - 1, `//${spoilerText}//`);
                }
            }
        }
        modal.style.display = 'none';
    });
    
    // Close modal when clicking outside the content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}
```

### Spoiler Button Event Handler

Set up the event handler for the spoiler button:

```javascript
function setupSpoilerButton() {
    const spoilerBtn = document.getElementById('add-spoiler');
    
    if (!spoilerBtn) {
        console.error('Spoiler button not found');
        return;
    }
    
    // Create the spoiler modal
    createSpoilerModal();
    
    // Add spoiler button functionality
    spoilerBtn.addEventListener('click', () => {
        if (!quill) return;
        
        // Get current selection
        const selection = quill.getSelection();
        
        if (selection && selection.length > 0) {
            // If text is selected, wrap it with spoiler tags
            const selectedText = quill.getText(selection.index, selection.length);
            quill.deleteText(selection.index, selection.length);
            quill.insertText(selection.index, `//${selectedText}//`);
            quill.setSelection(selection.index + selectedText.length + 4); // Position cursor after the inserted tags
        } else {
            // If no text is selected, show the spoiler modal
            const spoilerModal = document.getElementById('spoiler-modal');
            if (spoilerModal) {
                document.getElementById('spoiler-text').value = '';
                spoilerModal.style.display = 'flex';
                
                // Focus the text input
                setTimeout(() => {
                    document.getElementById('spoiler-text').focus();
                }, 50);
            }
        }
    });
}
```

## Full Code Reference

### JavaScript Components

1. **Processing Spoiler Tags**:
```javascript
function processSpoilerTags(text) {
    return text.replace(/\/\/(.*?)\/\//g, '<span class="spoiler spoiler-v2" data-spoiler-text="$1">show answer</span>');
}
```

2. **Initial Styling Function**:
```javascript
function applyInitialSpoilerStyling(spoilerElement) {
    spoilerElement.style.display = 'inline-block';
    spoilerElement.style.backgroundColor = '#f1f1f1';
    spoilerElement.style.color = '#666';
    spoilerElement.style.fontStyle = 'normal';
    spoilerElement.style.borderRadius = '6px';
    spoilerElement.style.padding = '4px 10px';
    spoilerElement.style.margin = '4px 2px';
    spoilerElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    spoilerElement.style.border = '1px solid #e0e0e0';
    spoilerElement.style.cursor = 'pointer';
    spoilerElement.style.fontSize = '0.9em';
}
```

3. **Toggle Function**:
```javascript
function toggleSpoiler(event) {
    const spoilerElement = event.currentTarget;
    
    if (spoilerElement.classList.contains('revealed')) {
        // Hide spoiler text again
        spoilerElement.classList.remove('revealed');
        spoilerElement.textContent = 'show answer';
        
        // Force style refresh
        void spoilerElement.offsetWidth;
        spoilerElement.style.backgroundColor = '#f1f1f1';
        spoilerElement.style.color = '#666';
        spoilerElement.style.fontStyle = 'normal';
        spoilerElement.style.borderRadius = '6px';
        spoilerElement.style.padding = '4px 10px';
        spoilerElement.style.margin = '4px 2px';
        spoilerElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        spoilerElement.style.border = '1px solid #e0e0e0';
    } else {
        // Reveal spoiler text
        spoilerElement.classList.add('revealed');
        spoilerElement.textContent = spoilerElement.dataset.spoilerText;
        
        // Force style refresh
        void spoilerElement.offsetWidth;
        spoilerElement.style.backgroundColor = '#f1f1f1';
        spoilerElement.style.color = '#333';
        spoilerElement.style.fontStyle = 'normal';
        spoilerElement.style.borderRadius = '6px';
        spoilerElement.style.padding = '4px 10px';
        spoilerElement.style.margin = '4px 2px';
        spoilerElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        spoilerElement.style.border = '1px solid #e0e0e0';
    }
}
```

### CSS Components

```css
/* Spoiler styling */
.spoiler-v2 {
    display: inline-block;
    background-color: #f1f1f1; /* Solid light grey background */
    padding: 4px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: #666;
    font-style: normal; /* No italics */
    font-size: 0.9em;
    transition: all 0.2s ease;
    user-select: none;
    margin: 4px 2px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    border: 1px solid #e0e0e0;
}

.spoiler-v2:hover {
    background-color: #e8e8e8;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.spoiler-v2.revealed {
    background-color: #f1f1f1; /* Keep the same background when revealed */
    color: #333;
    font-style: normal;
}

/* Dark mode spoiler styling (optional) */
[data-theme="dark"] .spoiler-v2 {
    background-color: #333;
    color: #aaa;
    border-color: #444;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

[data-theme="dark"] .spoiler-v2:hover {
    background-color: #3a3a3a;
}

[data-theme="dark"] .spoiler-v2.revealed {
    background-color: #333;
    color: #ddd;
}
```

## Adapting to Your Project

To integrate this spoiler functionality in your own project:

1. Copy the CSS styles for the spoiler elements
2. Implement the processSpoilerTags, applyInitialSpoilerStyling, and toggleSpoiler functions
3. Add the spoiler button to your editor toolbar if needed
4. Create the spoiler modal for entering spoiler text
5. Add the logic to process spoiler tags in your content rendering

The core functionality can be simplified if you don't need the editor integration:

```javascript
// Core minimal implementation
function processSpoilerTags(text) {
    return text.replace(/\/\/(.*?)\/\//g, '<span class="spoiler" data-spoiler-text="$1">show answer</span>');
}

function initSpoilers() {
    document.querySelectorAll('.spoiler').forEach(spoiler => {
        spoiler.addEventListener('click', function() {
            if (this.classList.contains('revealed')) {
                this.classList.remove('revealed');
                this.textContent = 'show answer';
            } else {
                this.classList.add('revealed');
                this.textContent = this.dataset.spoilerText;
            }
        });
    });
}
```