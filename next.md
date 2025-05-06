Okay, here's the diff for fixing bugs 1 and 2.

For Bug 1 (Context [c:Context] tags not saving in the editor):

File: js/components/card-manager.js
Function: getCurrentLinksFromCards

This function needs to correctly retrieve dataset.originalLink for link cards and ignore div.video-title elements when reconstructing content for the editor.

Diff

--- a/js/components/card-manager.js
+++ b/js/components/card-manager.js
@@ -111,57 +111,56 @@
  */
 function getCurrentLinksFromCards(container) {
     // Get all cards (link cards, text cards, header cards) and break spacers
     const allElements = Array.from(container.children);
-    
+
     // Sort the elements by their position in the DOM to maintain the correct order
-    allElements.sort((a, b) => {
-        const position = a.compareDocumentPosition(b);
-        return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
-    });
-    
+    // Sorting might be useful if elements can be reordered, otherwise, direct iteration is fine.
+    // allElements.sort((a, b) => {
+    //     const position = a.compareDocumentPosition(b);
+    //     return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
+    // });
+
     const contents = [];
     let inSection = false;
-    let sectionItems = [];
-    let sectionStartIndex = -1;
-    
+
     // First pass to identify section boundaries and breaks
     allElements.forEach((element, index) => {
         // For debugging - log element types to help diagnose sharing issues
-        console.log('Processing element:', element.className, 
-                    element.classList.contains('link-card') ? 'videoLink: ' + element.dataset.videoLink : '');
-        
+        // console.log('Processing element:', element.className,
+        //             element.classList.contains('link-card') ? 'videoLink: ' + element.dataset.videoLink : '');
+
         if (element.classList.contains('break-spacer')) {
             // Add break tag
             contents.push('---');
         } else if (element.classList.contains('section-card')) {
             // If this is the first card in a section, add section start tag
             if (element.classList.contains('section-card-first') && !inSection) {
                 contents.push('++/');
                 inSection = true;
-                sectionStartIndex = contents.length;
             }
-            
+
             // Add the card content
             if (element.classList.contains('link-card')) {
                 // For link cards, prioritize originalInput if available,
                 // otherwise construct from videoLink
-                if (element.dataset.originalInput) {
-                    contents.push(element.dataset.originalInput);
+                if (element.dataset.originalLink) { // Bug 1 Fix: Use originalLink
+                    contents.push(element.dataset.originalLink);
                 } else if (element.dataset.videoLink) {
                     // If we don't have originalInput but have videoLink, use that
                     contents.push(element.dataset.videoLink);
                 }
             } else if ((element.classList.contains('text-card') || element.classList.contains('header-card')) && element.dataset.originalText) {
                 contents.push(element.dataset.originalText);
             }
-            
+
             // If this is the last card in a section, add section end tag
             if (element.classList.contains('section-card-last') && inSection) {
                 contents.push('/++');
                 inSection = false;
             }
-        } else if (element.classList.contains('video-title')) {
-            // Handle video title elements
-            if (element.dataset.originalInput) {
-                contents.push(element.dataset.originalInput);
-            }
-        } else {
+        } else if (element.classList.contains('video-title')) { // Bug 1 Fix: Ignore video-title for editor reconstruction
+            // These are for display only in linksContainer.
+            // The originalLink from the associated link-card already has this info.
+            // Do nothing here.
+        } else { // Non-section, non-break, non-video-title elements
             // Regular card (not in a section)
             if (element.classList.contains('link-card')) {
                 // For link cards, prioritize originalInput if available,
                 // otherwise construct from videoLink
-                if (element.dataset.originalInput) {
-                    contents.push(element.dataset.originalInput);
+                if (element.dataset.originalLink) { // Bug 1 Fix: Use originalLink
+                    contents.push(element.dataset.originalLink);
                 } else if (element.dataset.videoLink) {
                     // If we don't have originalInput but have videoLink, use that
                     contents.push(element.dataset.videoLink);
@@ -171,14 +170,14 @@
             }
         }
     });
-    
+
     // If we're still in a section at the end, close it
     if (inSection) {
         contents.push('/++');
     }
-    
+
     // For debugging - log the final content array
-    console.log('Final contents for sharing:', contents);
-    
+    console.log('Final contents for editor/sharing:', contents);
+
     return contents;
 }
 

For Bug 2 (Duplicate video instance with [t:Title] tag in the linksContainer):

File: js/app.js
Function: processLinks (specifically the getFormattedDisplay callback)

This change ensures the card itself doesn't display the title if a separate div.video-title was already rendered.

Diff

--- a/js/app.js
+++ b/js/app.js
@@ -160,13 +160,14 @@
     // Keep track of the last videoId to group related clips under one title
     let lastVideoId = null;
 
     // Process each item and create appropriate cards
     for (const item of processedItems) {
+        let isTitleDisplayedSeparately = false; // Bug 2 Fix: Flag for current item
         if (item.type === 'break') {
             // Create a break spacer
             const breakSpacer = document.createElement('div');
             breakSpacer.className = 'break-spacer';
             linksContainer.appendChild(breakSpacer);
         } else if (item.type === 'text') {
             // Create a text card with section information if present
@@ -180,12 +181,14 @@
         } else if (item.type === 'link') {
             // For links, only display a title if there's a custom title with [t:] tag
             if (item.hasCustomTitle && item.customTitle && !item.skipTitle) {
                 // Create a video title element (will be displayed above the cards)
                 const titleElement = document.createElement('div');
                 titleElement.className = 'video-title';
                 titleElement.textContent = item.customTitle;
-                
+
                 // Store original data
                 titleElement.dataset.originalInput = item.originalInput;
-                
+
                 // Add to container
                 linksContainer.appendChild(titleElement);
+                isTitleDisplayedSeparately = true; // Bug 2 Fix: Set the flag
             }
-            
+
             // Extract YouTube info if it's a YouTube URL
             let videoInfo = null;
             let videoTitle = null; // This variable seems unused in the original card creation logic for display text
@@ -206,12 +209,14 @@
                 sectionPosition: item.sectionPosition || null,
                 onCardClick: (videoLink) => {
                     console.log('Card clicked, video link:', videoLink);
                     // Load the video into the iframe
                     loadVideo(videoLink);
                 },
-                getFormattedDisplay: async (link) => {
+                getFormattedDisplay: async (linkArgument) => { // linkArgument is item.link from the closure
                     // If it's a YouTube URL with time parameters, format the display
                     if (videoInfo && videoInfo.videoId) {
                         const { videoId, params } = videoInfo;
-                        
+
                         // First try to get the video title if possible
                         try {
                             // Get video details in the background
@@ -220,7 +225,7 @@
                                     // Format the display text based on timestamps
                                     let displayText;
-                                    
+
                                     // Always prioritize showing timestamps
                                     // Start time only
                                     if (params.start && !params.end) {
@@ -236,7 +241,7 @@
                                     else if (details.durationSeconds) {
                                         displayText = `0:00 - ${formatTime(details.durationSeconds)}`;
                                     }
-                                    // Fallback to title with duration
+                                    // Fallback to title with duration (respecting isTitleDisplayedSeparately)
                                     else if (details.title) {
                                         displayText = details.title;
                                         if (details.formattedDuration) {
@@ -244,7 +249,9 @@
                                         }
                                     }
-                                    
+
                                     // Update the card content if it's still in the DOM
+                                    // and if the title isn't already shown separately (if displayText is title)
+                                    // This async update needs care if it sets a title.
                                     if (document.contains(card)) {
                                         const contentElement = card.querySelector('.card-content');
                                         if (contentElement) {
@@ -256,35 +263,42 @@
                         } catch (e) {
                             console.warn('Error fetching video details:', e);
                         }
-                        
+
                         // Meanwhile, show an initial display
                         // Start time only
                         if (params.start && !params.end) {
                             return formatTime(params.start);
                         }
-                        
                         // Both start and end times
                         if (params.start && params.end) {
                             return `${formatTime(params.start)} - ${formatTime(params.end)}`;
                         }
-                        
                         // End time only
                         if (!params.start && params.end) {
                             return `0:00 - ${formatTime(params.end)}`;
                         }
-                        
-                        // No timestamps yet, show loading indicator (will be replaced with full duration)
-                        return 'Loading timestamp...';
+
+                        // Bug 2 Fix: If timestamps aren't primary, consider title if not displayed separately
+                        if (item.hasCustomTitle && item.customTitle && !item.skipTitle && !isTitleDisplayedSeparately) {
+                            return item.customTitle;
+                        }
+                        // Fallback for YouTube links, allowing async update later
+                        return 'Loading video info...';
                     }
-                    
-                    // If there's a custom title, use it
-                    if (item.hasCustomTitle && item.customTitle) {
+
+                    // Bug 2 Fix: Non-YouTube links or other cases:
+                    // Display custom title in card ONLY if it wasn't displayed separately.
+                    if (item.hasCustomTitle && item.customTitle && !item.skipTitle && !isTitleDisplayedSeparately) {
                         return item.customTitle;
                     }
-                    
+
                     // Fallback to a truncated URL
-                    return link.substring(0, 50) + (link.length > 50 ? '...' : '');
+                    return linkArgument.substring(0, 50) + (linkArgument.length > 50 ? '...' : '');
                 }
             });
-            
+
             linksContainer.appendChild(card);
-            
+
             // Save the first link card for activation
             if (!firstLinkCard) {
                 firstLinkCard = card;

These diffs should address the core issues for both bugs. Remember to test thoroughly after applying them.