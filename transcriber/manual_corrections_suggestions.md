# Manual Proper Noun Corrections - Implementation Suggestions

## Problem Statement
When transcribing, some proper nouns appear in lowercase (e.g., "mark kerr") but should be capitalized ("Mark Kerr"). The current system only detects corrections based on title/description context, but misses names that:
- Aren't mentioned in the title/description
- Are transcribed with incorrect capitalization
- Need manual user knowledge to correct

You want a case-sensitive way to add corrections like: replace 'mark kerr' with 'Mark Kerr'.

---

## Solution: In-HTML "Add Custom Correction" UI

**Approach:** Add a button in the HTML corrections table to let users add new corrections on the fly.

### Implementation:

1. **Add UI in HTML** (`html_builder.py`):
   ```html
   <h3>Proper Noun Corrections</h3>
   <button onclick="showAddCorrectionForm()">+ Add Custom Correction</button>

   <div id="addCorrectionForm" style="display:none;">
     <input type="text" id="customOriginal" placeholder="Original text">
     <input type="text" id="customReplacement" placeholder="Replacement">
     <label><input type="checkbox" id="customCaseSensitive" checked> Case-sensitive</label>
     <button onclick="addCustomCorrection()">Add</button>
   </div>
   ```

2. **JavaScript function** to dynamically add rows:
   ```javascript
   function addCustomCorrection() {
     const original = document.getElementById('customOriginal').value;
     const replacement = document.getElementById('customReplacement').value;
     const caseSensitive = document.getElementById('customCaseSensitive').checked;

     // Add new row to corrections table with checkbox
     // Apply same logic as other corrections
   }
   ```

### Pros:
- User-friendly, no file editing
- Works directly in the output HTML
- Immediate visual feedback

### Cons:
- Corrections only apply to current HTML file
- Not persistent across transcriptions
- Requires more JavaScript complexity

---
