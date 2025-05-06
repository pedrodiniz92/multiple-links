Okay, here are the diffs for the proposed changes. I'll use ||custom prompt:spoiler text|| as the new spoiler syntax, where the custom prompt is optional. If only ||spoiler text|| is used, "show answer" will be the default prompt.

Note on spoiler-modal.js HTML:
The diff for spoiler-modal.js assumes you will add an HTML input field for the custom spoiler prompt in your main HTML structure where the modal is defined. For example:

HTML

<div class="form-group">
    <label for="spoiler-custom-prompt-input">Custom Prompt Text (optional):</label>
    <input type="text" id="spoiler-custom-prompt-input" placeholder="e.g., Reveal hint">
</div>
And that initSpoilerModal will receive options.spoilerCustomPromptInput referencing this element.

1. js/components/link-processor.js

Diff

--- a/js/components/link-processor.js
+++ b/js/components/link-processor.js
@@ -8,8 +8,15 @@
  * @returns {string} - Text with spoiler tags converted to HTML elements
  */
 function processSpoilerTags(text) {
-    // Replace spoiler tags with HTML elements
-    // Pattern: match text between // tags, but not greedy (non-greedy match with .*?)
-    return text.replace(/\/\/(.*?)\/\//g, '<span class="spoiler" data-spoiler-text="$1">show answer</span>');
+    // New pattern: ||optional custom prompt:spoiler text||
+    // Group 1: optional custom prompt
+    // Group 2: spoiler text
+    return text.replace(/\|\|(?:(.*?):)?(.*?)\|\|/g, (match, customPrompt, spoilerText) => {
+        const promptText = customPrompt ? customPrompt.trim() : 'show answer';
+        // Store the initial prompt in a data attribute as well, for easier restoration
+        return `<span class="spoiler" data-spoiler-text="${spoilerText.trim()}" data-prompt-text="${promptText}">${promptText}</span>`;
+    });
 }
 
 /**
@@ -24,7 +31,7 @@
     if (spoilerElement.classList.contains('revealed')) {
         // Hide spoiler text again
         spoilerElement.classList.remove('revealed');
-        spoilerElement.textContent = 'show answer';
+        spoilerElement.textContent = spoilerElement.dataset.promptText || 'show answer'; // Restore original prompt
         
         // Update card text alignment for hidden spoiler
         if (parentCard) {
2. js/editor/spoiler-modal.js

Diff

--- a/js/editor/spoiler-modal.js
+++ b/js/editor/spoiler-modal.js
@@ -7,6 +7,7 @@
  * @param {HTMLElement} options.modalElement - The modal container element
  * @param {HTMLElement} options.modalFeedback - Feedback element for notifications
  * @param {HTMLElement} options.spoilerTextInput - The textarea input for spoiler text
+ * @param {HTMLElement} options.spoilerCustomPromptInput - The input for custom prompt text (optional)
  * @param {HTMLElement} options.insertSpoilerBtn - Button to insert the spoiler
  * @param {HTMLElement} options.cancelBtn - Button to cancel and close modal
  * @param {Object} options.richEditorInstance - The rich editor instance for inserting content
@@ -18,6 +19,7 @@
         modalElement,
         modalFeedback,
         spoilerTextInput,
+        spoilerCustomPromptInput, // Added
         insertSpoilerBtn,
         cancelBtn,
         richEditorInstance,
@@ -38,6 +40,9 @@
         
         // Clear previous input
         spoilerTextInput.value = '';
+        if (spoilerCustomPromptInput) {
+            spoilerCustomPromptInput.value = ''; // Clear custom prompt input
+        }
         
         // Show the modal with flexbox display
         modalElement.style.display = 'flex';
@@ -102,6 +107,7 @@
      */
     function insertSpoilerText() {
         const spoilerText = spoilerTextInput.value.trim();
+        const customPrompt = spoilerCustomPromptInput ? spoilerCustomPromptInput.value.trim() : '';
         
         if (!spoilerText) {
             // Show error feedback in the modal
@@ -121,8 +127,12 @@
             return;
         }
         
-        // Format with spoiler tags
-        const formattedSpoiler = `//${spoilerText}//`;
+        // Format with new spoiler tags, including optional custom prompt
+        let formattedSpoiler;
+        if (customPrompt) {
+            formattedSpoiler = `||${customPrompt}:${spoilerText}||`;
+        } else {
+            formattedSpoiler = `||${spoilerText}||`;
+        }
         
         console.log("Formatted spoiler:", formattedSpoiler);
         
@@ -154,10 +164,18 @@
      * @param {string} selectedText - The text selected in the editor
      */
     function wrapSelectionInSpoilerTags(selectedText) {
+        // For wrapping selection, we'll use the default prompt or open modal for custom prompt.
+        // Simplified: always use default prompt for quick wrapping.
+        // If custom prompt is desired with selection, user can copy, open modal, paste, and add custom prompt.
+        // Or, this function could be enhanced to open the modal with selectedText pre-filled.
+        // Current implementation: Show modal if no text, otherwise wrap with default prompt.
+
         if (!selectedText || !selectedText.trim()) {
-            // If no text is selected, show the modal
+            // If no text is selected, show the modal to allow entering text and custom prompt
             showModal();
             return;
         }
         
-        // If text is selected, wrap it with spoiler tags and insert it
-        const formattedSpoiler = `//${selectedText}//`;
+        // If text is selected, wrap it with new spoiler tags (default prompt) and insert it
+        const formattedSpoiler = `||${selectedText}||`;
         
         if (richEditorInstance) {
             // The standard way to handle selection in Quill
3. js/components/card-manager.js

Diff

--- a/js/components/card-manager.js
+++ b/js/components/card-manager.js
@@ -31,7 +31,8 @@
         card.className = 'text-card';
         
         // Check if text contains spoiler tags
-        if (text.includes('//')) {
+        // Updated to check for new spoiler tag pattern
+        if (text.includes('||')) {
             // Process text with spoiler tags
             const processedHtml = processSpoilerTags(text);
             card.innerHTML = processedHtml;
4. README.md

Diff

--- a/README.md
+++ b/README.md
@@ -15,7 +15,9 @@
 
 ### Spoiler Tags
 - Users can add spoilers using either the spoiler button or by wrapping text with `||` tags.
-- When processing text, `processSpoilerTags` converts these tags to HTML elements
+- To use a custom prompt (the text shown before revealing the spoiler), use the format: `||Custom Prompt Text:Actual spoiler content||`
+- If no custom prompt is specified (e.g., `||Actual spoiler content||`), the default prompt "show answer" will be used.
+- When processing text, `processSpoilerTags` converts these tags into HTML elements.
 - The spoiler styling in CSS controls how they appear and behave
 - The `toggleSpoiler` function handles the clicking behavior to reveal/hide the spoiler text
 
Summary of Changes:

New Spoiler Tag: ||...||
Custom Prompt Syntax: ||My custom prompt:The secret is...||
Default Prompt: If no custom prompt is provided (e.g., ||The secret is...||), "show answer" is used.
link-processor.js:
processSpoilerTags updated to parse the new syntax and generate HTML with the correct prompt text. It now also stores the initial prompt text in data-prompt-text.
toggleSpoiler updated to restore the original prompt text (custom or default) when hiding the spoiler.
spoiler-modal.js:
Assumes a new input field for spoilerCustomPromptInput.
insertSpoilerText constructs the new spoiler tag format, including the custom prompt if provided.
wrapSelectionInSpoilerTags updated to use the new basic spoiler tag (could be enhanced to use the modal for custom prompts with selections).
card-manager.js:
Updated the check from text.includes('//') to text.includes('||') to correctly identify text that might contain spoilers.
README.md:
Documentation updated to reflect the new spoiler tag syntax and the custom prompt feature.
These diffs should implement the requested changes. Remember to add the new input field to your spoiler modal's HTML.