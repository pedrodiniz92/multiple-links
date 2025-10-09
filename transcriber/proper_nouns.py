#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Proper noun correction using ensemble scoring (phonetic + edit distance).
"""

import re

# Check if proper noun correction tools are available
try:
    import spacy
    from metaphone import doublemetaphone
    from rapidfuzz import fuzz
    PROPER_NOUN_CORRECTION_AVAILABLE = True
    nlp = None  # Lazy load
except ImportError:
    PROPER_NOUN_CORRECTION_AVAILABLE = False

# Simple English word list (common words to filter out)
# Using a minimal set for now - can be expanded
COMMON_ENGLISH_WORDS = {
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their",
    "what", "so", "up", "out", "if", "about", "who", "get", "which", "go",
    "me", "when", "make", "can", "like", "time", "no", "just", "him", "know",
    "take", "people", "into", "year", "your", "good", "some", "could", "them",
    "see", "other", "than", "then", "now", "look", "only", "come", "its", "over",
    "think", "also", "back", "after", "use", "two", "how", "our", "work",
    "first", "well", "way", "even", "new", "want", "because", "any", "these",
    "give", "day", "most", "us", "is", "was", "are", "been", "has", "had",
    "were", "said", "did", "having", "may", "should", "does", "am",
    # Add more common words that appear in the false positives
    "american", "americans", "america", "engineers", "engineer", "though", "thoughts",
    "tries", "hawaii", "its", "doesn", "doesn't", "russia", "new", "york",
    "city", "state", "times", "ross",
}

# Contractions that should never be "corrected"
CONTRACTIONS_PATTERN = re.compile(r"\b\w+n't\b|\b\w+'s\b|\b\w+'re\b|\b\w+'ve\b|\b\w+'ll\b|\b\w+'d\b", re.IGNORECASE)

# Alias/normalization map for common brand/entity variants
PROPER_NOUN_ALIASES = {
    "jp morgan": "JPMorgan",
    "jp morgan chase": "JPMorgan Chase",
    "j p morgan": "JPMorgan",
    "j.p. morgan": "JPMorgan",
    "abc news": "ABC News",
    "good morning america": "Good Morning America",
    "world news tonight": "World News Tonight",
    "javice": "Javice",
}


def normalize_for_comparison(text: str) -> str:
    """Normalize text for comparison: lowercase, strip punctuation/spaces."""
    return re.sub(r'[.\-\s]+', '', text.lower())


def get_nlp_model():
    """Lazy load spaCy model."""
    global nlp
    if nlp is None and PROPER_NOUN_CORRECTION_AVAILABLE:
        try:
            nlp = spacy.load("en_core_web_sm")
        except OSError:
            print("Warning: spaCy model not found. Run: python -m spacy download en_core_web_sm")
            return None
    return nlp


def extract_proper_nouns_from_text(text: str) -> list:
    """
    Extract proper nouns from text using NER + capitalized phrase heuristic.
    Returns list of proper noun strings.
    """
    if not PROPER_NOUN_CORRECTION_AVAILABLE:
        return []

    nlp_model = get_nlp_model()
    if nlp_model is None:
        # Fallback: just extract capitalized words/phrases
        return extract_capitalized_phrases(text)

    doc = nlp_model(text)
    proper_nouns = set()

    # Method 1: NER entities
    for ent in doc.ents:
        if ent.label_ in ('PERSON', 'ORG', 'GPE', 'PRODUCT', 'EVENT', 'WORK_OF_ART'):
            proper_nouns.add(ent.text)

    # Method 2: Capitalized phrases (catches things NER misses)
    capitalized = extract_capitalized_phrases(text)
    proper_nouns.update(capitalized)

    return list(proper_nouns)


def extract_capitalized_phrases(text: str) -> list:
    """Extract sequences of capitalized words (heuristic for proper nouns)."""
    # Match sequences of Title Case words
    pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b'
    matches = re.findall(pattern, text)

    # Filter out common words that are often capitalized at start of sentences
    common_start_words = {'The', 'A', 'An', 'In', 'On', 'At', 'To', 'For', 'And', 'But', 'Or', 'So'}
    filtered = []
    for match in matches:
        # Keep if not a single common word
        if ' ' in match or match not in common_start_words:
            filtered.append(match)

    return filtered


def compute_ensemble_score(original: str, candidate: str) -> dict:
    """
    Compute ensemble score using phonetic + edit distance.
    Returns dict with scores and overall confidence.
    """
    if not PROPER_NOUN_CORRECTION_AVAILABLE:
        return {'phonetic_match': False, 'edit_distance': 0, 'confidence': 'none'}

    # Normalize for comparison
    orig_norm = normalize_for_comparison(original)
    cand_norm = normalize_for_comparison(candidate)

    # Phonetic matching (DoubleMetaphone)
    orig_phonetic = doublemetaphone(orig_norm)
    cand_phonetic = doublemetaphone(cand_norm)
    phonetic_match = (orig_phonetic[0] == cand_phonetic[0]) or \
                     (orig_phonetic[1] and orig_phonetic[1] == cand_phonetic[1])

    # Edit distance (RapidFuzz token_set_ratio for multi-word)
    edit_score = fuzz.token_set_ratio(orig_norm, cand_norm)

    # Penalize first-letter mismatches heavily (proper nouns usually preserve first letter)
    # Compare first letters of the actual words (not normalized, to catch J vs D)
    orig_first = original[0].lower() if original else ''
    cand_first = candidate[0].lower() if candidate else ''
    if orig_first and cand_first and orig_first != cand_first:
        # Reduce edit score by 15 points for first-letter mismatch
        # This makes "Javis" → "Davis" much less attractive than "Javis" → "Javice"
        edit_score = max(0, edit_score - 15)

    # Determine confidence (slightly looser for short tokens)
    short = len(orig_norm) <= 6 or len(cand_norm) <= 6
    if phonetic_match and (edit_score >= (80 if short else 82)):
        confidence = 'high'  # Auto-suggest
    elif phonetic_match or edit_score >= (88 if short else 90):
        confidence = 'medium'  # Suggest
    elif edit_score >= (73 if short else 75):
        confidence = 'low'  # Only escalate to LLM
    else:
        confidence = 'none'  # No match

    return {
        'phonetic_match': phonetic_match,
        'edit_distance': edit_score,
        'confidence': confidence,
        'original': original,
        'candidate': candidate
    }


def find_best_match_multi_word(transcript_noun: str, title_nouns: list) -> dict:
    """
    Handle multi-word entities explicitly.
    Compare at phrase, bigram, and unigram levels.
    Favor longest candidate that contains matched sub-phrase.
    """
    best_match = None
    best_score = 0
    best_confidence = 'none'

    for title_noun in title_nouns:
        # Try full phrase match
        score_data = compute_ensemble_score(transcript_noun, title_noun)

        # Also try sub-phrase matching for multi-word entities
        transcript_words = transcript_noun.split()
        title_words = title_noun.split()

        # If transcript has multiple words, try matching to subphrases
        if len(transcript_words) > 1:
            # Try bigrams
            for i in range(len(title_words) - 1):
                bigram = ' '.join(title_words[i:i+2])
                bigram_score = compute_ensemble_score(transcript_noun, bigram)
                if bigram_score['edit_distance'] > score_data['edit_distance']:
                    # But prefer the full title_noun if bigram matches
                    score_data = bigram_score
                    score_data['candidate'] = title_noun  # Use full phrase

        if score_data['edit_distance'] > best_score:
            best_score = score_data['edit_distance']
            best_match = score_data['candidate']
            best_confidence = score_data['confidence']

    if best_match:
        return {
            'original': transcript_noun,
            'suggested': best_match,
            'confidence': best_confidence,
            'score': best_score
        }
    return None


def check_alias_map(text: str) -> str:
    """Check if text matches any alias and return normalized form."""
    normalized = text.lower().strip()
    for alias, canonical in PROPER_NOUN_ALIASES.items():
        if normalized == alias:
            return canonical
    return text


def is_common_word(word: str) -> bool:
    """Check if word is a common English word that shouldn't be corrected."""
    word_lower = word.lower().strip()

    # Check against our word list
    if word_lower in COMMON_ENGLISH_WORDS:
        return True

    # Check if it's a contraction
    if CONTRACTIONS_PATTERN.match(word):
        return True

    # Use spacy's vocabulary if available
    if PROPER_NOUN_CORRECTION_AVAILABLE:
        nlp_model = get_nlp_model()
        if nlp_model:
            # Check if word exists in spacy's vocabulary and is lowercase
            # (proper nouns are typically capitalized)
            doc = nlp_model(word_lower)
            if len(doc) == 1:
                token = doc[0]
                # If it's a common POS tag (not proper noun), filter it out
                if token.pos_ in ['PRON', 'DET', 'ADP', 'CCONJ', 'SCONJ', 'AUX', 'PART']:
                    return True

    return False


