# Capitalization Issues

## Problem
1. Proper nouns appearing in lowercase: "china", "united states", "mark kerr", "dan boba"
2. These aren't shown in "Proper Noun Corrections" section
3. Need 100% guarantee that transcript cells start with capital letter

## Root Cause
- Whisper outputs lowercase proper nouns
- Current `fix_capitalization()` only lowercases blacklisted words, doesn't capitalize proper nouns
- The first-letter fix exists (line 834-835 in `transcribe.py`) but could be more robust

## Solution Options

See **CAPITALIZATION_FIX_PLAN.md** for complete details.

### Quick Summary:

**Phase 1: Immediate Fix** ✅
```python
# transcribe.py line 834
if text:
    text = text.lstrip()  # Handle leading whitespace
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
```

**Phase 2: Add Proper Noun Detection** (RECOMMENDED)
Enhance `fix_capitalization()` in `text_processing.py` with:
- Country names dict: china → China
- Name indicators: "mr smith" → "Mr Smith"
- Compound names: "united states" → "United States"

**Phase 3: LLM Review** (Optional, for ambiguous cases)
Use Ollama to check context-based capitalization

## Files to Edit
1. `transcribe.py` - Line 834 (ensure first capital)
2. `text_processing.py` - Enhance `fix_capitalization()` function
3. `transcribe.py` - (Optional) Add LLM review function

## Why They're Not in "Proper Noun Corrections"
The proper noun correction system looks for:
- Capitalized phrases in title/description
- Lowercase versions in transcript

If Whisper outputs "china" and the title has "China", it should match. If it's not showing up, the matching algorithm might need adjustment in `proper_nouns.py`.
