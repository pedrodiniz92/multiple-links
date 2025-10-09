# Proper Noun Correction - False Positive Reduction Plan

## Problem Analysis

The current system is generating too many false positive corrections. Out of 15 suggested corrections shown, only 2 are actually valid:
- ✅ **Dan Wong → Dan Wang** (correct proper noun)
- ✅ **Russ → Ross** (likely transcription error for the name)

The rest are false positives where the original text is already correct.

## Root Causes

1. **No context awareness** - System suggests "As → States" without understanding "as" is a preposition
2. **No phonetic similarity check** - "Hawaii → How" doesn't even sound similar
3. **No word validity check** - Suggesting corrections for already-valid words like "American", "Engineers", "Though"
4. **Over-eager pattern matching** - "New York" → "New York Times" is adding words unnecessarily
5. **Capitalization ignored** - Not using capitalization as a signal for proper nouns

## Proposed Solutions

### Option 1: Heuristic Filtering (No LLM needed - Recommended First Step)

Implement pre-filters to eliminate obvious false positives:

1. **Dictionary Check**
   - If original word exists in English dictionary, skip (unless suggested word is a known proper noun)
   - Keep corrections only if: (original NOT in dictionary) OR (suggested is in proper noun database)

2. **Phonetic Similarity**
   - Use phonetic distance (Soundex, Metaphone, or edit distance)
   - Only suggest if words sound similar (Levenshtein distance < 3 or similar phonetics)
   - This would eliminate: "Hawaii → How", "As → States", "Though → Thoughts"

3. **Capitalization Signal**
   - If original is already capitalized, it's likely already a proper noun (keep it unless high confidence)
   - If original is lowercase common word, don't suggest capitalized version

4. **Part-of-Speech Tagging** (lightweight)
   - Use a simple POS tagger to identify: pronouns (he, its), conjunctions (as, though), plural nouns (engineers)
   - Skip corrections for these grammatical words

5. **Contraction Detection**
   - Detect contractions like "doesn't", "tries" (present tense verb)
   - Don't suggest breaking valid contractions

**Estimated reduction: 80-90% of false positives eliminated**

### Option 2: LLM Validation (For Remaining Candidates)

After applying heuristics, use an LLM to validate remaining candidates:

**Model Choice:**
- **Local 8B (llama3.1:8b)** - Fast, good enough for validation task
- **32B (qwen2.5:32b)** - Better accuracy, still local
- **120B cloud** - If you need highest accuracy, but probably overkill

**Prompt Strategy:**
```
Given this transcription context:
"[timestamp] ...{50 words before}... {WORD} ...{50 words after}..."

Original: {original_word}
Suggested: {suggested_correction}

Is this correction necessary? Answer with:
- YES if it's clearly a proper noun that was mistranscribed
- NO if the original is already correct

Reasoning: [brief explanation]
```

**Batch Processing:**
- Group corrections and send 5-10 at once to reduce API calls
- Only validate candidates with "High" confidence from the detection system

**Estimated additional reduction: 50-75% of remaining false positives**

### Option 3: Hybrid Approach (Recommended)

```
1. Run heuristic filters → Reduce 15 candidates to ~3-4
2. For remaining candidates:
   - If confidence = "High" AND phonetically similar → Auto-apply
   - Otherwise → Run through llama3.1:8b for validation
3. Present only validated corrections to user
```

## Implementation Priority

### Phase 1: Quick Wins (Implement immediately)
1. Add dictionary check (use NLTK words corpus or similar)
2. Add phonetic similarity filter (editdistance library)
3. Add contraction detection (simple regex: /\w+'t$/, /\w+'s$/)

**Code changes needed:**
- `src/proper_noun_detector.py` or similar - add filter methods
- Add `english_words` library or similar
- Add `editdistance` or `jellyfish` library for phonetic matching

### Phase 2: LLM Validation (If Phase 1 isn't enough)
1. Add LLM validation function using llama3.1:8b
2. Batch processing for efficiency
3. Cache results to avoid re-checking same corrections

**Code changes needed:**
- Add `llm_validator.py` module
- Integration with ollama API
- Simple caching mechanism

### Phase 3: Learning System (Future)
1. Track user accept/reject decisions
2. Build whitelist of accepted corrections
3. Build blacklist of rejected suggestions
4. Fine-tune detection parameters

## Recommended Next Steps

1. **Examine current code**: Look at how proper noun corrections are currently generated
2. **Implement Phase 1 filters**: Should be 50-100 lines of code
3. **Test on this example**: See if false positives drop to acceptable level
4. **If needed, add LLM validation**: Use llama3.1:8b for remaining candidates

## Cost/Benefit Analysis

| Approach | Implementation Time | Runtime Cost | False Positive Reduction |
|----------|-------------------|--------------|--------------------------|
| Heuristics only | 2-3 hours | Near zero | 80-90% |
| + LLM 8B validation | +1-2 hours | ~$0.0001/word | 90-95% |
| + LLM 32B validation | +1-2 hours | ~$0.0005/word | 95-98% |

## My Recommendation

Start with **Phase 1 heuristic filtering**. Based on the examples shown, this alone would eliminate:
- American, Americans (in dictionary)
- As (in dictionary + POS filter)
- Engineers, Doesn, He, Though, Its (in dictionary)
- Tries (valid verb form)
- Hawaii (not phonetically similar to "How")
- New York State/City (original already correct + distance too far from "Times")

This leaves only:
- Dan Wong → Dan Wang ✅ (keep - phonetically similar + proper noun)
- Russ → Ross ✅ (keep - phonetically similar)
- Russia → Ross ❌ (eliminate - Russia is in dictionary)

Would you like me to examine the current code to see where these filters should be added?
