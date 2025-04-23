# Plan for Adding Context to YouTube Links

## Feature Requirements
- Add a new "Context (optional)" field to the YouTube link modal
- Position it below "YouTube URL" and above "Custom Title (optional)"
- The context should be displayed inside the video card before the timestamps
- Need to establish a syntax for storing the context with the link

## Syntax Options

### Option 1: Tagged Bracket Syntax `[t:Title][c:Context]link`
- **Pros:**
  - Very explicit with clear tags (`t:` for title, `c:` for context)
  - Each component has its own bracket section, making it unambiguous
  - Absence of a tag means that component is intentionally omitted
  - Easy to extend with additional tagged sections in the future
  - No delimiter conflicts since each component is in its own bracket
- **Cons:**
  - More verbose than some alternatives
  - Multiple bracket sections might appear cluttered

### Option 2: Extended Square Bracket Syntax `[title]link[c:context]`
- **Pros:**
  - Similar to the syntax proposed in next.md
  - Clear demarcation of context with the `c:` prefix
  - Context is separated from title, making it easier to distinguish
- **Cons:**
  - Double bracketed syntax might be visually cluttered
  - Parsing becomes more complex with multiple bracket sections
  - Less explicit about the title component

### Option 3: Combined Bracket with Delimiter `[title::context]link`
- **Pros:**
  - More compact than options 1 and 2
  - Single bracket notation maintains simplicity
  - Both fields remain optional
- **Cons:**
  - The delimiter might appear in titles or contexts
  - Less visually distinct between title and context
  - Not as explicit as tagged syntax

### Option 4: JSON-inspired Notation `[{"t":"title","c":"context"}]link`
- **Pros:**
  - Most extensible for future additions (e.g., notes, tags)
  - Clear structural separation of different attributes
- **Cons:**
  - Significantly more verbose
  - Overkill for the current requirements
  - More complex to implement and parse

## Recommended Approach: Tagged Bracket Syntax `[t:Title][c:Context]link`

I recommend the tagged bracket syntax you proposed: `[t:Title][c:Context]link`

Reasons:
1. **Explicit and Clear**: The tags make it unmistakable what each component represents
2. **Naturally Optional**: Omitting a bracket section clearly indicates that component is not included
3. **Extensible**: Additional tag types could be added in the future (e.g., `[n:Notes]` or `[ts:5]` for timestamp)
4. **No Delimiter Conflicts**: Since each component has its own brackets, there's no need for delimiters that might conflict with content
5. **Backward Compatible**: The current implementation without context can easily transition to this format
6. **Unambiguous Parsing**: The parser can look specifically for tagged brackets, making implementation straightforward

With this syntax:
- No title, no context: `link` (plain link)
- Title only: `[t:Title]link`
- Context only: `[c:Context]link`
- Both: `[t:Title][c:Context]link`

## Implementation Plan
1. Add the new Context field to the YouTube modal UI between URL and Title fields
2. Modify the `insertYouTubeLink()` function to format links using the new tagged syntax
3. Update the `parseLinkWithTitle()` function to recognize and extract tagged components
4. Enhance the link card generation to display the context information
5. Add CSS styling for the context display in link cards

## UI Presentation
The context should be displayed in the link cards with distinctive styling:
- Positioned before the timestamps
- Slightly smaller font than the title
- Light gray or subdued color for visual hierarchy
- Possibly italicized to differentiate from other elements
- Optional: Add a subtle visual separator between context and timestamps

## Edge Cases to Handle
- Empty tags (e.g., `[t:][c:]link`) should be treated as intentionally empty components
- Tags with whitespace (e.g., `[t: Title with spaces ]`) should be trimmed
- Nested brackets within title or context content
- Very long contexts (consider truncation with ellipsis)

This tagged approach provides the clearest, most explicit solution with excellent extensibility for future enhancements.