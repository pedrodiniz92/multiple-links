# LLM Review for Proper Noun Corrections

## Overview

We use **llama3.2:3b** (a 2GB local AI model) to help review uncertain proper noun corrections in video transcripts. This document explains exactly what we're asking the LLM and what information we're providing.

---

## When Does LLM Review Happen?

The LLM **only** reviews corrections that our phonetic+edit-distance algorithm marked as:
- **Medium confidence** - Phonetic match OR high edit distance (88-90%), but not both
- **Low confidence** - Moderate edit distance (73-75%) only

**High confidence corrections** are shown directly to you without LLM review (they're very likely correct).

---

## What Information We Feed the LLM

For each uncertain correction, we provide:

### 1. Video Context
```
Video title: "[Full title of the YouTube video]"
Description: "[First 300 characters of video description]..."
```

**Purpose:** Gives the LLM context about what the video is about, who's mentioned, what topics are discussed.

### 2. The Correction Being Reviewed
```
We found "[misspelled word]" in the transcript [X] time(s).
```

**Purpose:** Shows how common this word is in the transcript.

### 3. Context Snippets (Up to 2 examples)
```
Examples:
  - ...word word word **Javis** word word word...
  - ...word word word **Charlie Javis** word word word...
```

**Purpose:** Shows how the word appears in actual sentences (±6 words before/after). This helps the LLM understand if it's a person's name, company name, place name, etc.

### 4. The Proposed Correction
```
Should we correct "[original]" to "[suggested]"?
```

**Purpose:** The specific correction we're asking about (e.g., "Javis" → "Javice").

---

## The Full Prompt Template

Here's the exact prompt sent to llama3.2:3b:

```
You are helping proofread a video transcript. The video is titled "[TITLE]".

Description: [FIRST 300 CHARS OF DESCRIPTION]...

We found "[ORIGINAL]" in the transcript [N] time(s).
Examples:
  - [CONTEXT SNIPPET 1]
  - [CONTEXT SNIPPET 2]

Should we correct "[ORIGINAL]" to "[SUGGESTED]"?

Consider:
- Does the suggested correction match names/entities in the title/description?
- Does it make sense in context?
- Could this be a different person/entity?

Answer with ONLY:
"YES" - Apply this correction
"NO" - Don't apply this correction
"SUGGEST: [alternative]" - Suggest a different correction

Keep your answer to one line.
```

---

## Example: Real LLM Review

### Input Provided to LLM:
```
You are helping proofread a video transcript. The video is titled
"Young CEO Charlie Javice sentenced in $175M fraud case".

Description: Charlie Javice, founder of Frank Financial Aid, was
sentenced to prison for defrauding JPMorgan Chase in a $175 million
acquisition deal...

We found "Javis" in the transcript 8 time(s).
Examples:
  - ...entrepreneur Charlie Javis sold her education startup Frank...
  - ...but authorities say Javis fabricated millions of user accounts...

Should we correct "Javis" to "Javice"?

Consider:
- Does the suggested correction match names/entities in the title/description?
- Does it make sense in context?
- Could this be a different person/entity?

Answer with ONLY:
"YES" - Apply this correction
"NO" - Don't apply this correction
"SUGGEST: [alternative]" - Suggest a different correction

Keep your answer to one line.
```

### LLM Response:
```
YES
```

### What Happens:
- The correction "Javis" → "Javice" is **approved**
- Confidence is upgraded (low→medium or medium→high)
- In the HTML UI, it shows: **"Suggested by llama-3b"** instead of just "medium"
- You still have final say - you can edit/approve/reject it in the HTML interface

---

## LLM Configuration

- **Model:** `llama3.2:3b` (2GB, fast, runs locally via Ollama)
- **Temperature:** `0.3` (low = more consistent, less creative)
- **Max response:** 1 line (we only accept YES/NO/SUGGEST)

**Why 0.3 temperature?**
We want consistent, reliable answers based on facts (title/description), not creative variations.

---

## The Three Possible Outcomes

### ✅ 1. LLM Approves (`YES`)
```
[1] Reviewing: Javis → Javice (medium)
    ✓ Approved by LLM
```
- Confidence upgraded: low→medium or medium→high
- Tagged in HTML as "Suggested by llama-3b"
- You still approve/reject in final UI

### 🔄 2. LLM Suggests Alternative (`SUGGEST: ...`)
```
[2] Reviewing: JP Morgan → jpmorgan (low)
    → LLM suggests: JPMorgan
```
- LLM thinks we got it wrong, proposes better correction
- Uses LLM's suggestion instead
- Confidence set to medium
- Tagged as "Suggested by llama-3b"

### ❌ 3. LLM Rejects (`NO`)
```
[3] Reviewing: Davis → Javice (low)
    ✗ Rejected by LLM (keeping for user review)
```
- LLM thinks this correction is wrong
- We keep it in the list but marked as rejected
- You can still apply it manually if you disagree with LLM

---

## Privacy & Security

✅ **Runs 100% locally** - Ollama runs on your machine
✅ **No data sent to cloud** - Everything stays on your computer
✅ **Fast** - llama3.2:3b is only 2GB, reviews happen in <1 second each
✅ **Optional** - If Ollama isn't installed, proper noun correction still works (just without LLM review)

---

## Why This Approach Works

1. **Video title/description** = Ground truth for names/entities
2. **Context snippets** = See how the word is actually used
3. **Phonetic+edit distance** = Pre-filters to only likely matches
4. **LLM** = Final sanity check using contextual understanding
5. **You** = Ultimate decision maker in the HTML UI

The LLM acts as a **smart assistant**, not a decision maker. You always have the final say!
