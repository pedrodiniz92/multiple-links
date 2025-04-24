/**
 * Utilities for handling Quill editor content
 */

/**
 * Convert Quill HTML content to a format compatible with our processing
 * @param {string} html - HTML content from Quill
 * @returns {string} Processed content in line format
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
        
        // Check if this line contains a URL and fix any HTML entities in it
        if (content.includes('http')) {
            // Extract URLs and normalize them
            content = fixHtmlEntitiesInUrls(content);
        }
        
        lines.push(content);
    });
    
    return lines.join('\n');
}

/**
 * Set Quill content from plain text or HTML
 * @param {Quill} quill - Quill editor instance
 * @param {string} content - Content to set
 */
function setQuillContent(quill, content) {
    if (!quill) return;
    
    // Split content into lines
    const lines = content.split('\n');
    
    // Create HTML structure for Quill
    let html = '';
    lines.forEach((line, index) => {
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

// Export functions globally
window.convertQuillContentToLines = convertQuillContentToLines;
window.setQuillContent = setQuillContent;