def passes_phonetic_similarity(original: str, suggested: str, threshold: int = 3) -> bool:
    """
    Check if two words are phonetically similar enough to be a transcription error.
    Uses edit distance on the original strings.
    """
    if not PROPER_NOUN_CORRECTION_AVAILABLE:
        return True  # Skip filter if tools not available

    # Normalize
    orig_norm = normalize_for_comparison(original)
    sugg_norm = normalize_for_comparison(suggested)

    # Calculate Levenshtein distance
    from rapidfuzz import distance
    edit_dist = distance.Levenshtein.distance(orig_norm, sugg_norm)

    # Allow threshold edits (insertions/deletions/substitutions)
    return edit_dist <= threshold


def apply_heuristic_filters(corrections: list) -> list:
    """
    Apply heuristic filters to reduce false positives.

    Args:
        corrections: List of correction dicts from find_proper_noun_corrections

    Returns:
        Filtered list of corrections
    """
    filtered = []

    for correction in corrections:
        original = correction['original']
        suggested = correction['suggested']

        # Filter 1: Skip if original is a common English word
        # UNLESS suggested is a known proper noun (higher confidence)
        if is_common_word(original):
            # Check if suggested is ALSO a common word - if so, definitely skip
            if is_common_word(suggested):
                print(f"  🔍 FILTERED: '{original}' → '{suggested}' (both common words)")
                continue
            # If original is common but suggested might be proper noun, keep only high confidence
            if correction['confidence'] != 'high':
                print(f"  🔍 FILTERED: '{original}' → '{suggested}' (original is common word, low confidence)")
                continue

        # Filter 2: Check phonetic similarity
        if not passes_phonetic_similarity(original, suggested, threshold=3):
            print(f"  🔍 FILTERED: '{original}' → '{suggested}' (not phonetically similar)")
            continue

        # Filter 3: Check if original looks like a multi-word proper noun that's already correct
        # e.g., "New York State" shouldn't be corrected to "New York Times"
        orig_words = original.split()
        sugg_words = suggested.split()
        if len(orig_words) > 1 and len(sugg_words) > 1:
            # If they differ in word count, likely wrong
            if len(orig_words) != len(sugg_words):
                print(f"  🔍 FILTERED: '{original}' → '{suggested}' (multi-word count mismatch)")
                continue

        # Filter 4: Additional check - if suggesting to add words to an already multi-word phrase
        # e.g., "New York" → "New York Times" (adding "Times")
        if len(orig_words) >= 2 and len(sugg_words) > len(orig_words):
            # Check if original is a subset of suggested
            # This usually means we're adding words, which is suspicious
            orig_lower = [w.lower() for w in orig_words]
            sugg_lower = [w.lower() for w in sugg_words]
            if all(w in sugg_lower for w in orig_lower):
                print(f"  🔍 FILTERED: '{original}' → '{suggested}' (adding words to existing phrase)")
                continue

        # Passed all filters
        filtered.append(correction)

    return filtered


