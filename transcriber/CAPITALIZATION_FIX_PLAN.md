# Capitalization Fix Plan

## Current Issues

1. **Proper nouns appearing in lowercase**: "china", "united states", "mark kerr", "kerr", "dan boba"
2. **Need to ensure 100% of transcript cells start with capital letter**

## Current Implementation

### Location: `transcribe.py` lines 833-838
```python
# Fix Problem 1: Ensure text starts with capital letter
if text and text[0].islower():
    text = text[0].upper() + text[1:]

# Fix Problem 2: Fix mid-sentence capitalization using blacklist
text = fix_capitalization(text)
```

**Issue**: The current `fix_capitalization()` function only lowercases blacklisted words. It doesn't capitalize proper nouns that come in lowercase from Whisper.

## Proposed Solutions

### ✅ Solution 1: Enhance fix_capitalization with Title Case Detection (RECOMMENDED)

**Pros:**
- Fast, no LLM calls needed
- Uses simple heuristics
- Works well for most cases

**Cons:**
- May over-capitalize some words
- Can't handle ambiguous cases perfectly

**Implementation:**
```python
def fix_capitalization(text: str) -> str:
    """Fix incorrect capitalization using blacklist and title case rules."""
    if not text:
        return text

    words = text.split()
    if not words:
        return text

    result = []
    for i, word in enumerate(words):
        # First word: ensure capitalized
        if i == 0:
            if word and word[0].islower():
                word = word[0].upper() + word[1:]
            result.append(word)
            continue

        # Check if previous word ended with sentence punctuation
        if result and result[-1] and result[-1][-1] in '.!?':
            # Capitalize after sentence end
            if word and word[0].islower():
                word = word[0].upper() + word[1:]
            result.append(word)
            continue

        # Preserve standalone "I"
        if word == "I":
            result.append(word)
            continue

        # Preserve acronyms (all caps, 2+ letters)
        if len(word) >= 2 and word.isupper():
            result.append(word)
            continue

        # Check if word (without punctuation) is in blacklist
        word_clean = word.rstrip('.,;:!?\'"')

        if word_clean.lower() in NEVER_CAPITALIZE:
            # Lowercase the word, but preserve trailing punctuation
            trailing = word[len(word_clean):]
            result.append(word_clean.lower() + trailing)
        else:
            # NEW: Check if it looks like a proper noun (multi-word names, countries, etc.)
            # If the word is all lowercase and looks like it could be a proper noun, capitalize it
            if word_clean.islower() and len(word_clean) >= 2:
                # Check if it's likely a proper noun:
                # - Two or more words (space or hyphen separated)
                # - Common country/place indicators
                # - Common name patterns
                if should_be_capitalized(word_clean, context=result):
                    trailing = word[len(word_clean):]
                    result.append(word_clean.capitalize() + trailing)
                else:
                    result.append(word)
            else:
                # Keep as-is
                result.append(word)

    return ' '.join(result)


def should_be_capitalized(word: str, context: list) -> bool:
    """Heuristics to determine if a lowercase word should be capitalized."""

    # Common country and place names
    COUNTRIES = {
        'china', 'america', 'canada', 'mexico', 'france', 'germany', 'italy',
        'spain', 'russia', 'japan', 'korea', 'india', 'brazil', 'argentina',
        'australia', 'egypt', 'israel', 'iran', 'iraq', 'syria', 'turkey',
        'poland', 'ukraine', 'sweden', 'norway', 'denmark', 'finland',
        'portugal', 'greece', 'ireland', 'scotland', 'wales', 'england'
    }

    # Common proper noun indicators (words that often precede names)
    NAME_INDICATORS = {'mr', 'mrs', 'ms', 'dr', 'professor', 'president', 'senator', 'judge'}

    # Check if it's a known country
    if word.lower() in COUNTRIES:
        return True

    # Check if previous word is a name indicator
    if context and context[-1].rstrip('.,;:!?\'"').lower() in NAME_INDICATORS:
        return True

    # Check for compound names (e.g., "united states", "new york")
    if len(context) >= 1:
        prev_word = context[-1].rstrip('.,;:!?\'"')
        if prev_word[0].isupper():
            # Previous word was capitalized, this might be part of a multi-word proper noun
            compound = f"{prev_word.lower()} {word}"
            COMPOUND_NAMES = {
                'united states', 'new york', 'los angeles', 'san francisco',
                'new zealand', 'south africa', 'saudi arabia', 'united kingdom',
                'costa rica', 'puerto rico', 'hong kong', 'south korea', 'north korea'
            }
            if compound in COMPOUND_NAMES:
                return True

    return False
```

