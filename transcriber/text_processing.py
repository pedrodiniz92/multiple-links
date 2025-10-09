#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Text processing functions for transcript cleanup and sentence splitting.
"""

import re

# Regex for sentence-ending punctuation
SENT_END_RE = re.compile(r'[.!?]+\s*$')

# Blacklist of words that should never be capitalized mid-sentence
NEVER_CAPITALIZE = {
    "and", "or", "but", "the", "a", "an",
    "they", "them", "their", "he", "she", "it",
    "was", "were", "is", "are", "am",
    "have", "has", "had", "do", "does", "did",
    "will", "would", "should", "could", "can",
    "this", "that", "these", "those",
    "what", "where", "when", "why", "how",
}

# Check if punctuation model is available
try:
    from deepmultilingualpunctuation import PunctuationModel
    PUNCTUATION_AVAILABLE = True
except ImportError:
    PUNCTUATION_AVAILABLE = False


def merge_segments(rows, gap_ms=2500):
    """
    rows: list[(start_ms, end_ms, text, video_rel_s, speaker, words)]
    Merge adjacent rows if:
    - Previous text does NOT end with sentence-final punctuation
    - Gap between segments <= gap_ms
    - Same speaker (or both None)
    Keep first timestamp/link/speaker and combine word timestamps.
    """
    if not rows:
        return rows
    rows = sorted(rows, key=lambda r: r[0])
    out = []

    # Handle both old format (5 items) and new format (6 items with words)
    if len(rows[0]) == 6:
        cur_start, cur_end, cur_text, cur_vrel, cur_speaker, cur_words = rows[0]
    else:
        cur_start, cur_end, cur_text, cur_vrel, cur_speaker = rows[0]
        cur_words = []

    for row in rows[1:]:
        # Unpack with words if available
        if len(row) == 6:
            s_ms, e_ms, text, vrel, speaker, words = row
        else:
            s_ms, e_ms, text, vrel, speaker = row
            words = []

        prev_txt = (cur_text or "").rstrip()
        gap = s_ms - cur_end
        sentence_end = bool(SENT_END_RE.search(prev_txt))
        same_speaker = (cur_speaker == speaker)

        if (not sentence_end) and (gap <= gap_ms) and same_speaker:
            sep = "" if prev_txt.endswith((" ", "\u00A0", "-","—")) else " "
            cur_text = (prev_txt + sep + (text or "").lstrip()).strip()
            cur_end = max(cur_end, e_ms)
            # Merge word timestamps
            if cur_words is not None and words:
                cur_words = cur_words + words
        else:
            out.append((cur_start, cur_end, cur_text, cur_vrel, cur_speaker, cur_words))
            cur_start, cur_end, cur_text, cur_vrel, cur_speaker, cur_words = s_ms, e_ms, text, vrel, speaker, words

    out.append((cur_start, cur_end, cur_text, cur_vrel, cur_speaker, cur_words))
    return out


def fix_capitalization(text: str) -> str:
    """Fix incorrect mid-sentence capitalization using blacklist."""
    if not text:
        return text

    words = text.split()
    if not words:
        return text

    result = []
    for i, word in enumerate(words):
        # First word: keep as-is (already capitalized in Problem 1 fix)
        if i == 0:
            result.append(word)
            continue

        # Check if previous word ended with sentence punctuation
        if result and result[-1] and result[-1][-1] in '.!?':
            # Keep capital after sentence end
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
            # Keep as-is (might be proper noun)
            result.append(word)

    return ' '.join(result)


def fix_false_starts(text: str) -> str:
    """Replace repeated utterances with em dashes (word—word) within sentences only."""
    if not text:
        return text

    # Split by sentence-ending punctuation, keeping the punctuation
    sentences = re.split(r'([.!?]+\s*)', text)

    result = []
    for i, part in enumerate(sentences):
        if i % 2 == 0 and part.strip():  # This is a sentence (not punctuation)
            result.append(fix_repetitions_in_sentence(part))
        else:  # This is punctuation or whitespace
            result.append(part)

    return ''.join(result)


def fix_repetitions_in_sentence(sentence: str) -> str:
    """Fix repetitions within a single sentence."""
    if not sentence:
        return sentence

    words = sentence.split()
    result = []
    i = 0

    while i < len(words):
        found_repeat = False

        # Try different repetition lengths (longer sequences first)
        # Maximum of 10 words or half the remaining words
        max_len = min(10, (len(words) - i) // 2)

        for repeat_len in range(max_len, 0, -1):
            # Check if we have enough words left for this repetition length
            if i + repeat_len * 2 > len(words):
                continue

            # Get the two sequences to compare
            seq1 = words[i:i + repeat_len]
            seq2 = words[i + repeat_len:i + repeat_len * 2]

            # Compare case-insensitive
            if [w.lower() for w in seq1] == [w.lower() for w in seq2]:
                # Found a repetition!
                # Special case: if it's just the word "and", use comma instead of em dash
                if repeat_len == 1 and seq1[0].lower() == 'and':
                    result.append(seq1[0] + ', ' + seq2[0])
                else:
                    # Normal case: use em dash (no spaces)
                    result.append(' '.join(seq1) + '—' + ' '.join(seq2))

                i += repeat_len * 2
                found_repeat = True
                break

        if not found_repeat:
            # No repetition found at this position
            result.append(words[i])
            i += 1

    return ' '.join(result)


def split_on_linking_words(text: str, start_ms: int, end_ms: int, word_timestamps: list) -> list:
    """
    Split long text on linking words closest to the middle.
    Returns list of (text, start_ms, end_ms) tuples.
    """
    # Common linking words (conjunctions and transition words)
    LINKING_WORDS = {
        'and', 'but', 'so', 'because', 'or', 'yet', 'for', 'nor',
        'however', 'therefore', 'thus', 'hence', 'moreover',
        'furthermore', 'nevertheless', 'meanwhile', 'otherwise',
        'besides', 'consequently', 'accordingly', 'additionally'
    }

    # Find all linking word positions
    words = text.split()
    middle_index = len(words) // 2
    best_split_index = None
    best_distance = float('inf')

    for i, word in enumerate(words):
        # Check if word (lowercase, without punctuation) is a linking word
        word_clean = word.lower().strip('.,;:!?')
        if word_clean in LINKING_WORDS:
            distance = abs(i - middle_index)
            if distance < best_distance:
                best_distance = distance
                best_split_index = i

    # If no linking word found, just split at middle
    if best_split_index is None:
        best_split_index = middle_index

    # Split the text
    first_half = ' '.join(words[:best_split_index])
    second_half = ' '.join(words[best_split_index:])

    # Capitalize second half
    if second_half and second_half[0].islower():
        second_half = second_half[0].upper() + second_half[1:]

    # Assign timestamps
    if word_timestamps and len(word_timestamps) > best_split_index:
        # Use word-level timestamps for accurate splitting
        split_time_ms = int(word_timestamps[best_split_index].get('start', 0) * 1000)
        return [
            (first_half, start_ms, split_time_ms),
            (second_half, split_time_ms, end_ms)
        ]
    else:
        # Proportional split if no word timestamps
        total_words = len(words)
        proportion = best_split_index / total_words
        split_time_ms = start_ms + int((end_ms - start_ms) * proportion)
        return [
            (first_half, start_ms, split_time_ms),
            (second_half, split_time_ms, end_ms)
        ]


def split_long_sentence(text: str, start_ms: int, end_ms: int, word_timestamps: list, model_manager) -> list:
    """
    Split long text into sentences using ML punctuator and word-level timestamps.
    Returns list of (text, start_ms, end_ms) tuples.
    """
    # Threshold: > 300 chars
    text_len = len(text)
    if text_len <= 300:
        return [(text, start_ms, end_ms)]

    if not PUNCTUATION_AVAILABLE:
        return [(text, start_ms, end_ms)]

    if not word_timestamps:
        return [(text, start_ms, end_ms)]

    # Use pre-loaded punctuation model from ModelManager
    punct_model = model_manager.punctuation_model
    if punct_model is None:
        return [(text, start_ms, end_ms)]

    # Add proper punctuation
    try:
        punctuated_text = punct_model.restore_punctuation(text)
        # Replace hyphens with commas (deepmultilingualpunctuation adds unwanted hyphens)
        punctuated_text = re.sub(r'-(\s)', r',\1', punctuated_text)
    except Exception as e:
        print(f"Warning: Punctuation model failed ({e}), keeping original")
        punctuated_text = text

    # Split by sentences
    sentences = re.split(r'([.!?]+\s*)', punctuated_text)
    # Recombine sentences with their punctuation
    sentences = [''.join(sentences[i:i+2]).strip()
                 for i in range(0, len(sentences)-1, 2) if sentences[i].strip()]

    # If only one sentence after punctuation, don't split
    if len(sentences) <= 1:
        return [(text, start_ms, end_ms)]

    # We have 2+ sentences - split them!
    result = assign_timestamps_to_sentences(sentences, word_timestamps, start_ms, end_ms)

    # Second pass - check if any resulting sentence is still > 300 chars
    final_result = []
    for sub_text, sub_start_ms, sub_end_ms in result:
        if len(sub_text) > 300:
            # Find word timestamps for this subsection
            sub_words = [w for w in word_timestamps
                        if w.get('start', 0) * 1000 >= sub_start_ms
                        and w.get('end', 0) * 1000 <= sub_end_ms]
            # Split by linking words
            split_by_linking = split_on_linking_words(sub_text, sub_start_ms, sub_end_ms, sub_words)
            final_result.extend(split_by_linking)
        else:
            final_result.append((sub_text, sub_start_ms, sub_end_ms))

    return final_result


def assign_timestamps_to_sentences(sentences: list, word_timestamps: list,
                                   fallback_start_ms: int, fallback_end_ms: int) -> list:
    """
    Assign accurate timestamps to each sentence using word-level timestamps.
    word_timestamps format: [{'word': 'The', 'start': 0.0, 'end': 0.2}, ...]
    """
    if not word_timestamps:
        return assign_timestamps_proportionally(sentences, fallback_start_ms, fallback_end_ms)

    result = []
    word_index = 0
    total_words = len(word_timestamps)

    for sentence in sentences:
        if not sentence.strip():
            continue

        # Count words in this sentence (rough match)
        sentence_words = sentence.split()
        num_words = len(sentence_words)

        # Safety check
        if word_index >= total_words:
            # Out of words, use fallback
            if result:
                last_end = result[-1][2]
                result.append((sentence, last_end, fallback_end_ms))
            else:
                result.append((sentence, fallback_start_ms, fallback_end_ms))
            continue

        # Get start time from first word
        start_time = word_timestamps[word_index].get('start', 0)

        # Find end time from last word of sentence
        end_word_index = min(word_index + num_words - 1, total_words - 1)
        end_time = word_timestamps[end_word_index].get('end', start_time)

        result.append((
            sentence,
            int(start_time * 1000),
            int(end_time * 1000)
        ))

        word_index += num_words

    return result


def assign_timestamps_proportionally(sentences: list, start_ms: int, end_ms: int) -> list:
    """Fallback: distribute timestamps proportionally by character count."""
    total_chars = sum(len(s) for s in sentences)
    if total_chars == 0:
        return [(s, start_ms, end_ms) for s in sentences]

    result = []
    current_pos = start_ms
    duration = end_ms - start_ms

    for sentence in sentences:
        if not sentence.strip():
            continue

        sentence_chars = len(sentence)
        proportion = sentence_chars / total_chars
        sentence_duration = int(proportion * duration)

        sentence_end = min(current_pos + sentence_duration, end_ms)
        result.append((sentence, current_pos, sentence_end))
        current_pos = sentence_end

    return result