def find_proper_noun_corrections(transcript_text: str, title: str, description: str, rows=None) -> list:
    """
    Main function to find proper noun corrections using ensemble scoring.

    Args:
        transcript_text: Full transcript text
        title: Video title
        description: Video description
        rows: Optional list of (start_ms, end_ms, text, vrel, speaker) tuples for timestamp extraction

    Returns list of correction suggestions:
    [
        {
            'original': 'Javis',
            'suggested': 'Javice',
            'confidence': 'high',
            'occurrences': 3,
            'contexts': ["...Charlie Javis sold...", "...Javis, now 33..."],
            'context_timestamps': [23, 45, 67]  # Video-relative seconds (if rows provided)
        },
        ...
    ]
    """
    if not PROPER_NOUN_CORRECTION_AVAILABLE:
        return []

    # Extract proper nouns from title and description
    title_nouns = extract_proper_nouns_from_text(title)
    desc_nouns = extract_proper_nouns_from_text(description)
    reference_nouns = list(set(title_nouns + desc_nouns))

    # Debug logging
    print(f"\n  📝 Extracted from title: {title_nouns if title_nouns else '(none)'}")
    print(f"  📝 Extracted from description: {desc_nouns if desc_nouns else '(none)'}")

    # Also add alias-expanded versions
    expanded_nouns = []
    for noun in reference_nouns:
        expanded_nouns.append(check_alias_map(noun))
    reference_nouns = list(set(reference_nouns + expanded_nouns))

    # Add single-token candidates from ALL multi-word entities
    # This ensures "Charlie Javice" also adds "Charlie" and "Javice" as standalone candidates
    single_word_candidates = []
    for noun in list(reference_nouns):
        parts = noun.split()
        if len(parts) >= 2:
            # Add ALL individual words (not just last names or longest)
            for word in parts:
                # Skip very short words and common words
                if len(word) >= 4 and word not in {'The', 'And', 'For', 'With', 'From'}:
                    single_word_candidates.append(word)

    reference_nouns += single_word_candidates

    # dedupe while preserving case
    reference_nouns = list(dict.fromkeys(reference_nouns))

    # Debug logging - show all reference candidates
    print(f"  📚 Total reference candidates (after splitting): {len(reference_nouns)}")
    if len(reference_nouns) <= 20:
        print(f"     {reference_nouns}")
    else:
        print(f"     {reference_nouns[:20]}... (showing first 20)")

    # Extract proper nouns from transcript
    transcript_nouns = extract_proper_nouns_from_text(transcript_text)
    print(f"  📄 Proper nouns found in transcript: {len(transcript_nouns)}")

    # Build a map of single-word to multi-word references for better matching
    # E.g., if we have "Charlie Javice" in reference, map "Javice" → "Charlie Javice"
    # Also track which words come from title/description directly (higher confidence)
    single_to_multi_map = {}
    word_source_weight = {}  # Track source weight for each word

    for ref_noun in reference_nouns:
        if ' ' in ref_noun:  # Multi-word
            words = ref_noun.split()
            for word in words:
                if len(word) >= 4 and word not in {'The', 'And', 'For'}:  # Skip common words
                    if word not in single_to_multi_map:
                        single_to_multi_map[word] = []
                    single_to_multi_map[word].append(ref_noun)

                    # Set high weight for words from multi-word entities in title/description
                    if word not in word_source_weight:
                        word_source_weight[word] = 10  # High priority
        else:
            # Standalone words get lower weight unless they're in title/description
            if ref_noun not in word_source_weight:
                # Check if this word appears in any multi-word entity
                appears_in_multi = any(ref_noun in multi for multi in reference_nouns if ' ' in multi)
                word_source_weight[ref_noun] = 10 if appears_in_multi else 5

    # Find corrections
    corrections = {}  # Use dict to de-duplicate

    for t_noun in transcript_nouns:
        # Skip if already in reference (correct)
        if t_noun in reference_nouns:
            continue

        # Check alias map first
        aliased = check_alias_map(t_noun)
        if aliased != t_noun and aliased in reference_nouns:
            corrections[t_noun] = {
                'original': t_noun,
                'suggested': aliased,
                'confidence': 'high',
                'method': 'alias'
            }
            continue

        # Context-aware matching: Check if this is part of a multi-word entity
        # E.g., "Charlie Javis" should prioritize "Charlie Javice" over "Javice" alone
        context_boost = None
        for ref_noun in reference_nouns:
            # If both have multiple words and share a word, boost this candidate
            t_words = set(t_noun.lower().split())
            ref_words = set(ref_noun.lower().split())
            if len(t_words) > 1 and len(ref_words) > 1:
                shared_words = t_words & ref_words
                if shared_words and len(shared_words) >= len(t_words) - 1:
                    # They share most words, likely the same entity
                    context_boost = ref_noun
                    break

        if context_boost:
            score_data = compute_ensemble_score(t_noun, context_boost)
            if score_data['confidence'] != 'none':
                corrections[t_noun] = {
                    'original': t_noun,
                    'suggested': context_boost,
                    'confidence': score_data['confidence'],
                    'score': score_data['edit_distance'],
                    'method': 'context_boost'
                }
                continue

        # Find best match using ensemble scoring
        match = find_best_match_multi_word(t_noun, reference_nouns)

        if match and match['confidence'] != 'none':
            # Check for ambiguity: are there other candidates within 3 points?
            other_candidates = []
            for ref_noun in reference_nouns:
                if ref_noun != match['suggested']:
                    score_data = compute_ensemble_score(t_noun, ref_noun)
                    if abs(score_data['edit_distance'] - match['score']) <= 3:
                        other_candidates.append((ref_noun, score_data['edit_distance']))

            # If there are competing candidates, prefer the one with higher source weight
            if other_candidates:
                suggested_weight = word_source_weight.get(match['suggested'], 0)
                for alt_noun, alt_score in other_candidates:
                    alt_weight = word_source_weight.get(alt_noun, 0)
                    # If alternative has significantly higher weight and similar score, switch to it
                    if alt_weight > suggested_weight and abs(alt_score - match['score']) <= 5:
                        match['suggested'] = alt_noun
                        match['score'] = alt_score
                        suggested_weight = alt_weight

            # Extract just the noun names for ambiguous list (not tuples)
            other_candidates = [noun for noun, _ in other_candidates] if other_candidates else []

            # Priority boost: If the suggested match appears in a multi-word reference entity,
            # boost its confidence (e.g., "Javice" from "Charlie Javice" is more reliable than standalone "Davis")
            suggested_in_multi = match['suggested'] in single_to_multi_map
            if suggested_in_multi:
                # Upgrade low → medium, medium → high
                if match['confidence'] == 'low':
                    match['confidence'] = 'medium'
                elif match['confidence'] == 'medium':
                    match['confidence'] = 'high'

            # If ambiguous, check if alternatives also appear in multi-word entities
            if other_candidates:
                # Filter out alternatives that don't appear in multi-word entities if our match does
                if suggested_in_multi:
                    other_candidates = [c for c in other_candidates if c in single_to_multi_map]

                if other_candidates:
                    match['ambiguous'] = True
                    match['alternatives'] = other_candidates
                    # Downgrade confidence for truly ambiguous matches
                    if match['confidence'] == 'high':
                        match['confidence'] = 'medium'

            corrections[t_noun] = match

    # Find occurrences and contexts for each correction
    result = []
    for original, correction_data in corrections.items():
        # Find all occurrences in transcript
        # Use word boundaries to avoid partial matches
        pattern = r'\b' + re.escape(original) + r'\b'
        occurrences = len(re.findall(pattern, transcript_text, re.IGNORECASE))

        # Get context snippets (±6 words) and timestamps
        contexts = []
        context_timestamps = []

        if rows:
            # Build a map of character position to row timestamp
            char_pos = 0
            pos_to_timestamp = []
            for start_ms, end_ms, text, vrel, speaker in rows:
                text_len = len(text)
                pos_to_timestamp.append((char_pos, char_pos + text_len, vrel))
                char_pos += text_len + 1  # +1 for space between rows

        for match in re.finditer(pattern, transcript_text, re.IGNORECASE):
            start = match.start()
            # Find word boundaries
            words_before = transcript_text[:start].split()[-6:]
            words_after = transcript_text[match.end():].split()[:6]
            matched_word = match.group()

            context = '...' + ' '.join(words_before) + ' **' + matched_word + '** ' + ' '.join(words_after) + '...'
            contexts.append(context.strip())

            # Find timestamp for this match
            if rows:
                for start_pos, end_pos, timestamp in pos_to_timestamp:
                    if start_pos <= start < end_pos:
                        context_timestamps.append(timestamp)
                        break
                else:
                    context_timestamps.append(None)  # No timestamp found

        # Limit to 3 context examples
        contexts = contexts[:3]
        context_timestamps = context_timestamps[:3] if rows else []

        result.append({
            'original': original,
            'suggested': correction_data['suggested'],
            'confidence': correction_data['confidence'],
            'occurrences': occurrences,
            'contexts': contexts,
            'context_timestamps': context_timestamps,
            'ambiguous': correction_data.get('ambiguous', False),
            'alternatives': correction_data.get('alternatives', [])
        })

    # Sort by confidence (high > medium > low) and occurrences
    confidence_order = {'high': 3, 'medium': 2, 'low': 1, 'none': 0}
    result.sort(key=lambda x: (confidence_order[x['confidence']], x['occurrences']), reverse=True)

    # Apply heuristic filters to reduce false positives
    print(f"\n  🔍 Applying heuristic filters to {len(result)} candidates...")
    filtered_result = apply_heuristic_filters(result)
    print(f"  ✓ After heuristic filtering: {len(filtered_result)} candidates remain")
    print(f"     (Note: LLM validation will run separately if enabled)\n")

    return filtered_result