### 🔄 Solution 2: LLM-Based Capitalization Review (THOROUGH)

**Pros:**
- Most accurate
- Can handle ambiguous cases
- Uses context to make decisions

**Cons:**
- Slower (requires LLM calls)
- Depends on Ollama being available
- More complex to implement

**Implementation:**
Add a new function in `transcribe.py`:

```python
def review_capitalization_with_llm(text: str, title: str, description: str) -> str:
    """Use LLM to fix capitalization of proper nouns based on context."""
    if not OLLAMA_AVAILABLE:
        return text

    # Extract lowercase words that might be proper nouns
    words = text.split()
    lowercase_candidates = []

    for i, word in enumerate(words):
        word_clean = word.rstrip('.,;:!?\'"')
        if word_clean.islower() and len(word_clean) >= 2 and i > 0:
            # Skip common words
            if word_clean not in NEVER_CAPITALIZE:
                lowercase_candidates.append((i, word_clean))

    if not lowercase_candidates:
        return text

    # Ask LLM about each candidate
    for idx, candidate in lowercase_candidates:
        prompt = f"""Given this context:
VIDEO: "{title}"
DESCRIPTION: {description[:200]}...
SENTENCE: "{text}"

Should the word "{candidate}" be capitalized? Answer ONLY with YES or NO.
Consider: Is it a person's name, place, organization, or other proper noun?

Answer:"""

        try:
            response = ollama.chat(
                model=OLLAMA_MODEL,
                messages=[{'role': 'user', 'content': prompt}],
                options={'temperature': 0.0}
            )

            answer = response['message']['content'].strip().upper()
            if answer.startswith('YES'):
                # Capitalize it
                words[idx] = words[idx].capitalize()
        except Exception:
            # If LLM fails, continue without capitalizing
            pass

    return ' '.join(words)
```

Call it after fix_capitalization:
```python
text = fix_capitalization(text)
text = review_capitalization_with_llm(text, title, description)
```

### ⚡ Solution 3: Hybrid Approach (BALANCED - BEST)

Combine both approaches:
1. Use heuristics first (fast, catches obvious cases)
2. Use LLM only for ambiguous cases (slower, but accurate)

```python
# After fix_capitalization
text = fix_capitalization(text)  # Now includes title case heuristics

# Only use LLM for words that heuristics couldn't decide
if OLLAMA_AVAILABLE and has_ambiguous_capitalization(text):
    text = review_capitalization_with_llm(text, title, description)
```

## Recommended Implementation Order

### Phase 1: Immediate Fix (Do First)
**File: `transcribe.py` lines 833-838**

Make the first-letter capitalization more robust:

```python
# Fix Problem 1: Ensure text starts with capital letter (100% guaranteed)
if text:
    # Handle leading whitespace
    text = text.lstrip()
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
```

### Phase 2: Enhanced Heuristics
**File: `text_processing.py`**

1. Add `COUNTRIES` set
2. Add `NAME_INDICATORS` set
3. Add `COMPOUND_NAMES` set
4. Add `should_be_capitalized()` function
5. Enhance `fix_capitalization()` to use these heuristics

### Phase 3: Optional LLM Review (If Phase 2 isn't enough)
**File: `transcribe.py`**

Add LLM-based review for ambiguous cases

## Testing

After implementation, test with phrases like:
- "china and america" → "China and America"
- "mark kerr said" → "Mark Kerr said"
- "united states of america" → "United States of America"
- "dan boba is here" → "Dan Boba is here"
- "the president is" → "the president is" (keep lowercase if not a name)

## Files to Modify

1. **`text_processing.py`** - Main capitalization logic
2. **`transcribe.py`** (line 834) - Ensure first letter is always capitalized
3. **`transcribe.py`** (optional) - Add LLM review function

## Performance Impact

- **Phase 1**: Negligible (simple string check)
- **Phase 2**: Negligible (dictionary lookups)
- **Phase 3**: Moderate (LLM calls add ~0.5-1s per transcript cell)
