# Spoiler Tag Enhancement

## New Spoiler Tag Format

The spoiler tag system has been enhanced to support custom prompts:

- **New spoiler syntax**: `||optional custom prompt:spoiler text||`
- If no custom prompt is provided (e.g., `||spoiler content||`), the default "show answer" text will be used as the prompt.
- When clicking the prompt, the spoiler content is revealed.
- When clicking again, the original prompt is restored.

## Files Updated

1. `js/components/link-processor.js`:
   - Updated `processSpoilerTags` function to use the new syntax
   - Modified `toggleSpoiler` to restore the original prompt text

2. `js/editor/spoiler-modal.js`:
   - Added support for custom prompt input
   - Updated formatting for the new spoiler tag pattern

3. `js/components/card-manager.js`:
   - Updated check for spoiler tags to use the new pattern

4. `index.html`:
   - Added a new input field for the custom prompt in the spoiler modal dialog

5. `js/app.js`:
   - Added reference to the new prompt input
   - Updated spoiler modal initialization

## How to Use

### From the UI:
1. Click the Add Spoiler button
2. Enter the text you want to hide in the "Text to hide" field
3. (Optional) Enter a custom prompt in the "Custom Prompt Text" field
4. Click "Insert"

### Directly in Text:
- For default prompt: `||This is hidden text||`
- For custom prompt: `||Click to reveal:This is hidden text||`

## Example

Input text:
```
Here's a simple question. ||What's the capital of France?||

Here's another question. ||Click to see answer:The capital of France is Paris||
```

When rendered, this will show:
```
Here's a simple question. [show answer]

Here's another question. [Click to see answer]
```

After clicking the prompts, the hidden content will be revealed.