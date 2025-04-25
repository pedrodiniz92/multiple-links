/**
 * Rich editor module for Quill editor setup and content management
 */

/**
 * Initialize and set up the Quill rich text editor
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.editorContainer - Container element for the editor
 * @param {HTMLElement} options.richEditor - Element where Quill will be initialized
 * @param {HTMLElement} options.urlInput - The original textarea element for synchronization
 * @param {HTMLElement} options.addYouTubeBtn - Button to trigger YouTube link modal
 * @param {Function} [options.onContentChange] - Optional callback when content changes
 * @returns {Object} - Public API for the rich editor
 */
function initRichEditor(options) {
    const {
        editorContainer,
        richEditor,
        urlInput,
        addYouTubeBtn,
        onContentChange
    } = options;
    
    let quill = null;
    
    /**
     * Convert HTML content from Quill to a format compatible with our existing processing
     * @param {string} html - The HTML content from Quill
     * @returns {string} - Text in format suitable for link processing
     */
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
            
            // Special handling for headers (text starting with #)
            // This ensures that headers with formatting work correctly
            if (content.startsWith('<em>#')) {
                // Extract the header text with # but without the <em> tags
                const match = content.match(/<em>(#+\s*.*?)<\/em>/);
                if (match && match[1]) {
                    // Preserve the # symbol in the content but remove <em> tags
                    content = match[1];
                }
            } else if (content.startsWith('#')) {
                // Already a header, preserve as is
            }
            
            // Check if this line contains a URL and fix any HTML entities in it
            if (content.includes('http')) {
                // We'll use the HTML utils module in app.js for this, just preserve the content here
            }
            
            lines.push(content);
        });
        
        return lines.join('\n');
    }
    
    /**
     * Set content in the Quill editor
     * @param {string} content - Text or HTML content to set in the editor
     */
    function setQuillContent(content) {
        if (!quill) return;
        
        // Split content into lines
        const lines = content.split('\n');
        
        // Create HTML structure for Quill
        let html = '';
        lines.forEach(line => {
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
    
    /**
     * Helper function to escape HTML special characters
     * @param {string} text - Plain text to escape
     * @returns {string} - HTML-escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Initialize the Quill editor
     */
    function initialize() {
        if (typeof Quill === 'undefined') {
            console.error('Quill library not loaded');
            return false;
        }
        
        // Make sure the rich editor container is visible
        if (richEditor) {
            richEditor.style.display = 'block';
        }
        
        // Hide the textarea
        if (urlInput) {
            urlInput.style.display = 'none';
        }
        
        // Initialize Quill editor
        quill = new Quill(richEditor, {
            theme: 'snow',
            modules: {
                toolbar: '#editor-toolbar'
            },
            placeholder: 'Enter YouTube links or text.\n\nClick the YouTube button above for more options.'
        });
        
        // Sync Quill content to the hidden textarea
        quill.on('text-change', function() {
            // Get the HTML content from Quill
            const htmlContent = quill.root.innerHTML;
            
            // Update the hidden textarea with the processed content
            if (urlInput) {
                urlInput.value = convertQuillContentToLines(htmlContent);
                
                // Call the content change callback if provided
                if (typeof onContentChange === 'function') {
                    onContentChange(urlInput.value);
                }
            }
        });
        
        // If there's content in the textarea, initialize the editor with it
        if (urlInput && urlInput.value) {
            setQuillContent(urlInput.value);
        }
        
        console.log('Rich text editor initialized successfully');
        return true;
    }
    
    /**
     * Focus the Quill editor
     */
    function focus() {
        if (quill) {
            quill.focus();
        }
    }
    
    /**
     * Insert content at the current cursor position
     * @param {string} content - Content to insert
     */
    function insertContent(content) {
        if (!quill) return;
        
        const selection = quill.getSelection();
        const insertPosition = selection ? selection.index : quill.getLength();
        
        // Insert at the current cursor position
        quill.insertText(insertPosition, content);
    }
    
    /**
     * Get the Quill instance
     * @returns {Object} - The Quill instance
     */
    function getQuill() {
        return quill;
    }
    
    // Public API
    return {
        initialize,
        focus,
        setQuillContent,
        convertQuillContentToLines,
        insertContent,
        getQuill
    };
}

export default initRichEditor;