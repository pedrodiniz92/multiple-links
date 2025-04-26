/**
 * Rich editor module for Quill editor setup and content management
 * With improved initialization and error handling based on backup-app.js
 */

// Import HTML utilities
import { fixHtmlEntitiesInUrls, escapeHtml } from '../utils/html-utils.js';

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
    let initializationAttempted = false;
    
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
                // Fix HTML entities in URLs
                content = fixHtmlEntitiesInUrls(content);
            }
            
            lines.push(content);
        });
        
        return lines.join('\n');
    }
    
    // The fixHtmlEntitiesInUrls function is now imported from html-utils.js
    
    /**
     * Set content in the Quill editor
     * @param {string} content - Text or HTML content to set in the editor
     */
    function setQuillContent(content) {
        if (!quill) {
            console.warn('Quill not initialized, cannot set content');
            
            // Store the content in the textarea as fallback
            if (urlInput) {
                urlInput.value = content;
            }
            
            return;
        }
        
        try {
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
            
            console.log('Content set in Quill editor successfully');
        } catch (error) {
            console.error('Error setting content in Quill:', error);
            
            // Fallback to textarea
            if (urlInput) {
                urlInput.value = content;
                urlInput.style.display = 'block';
                if (richEditor) {
                    richEditor.style.display = 'none';
                }
            }
        }
    }
    
    // The escapeHtml function is now imported from html-utils.js
    
    /**
     * Check if Quill is loaded and available
     * @returns {boolean} - Whether Quill is loaded
     */
    function isQuillLoaded() {
        return typeof Quill !== 'undefined';
    }
    
    /**
     * Try to load Quill dynamically if not already loaded
     * @returns {Promise} - Promise that resolves when Quill is loaded
     */
    function tryLoadQuill() {
        return new Promise((resolve, reject) => {
            if (isQuillLoaded()) {
                resolve(true);
                return;
            }
            
            console.log('Attempting to load Quill dynamically...');
            
            // Try to load Quill from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.quilljs.com/1.3.6/quill.min.js';
            script.onload = () => {
                console.log('Quill loaded successfully from CDN');
                
                // Also load CSS
                if (!document.querySelector('link[href*="quill.snow.css"]')) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
                    document.head.appendChild(link);
                }
                
                resolve(true);
            };
            script.onerror = () => {
                console.error('Failed to load Quill from CDN');
                reject(new Error('Failed to load Quill'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Initialize the Quill editor
     * @returns {boolean} - Whether initialization was successful
     */
    function initialize() {
        // Prevent multiple initialization attempts in same cycle
        if (initializationAttempted) {
            console.warn('Quill initialization already attempted');
            return quill !== null;
        }
        
        initializationAttempted = true;
        
        // Check if Quill is loaded
        if (!isQuillLoaded()) {
            console.error('Quill library not loaded');
            
            // Show the textarea as fallback
            if (urlInput) {
                urlInput.style.display = 'block';
            }
            
            if (richEditor) {
                richEditor.style.display = 'none';
            }
            
            // Try to load Quill dynamically (this will make future attempts work)
            tryLoadQuill().then(() => {
                console.log('Quill loaded, you can reload the page or try again');
            }).catch(error => {
                console.error('Could not load Quill:', error);
            });
            
            return false;
        }
        
        try {
            console.log('Initializing Quill editor...');
            
            // Make sure the rich editor container is visible
            if (richEditor) {
                richEditor.style.display = 'block';
            }
            
            // Hide the textarea
            if (urlInput) {
                urlInput.style.display = 'none';
            }
            
            // Configure toolbar options - similar to backup-app.js approach
            const toolbarOptions = [
                ['bold', 'italic', 'underline', 'strike'],
                ['color', 'background']
            ];
            
            // Initialize Quill editor
            quill = new Quill(richEditor, {
                theme: 'snow',
                modules: {
                    toolbar: '#editor-toolbar'
                },
                placeholder: 'Enter text here.\n\nTo add YouTube links, click the YouTube button above.'
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
            if (urlInput && urlInput.value && urlInput.value.trim()) {
                setQuillContent(urlInput.value);
            }
            
            console.log('Rich text editor initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Quill editor:', error);
            
            // Show the textarea as fallback
            if (urlInput) {
                urlInput.style.display = 'block';
            }
            
            if (richEditor) {
                richEditor.style.display = 'none';
            }
            
            return false;
        }
    }
    
    /**
     * Focus the Quill editor
     */
    function focus() {
        if (quill) {
            quill.focus();
        } else if (urlInput) {
            // Fallback to textarea if Quill is not available
            urlInput.focus();
        }
    }
    
    /**
     * Insert content at the current cursor position
     * @param {string} content - Content to insert
     */
    function insertContent(content) {
        if (!quill) {
            console.warn('Quill not initialized, cannot insert content');
            
            // Fallback to textarea
            if (urlInput) {
                const startPos = urlInput.selectionStart;
                const endPos = urlInput.selectionEnd;
                const textBefore = urlInput.value.substring(0, startPos);
                const textAfter = urlInput.value.substring(endPos);
                
                // Insert at the current cursor position
                urlInput.value = textBefore + content + textAfter;
                
                // Update cursor position
                urlInput.selectionStart = urlInput.selectionEnd = startPos + content.length;
                urlInput.focus();
            }
            
            return;
        }
        
        try {
            const selection = quill.getSelection();
            const insertPosition = selection ? selection.index : quill.getLength();
            
            // Insert at the current cursor position
            quill.insertText(insertPosition, content);
        } catch (error) {
            console.error('Error inserting content in Quill:', error);
            
            // Fallback to textarea
            if (urlInput) {
                urlInput.value += (urlInput.value ? '\n' : '') + content;
            }
        }
    }
    
    /**
     * Get the Quill instance
     * @returns {Object} - The Quill instance
     */
    function getQuill() {
        return quill;
    }
    
    /**
     * Attempt to reinitialize Quill if it failed before
     * @returns {boolean} - Whether reinitialization was successful
     */
    function tryReinitialize() {
        // Reset initialization flag
        initializationAttempted = false;
        
        // Try to initialize again
        return initialize();
    }
    
    // Public API
    return {
        initialize,
        focus,
        setQuillContent,
        convertQuillContentToLines,
        insertContent,
        getQuill,
        isQuillLoaded,
        tryReinitialize
    };
}

export default initRichEditor;