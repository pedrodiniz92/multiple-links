/**
 * Spoiler modal module for handling spoiler text insertion
 * Includes modal UI management, form handling, and integration with rich editor
 */

/**
 * Initialize and set up the spoiler modal functionality
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.modalElement - The modal container element
 * @param {HTMLElement} options.modalFeedback - Feedback element for notifications
 * @param {HTMLElement} options.spoilerTextInput - The textarea input for spoiler text
 * @param {HTMLElement} options.spoilerCustomPromptInput - The input for custom prompt text (optional)
 * @param {HTMLElement} options.insertSpoilerBtn - Button to insert the spoiler
 * @param {HTMLElement} options.cancelBtn - Button to cancel and close modal
 * @param {Object} options.richEditorInstance - The rich editor instance for inserting content
 * @param {Function} options.showFeedbackMessage - Function to display feedback messages
 * @returns {Object} - Public API for the spoiler modal
 */
function initSpoilerModal(options) {
    const {
        modalElement,
        modalFeedback,
        spoilerTextInput,
        spoilerCustomPromptInput, // Added
        insertSpoilerBtn,
        cancelBtn,
        richEditorInstance,
        showFeedbackMessage
    } = options;
    
    // Track event handlers to avoid duplication
    let eventHandlersAttached = false;
    
    /**
     * Show the spoiler modal dialog
     */
    function showModal() {
        if (!modalElement) {
            console.error('Spoiler modal element not found');
            return;
        }
        
        console.log('Showing spoiler modal and setting up event handlers');
        
        // Clear previous input
        spoilerTextInput.value = '';
        if (spoilerCustomPromptInput) {
            spoilerCustomPromptInput.value = ''; // Clear custom prompt input
        }
        
        // Show the modal with flexbox display
        modalElement.style.display = 'flex';
        
        // Focus the spoiler text input
        setTimeout(() => spoilerTextInput.focus(), 50);
        
        // Set up event handlers if not already attached
        if (!eventHandlersAttached) {
            setupEventHandlers();
            eventHandlersAttached = true;
        }
    }
    
    /**
     * Hide the spoiler modal dialog
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
        console.log('Setting up event handlers for spoiler modal');
        
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
        if (insertSpoilerBtn) {
            // Create a new button to remove any existing listeners
            const newInsertBtn = insertSpoilerBtn.cloneNode(true);
            if (insertSpoilerBtn.parentNode) {
                insertSpoilerBtn.parentNode.replaceChild(newInsertBtn, insertSpoilerBtn);
            }
            
            // Add click event to the new button
            newInsertBtn.addEventListener('click', insertSpoilerText);
        }
        
        // Handle Enter key in the textarea
        if (spoilerTextInput) {
            spoilerTextInput.addEventListener('keydown', function(e) {
                // Ctrl+Enter to submit the form
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    insertSpoilerText();
                }
            });
        }
        
        // Add click handler to close when clicking outside
        modalElement.addEventListener('click', function(e) {
            if (e.target === modalElement) {
                hideModal();
            }
        });
    }
    
    /**
     * Insert spoiler text into the rich editor
     */
    function insertSpoilerText() {
        const spoilerText = spoilerTextInput.value.trim();
        const customPrompt = spoilerCustomPromptInput ? spoilerCustomPromptInput.value.trim() : '';
        
        if (!spoilerText) {
            // Show error feedback in the modal
            modalFeedback.textContent = 'Please enter some text for the spoiler';
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
        
        // Format with new spoiler tags, including optional custom prompt
        let formattedSpoiler;
        if (customPrompt) {
            formattedSpoiler = `||${customPrompt}:${spoilerText}||`;
        } else {
            formattedSpoiler = `||${spoilerText}||`;
        }
        
        console.log("Formatted spoiler:", formattedSpoiler);
        
        // Insert spoiler into the rich editor
        if (richEditorInstance) {
            richEditorInstance.insertContent(formattedSpoiler);
        } else {
            console.error('Rich editor not available for inserting spoiler');
        }
        
        // Show success feedback in the modal
        modalFeedback.textContent = 'Spoiler inserted successfully!';
        modalFeedback.style.backgroundColor = 'rgba(236, 253, 241, 0.98)'; // Default color
        modalFeedback.style.color = '#0c652f'; // Default color
        
        // Show the feedback with animation
        showFeedbackMessage(modalFeedback, true);
        
        // Hide the modal
        hideModal();
    }
    
    /**
     * Process selected text into a spoiler
     * @param {string} selectedText - The text selected in the editor
     */
    function wrapSelectionInSpoilerTags(selectedText) {
        // For wrapping selection, we'll use the default prompt or open modal for custom prompt.
        // Simplified: always use default prompt for quick wrapping.
        // If custom prompt is desired with selection, user can copy, open modal, paste, and add custom prompt.
        // Or, this function could be enhanced to open the modal with selectedText pre-filled.
        // Current implementation: Show modal if no text, otherwise wrap with default prompt.

        if (!selectedText || !selectedText.trim()) {
            // If no text is selected, show the modal to allow entering text and custom prompt
            showModal();
            return;
        }
        
        // If text is selected, wrap it with new spoiler tags (default prompt) and insert it
        const formattedSpoiler = `||${selectedText}||`;
        
        if (richEditorInstance) {
            // The standard way to handle selection in Quill
            const quill = richEditorInstance.getQuill();
            
            if (quill) {
                const selection = quill.getSelection();
                if (selection && selection.length > 0) {
                    quill.deleteText(selection.index, selection.length);
                    quill.insertText(selection.index, formattedSpoiler);
                    quill.setSelection(selection.index + formattedSpoiler.length);
                } else {
                    quill.insertText(quill.getLength() - 1, formattedSpoiler);
                }
            } else {
                // Fallback to our own insertContent
                richEditorInstance.insertContent(formattedSpoiler);
            }
        } else {
            console.error('Rich editor not available for wrapping selection');
        }
    }
    
    // Public API
    return {
        showModal,
        hideModal,
        insertSpoilerText,
        wrapSelectionInSpoilerTags
    };
}

export default initSpoilerModal;