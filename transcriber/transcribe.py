import os
import sys
import re
import json
import subprocess
import tempfile
import time
import shutil
import threading
import atexit
import signal
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from tqdm import tqdm
from datetime import datetime

# Import WhisperX for direct API usage
import whisperx
import torch
import warnings

# Import pyannote for diarization
try:
    from pyannote.audio import Pipeline as DiarizationPipeline
    DIARIZATION_AVAILABLE = True
except ImportError:
    DIARIZATION_AVAILABLE = False
    print("Warning: pyannote.audio not available. Diarization will be disabled.")

# Import punctuation model for sentence splitting
try:
    from deepmultilingualpunctuation import PunctuationModel
    PUNCTUATION_AVAILABLE = True
except ImportError:
    PUNCTUATION_AVAILABLE = False
    print("Warning: deepmultilingualpunctuation not available. Long sentence splitting will be disabled.")

# Suppress specific warnings that aren't critical
warnings.filterwarnings('ignore', message='Model was trained with')
warnings.filterwarnings('ignore', message='Some weights of the model checkpoint')
warnings.filterwarnings('ignore', category=UserWarning)

# Import NLP tools for proper noun correction
try:
    import spacy
    from metaphone import doublemetaphone
    from rapidfuzz import fuzz
    PROPER_NOUN_CORRECTION_AVAILABLE = True
    nlp = None  # Lazy load
except ImportError:
    PROPER_NOUN_CORRECTION_AVAILABLE = False
    print("Warning: spacy/metaphone/rapidfuzz not available. Proper noun correction will be disabled.")

# Import Ollama for LLM review of uncertain corrections
try:
    import ollama
    OLLAMA_AVAILABLE = True
    OLLAMA_MODEL = "llama3.2:3b"  # Using llama3.2:3b for fast LLM review
except ImportError:
    OLLAMA_AVAILABLE = False
    print("Warning: ollama not available. LLM review for uncertain corrections will be disabled.")
    OLLAMA_MODEL = None

# Import helper modules
from models import ModelManager
from utils import (run, run_capture, sanitize_filename, ms_to_label, sec_to_tc,
                  html_escape, strip_t_param, add_t, get_unique_path, is_local_file,
                  extract_info, get_audio_duration, ensure_audio, clip_audio, open_file_picker,
                  parse_time_to_seconds as parse_timecode)
from proper_nouns import (normalize_for_comparison, get_nlp_model, extract_proper_nouns_from_text,
                         extract_capitalized_phrases, compute_ensemble_score, find_best_match_multi_word,
                         check_alias_map, find_proper_noun_corrections, PROPER_NOUN_ALIASES)
from text_processing import (merge_segments, fix_capitalization, fix_false_starts, fix_repetitions_in_sentence,
                             split_on_linking_words, split_long_sentence, assign_timestamps_to_sentences,
                             assign_timestamps_proportionally)
from html_builder import build_html

# -----------------------
# Defaults you can tweak
# -----------------------
WHISPERX_MODEL  = "large-v3"  # try "small" for speed, "large-v3" for max quality (needs more VRAM/RAM)
DEVICE          = "cuda"      # "cuda" or "cpu"
COMPUTE_TYPE    = "float16"   # "float16" on modern GPUs with Tensor cores; "float32" for older GPUs; "int8" can help CPU
BATCH_SIZE      = 16
VAD_METHOD      = "silero"   # leave "silero" (WhisperX uses its own VAD); diarization handled separately
CHUNK_SIZE      = 30
PRINT_PROGRESS  = True

# Diarization knobs (only used if you turn diarization ON at the prompt)
DIA_MAX_SPK     = None       # e.g., 3  (None = let pyannote decide)
DIA_MIN_SPK     = None       # e.g., 1

# Put outputs next to this script/.exe
def _app_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent

OUT_DIR = _app_dir()

# Raw WhisperX files (srt/txt/json) go here
RAW_SUBFOLDER = "whisperx_out"

# --- sentence-merge tuning ---
MERGE_GAP_MS = 2500
SENT_END_RE  = re.compile(r'[.!?…][)"\']?$')  # ., !, ?, … possibly followed by closing quote/parens

# --- capitalization fix ---
# Common words that should NEVER be capitalized mid-sentence
NEVER_CAPITALIZE = {
    "and", "or", "but", "the", "a", "an",
    "they", "them", "their", "he", "she", "it",
    "was", "were", "is", "are", "am",
    "have", "has", "had", "do", "does", "did",
    "will", "would", "should", "could", "can",
    "this", "that", "these", "those",
    "what", "where", "when", "why", "how",
}

# -----------------------
# LLM Review
# -----------------------
def review_corrections_with_llm(corrections: list, title: str, description: str, transcript_text: str) -> list:
    """
    Review medium/low confidence corrections with LLM.
    Updates corrections with LLM suggestions and marks them as AI-reviewed.
    """
    if not OLLAMA_AVAILABLE:
        print("  ⚠️ Ollama not available, skipping LLM review")
        return corrections

    # Debug: Check if Ollama is running and list available models
    print(f"\n  🔍 DEBUG: Checking Ollama connection...")
    try:
        available_models = ollama.list()
        print(f"  🔍 DEBUG: Ollama is running. Available models:")
        for model in available_models.get('models', []):
            model_name = model.get('name', 'unknown')
            print(f"      - {model_name}")
        print(f"  🔍 DEBUG: Attempting to use model: {OLLAMA_MODEL}")
    except Exception as e:
        print(f"  ⚠️ DEBUG: Cannot connect to Ollama: {e}")
        print(f"  💡 TIP: Make sure Ollama is running with 'ollama serve'")
        print(f"  💡 TIP: Pull the model with 'ollama pull {OLLAMA_MODEL}'")
        return corrections

    print(f"\n  🤖 Reviewing {sum(1 for c in corrections if c['confidence'] in ['medium', 'low'])} uncertain corrections with {OLLAMA_MODEL}...")

    reviewed_corrections = []
    for idx, correction in enumerate(corrections, 1):
        # Only review medium and low confidence
        if correction['confidence'] not in ['medium', 'low']:
            reviewed_corrections.append(correction)
            continue

        # Build context for LLM
        context_snippets = '\n'.join(f"  - {ctx}" for ctx in correction['contexts'][:2])

        prompt = f"""You are a transcript proofreader. Answer with ONLY one word or phrase - no explanations.

VIDEO: "{title}"
DESCRIPTION: {description[:300]}...

FOUND IN TRANSCRIPT: "{correction['original']}" ({correction['occurrences']} times)
EXAMPLES:
{context_snippets}

PROPOSED CORRECTION: "{correction['original']}" → "{correction['suggested']}"

Does the suggested correction match names/entities in title/description and make sense in context?

RESPOND WITH ONLY ONE OF THESE (nothing else):
YES
NO
SUGGEST: [your alternative]

Examples of correct responses:
- YES
- NO
- SUGGEST: Javice
- SUGGEST: JPMorgan

Your response (one word/phrase only):"""

        try:
            print(f"    [{idx}] Reviewing: {correction['original']} → {correction['suggested']} ({correction['confidence']})")

            response = ollama.chat(
                model=OLLAMA_MODEL,
                messages=[{'role': 'user', 'content': prompt}],
                options={'temperature': 0.0}  # Zero temperature for maximum consistency
            )

            answer = response['message']['content'].strip().upper()

            # Parse verbose responses: extract intent if LLM didn't follow format
            if not answer.startswith(('YES', 'NO', 'SUGGEST:')):
                # Try to extract intent from verbose response
                answer_lower = answer.lower()

                # Check if it's suggesting the original is correct
                if any(phrase in answer_lower for phrase in ['is correct', 'keep', 'no correction', 'already correct']):
                    answer = 'NO'
                # Check if it's suggesting an alternative (look for quoted text)
                elif '"' in answer:
                    # Extract text between quotes
                    import re
                    quoted = re.findall(r'"([^"]+)"', answer)
                    if quoted and quoted[0].lower() != correction['original'].lower():
                        answer = f"SUGGEST: {quoted[0]}"
                    else:
                        answer = 'NO'
                # Check if it's approving
                elif any(phrase in answer_lower for phrase in ['yes', 'correct', 'accurate', 'apply']):
                    answer = 'YES'
                else:
                    # Default to NO if we can't parse it
                    print(f"        ⚠️ Could not parse LLM response: {answer[:50]}...")
                    answer = 'NO'

            if answer.startswith('YES'):
                # LLM approves, upgrade confidence and mark as AI-reviewed
                correction['confidence'] = 'medium' if correction['confidence'] == 'low' else 'high'
                correction['llm_reviewed'] = True
                correction['llm_decision'] = 'approved'
                correction['llm_model'] = OLLAMA_MODEL
                print(f"        ✓ Approved by LLM")
                reviewed_corrections.append(correction)

            elif answer.startswith('SUGGEST:'):
                # LLM suggests alternative
                suggested = answer.split(':', 1)[1].strip()
                correction['suggested'] = suggested
                correction['confidence'] = 'medium'
                correction['llm_reviewed'] = True
                correction['llm_decision'] = 'alternative'
                correction['llm_model'] = OLLAMA_MODEL
                print(f"        → LLM suggests: {suggested}")
                reviewed_corrections.append(correction)

            else:  # NO or unclear
                # LLM rejects, mark but keep for user review
                correction['llm_reviewed'] = True
                correction['llm_decision'] = 'rejected'
                correction['llm_model'] = OLLAMA_MODEL
                print(f"        ✗ Rejected by LLM (keeping for user review)")
                reviewed_corrections.append(correction)

        except Exception as e:
            print(f"        ⚠️ LLM review failed: {e}")
            print(f"        🔍 DEBUG: Error type: {type(e).__name__}")
            print(f"        🔍 DEBUG: Model requested: {OLLAMA_MODEL}")

            # Check if it's a 404 error (model not found)
            if "404" in str(e) or "not found" in str(e).lower():
                print(f"        💡 TIP: Model '{OLLAMA_MODEL}' not found. Try:")
                print(f"           ollama pull {OLLAMA_MODEL}")
                print(f"        💡 Or check available models with: ollama list")

            # Keep original correction if LLM fails
            reviewed_corrections.append(correction)

    return reviewed_corrections

def split_on_linking_words(text: str, start_ms: int, end_ms: int, word_timestamps: list) -> list:
    """
    Problem 3: Split long text on linking words closest to the middle.

    Finds linking words (and, but, so, because, etc) and splits at the one
    closest to the middle of the sentence.

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
    # Threshold: > 300 chars AND > 2 sentences
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

        # Problem 1: Replace hyphens with commas (deepmultilingualpunctuation adds unwanted hyphens)
        # Replace "word- " with "word, "
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
    # Assign timestamps using word-level data
    result = assign_timestamps_to_sentences(sentences, word_timestamps, start_ms, end_ms)

    # Problem 2: Second pass - check if any resulting sentence is still > 300 chars
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
        # Fallback to proportional distribution
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
    """
    Fallback: distribute timestamps proportionally by character count.
    """
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

def save_performance_report(filename: str, duration_seconds: float, segments_count: int,
                           audio_duration: int, has_diarization: bool, rawdir: Path):
    """Save a performance report to the whisperx_out folder."""
    report_path = rawdir / f"{sanitize_filename(filename)}_performance.txt"
    report_path = get_unique_path(report_path)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Calculate speed ratio
    if audio_duration and audio_duration > 0:
        speed_ratio = duration_seconds / audio_duration
        speed_desc = f"{speed_ratio:.2f}x realtime"
    else:
        speed_desc = "N/A"

    report = f"""TRANSCRIPTION PERFORMANCE REPORT
{'='*60}
File: {filename}
Generated: {timestamp}

PROCESSING METRICS
{'='*60}
Processing time: {duration_seconds:.2f}s ({duration_seconds/60:.2f} min)
Audio duration: {audio_duration}s ({audio_duration/60:.2f} min)
Processing speed: {speed_desc}
Segments generated: {segments_count}
Diarization: {'Enabled' if has_diarization else 'Disabled'}

CONFIGURATION
{'='*60}
Model: {WHISPERX_MODEL}
Device: {DEVICE}
Compute type: {COMPUTE_TYPE}
Batch size: {BATCH_SIZE}
{'='*60}

Note: Processing time measured from end of user prompts to final output.
Model loading time not included in these metrics.
"""

    report_path.write_text(report, encoding='utf-8')
    print(f"📊 Performance report saved: {report_path.name}")

# -----------------------
# Main transcription function
# -----------------------
def transcribe_file(model_manager, user_input, lang_flag_list, clip_times, enable_diarization,
                   hf_token, rawdir, mode):
    """
    Perform a single transcription using loaded models.
    Returns timing and metadata for reporting.
    """
    # Mark the start of processing (after prompts)
    processing_start = time.time()

    # Check if local file or URL
    is_local = is_local_file(user_input)

    if is_local:
        print(f"Detected local file: {user_input}")
        title = Path(user_input).stem
        local_audio_path = str(Path(user_input).resolve())
        duration = get_audio_duration(local_audio_path)
        url = None  # No URL for local files
        description = ""  # No description for local files
    else:
        print(f"Detected YouTube URL: {user_input}")
        url = user_input
        local_audio_path = None
        with tqdm(total=1, desc="Fetching metadata", ncols=100, file=sys.__stdout__):
            title, duration, description = extract_info(url)

    hour_mode = bool(duration and duration >= 3600)

    # Workdir
    work = tempfile.mkdtemp(prefix="yt2html_")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rawdir.mkdir(parents=True, exist_ok=True)

    # Download/prepare and prepare targets
    targets = []
    total_processed_length = 0
    if mode == "2":
        # Get audio once (download if URL, use directly if local), then clip it
        if is_local:
            audio = local_audio_path
        else:
            with tqdm(total=1, desc="Downloading audio", ncols=100, file=sys.__stdout__):
                audio = ensure_audio(url, work)

        for idx, (s_s, e_s) in enumerate(clip_times, 1):
            clip_dur = e_s - s_s
            total_processed_length += clip_dur
            out_clip = str(Path(work) / f"clip_{idx}.m4a")
            with tqdm(total=1, desc=f"Cutting {sec_to_tc(s_s)}-{sec_to_tc(e_s)}", ncols=100, file=sys.__stdout__):
                clip_audio(audio, s_s, e_s, out_clip)
            targets.append((out_clip, s_s, clip_dur))
    else:
        # Use full audio
        if is_local:
            audio = local_audio_path
        else:
            with tqdm(total=1, desc="Downloading audio", ncols=100, file=sys.__stdout__):
                audio = ensure_audio(url, work)
        total_processed_length = duration if duration else 0
        targets = [(audio, 0, total_processed_length)]

    # Transcribe each target with WhisperX API
    all_rows = []
    safe_title = sanitize_filename(title)

    for idx, (afile, clip_start_s, clip_dur) in enumerate(targets, 1):
        base = Path(afile).stem

        print(f"\n{'='*60}")
        print(f"TRANSCRIBING [{idx}/{len(targets)}]")
        print(f"{'='*60}")

        # Load audio
        with tqdm(total=100, desc="Loading audio", ncols=100, file=sys.__stdout__) as pbar:
            audio_data = whisperx.load_audio(afile)
            pbar.update(100)

        # Transcribe with WhisperX
        # Use threading to show animated progress during transcription
        transcription_complete = threading.Event()
        transcription_progress = [0]

        def animate_transcription(pbar):
            """Animate progress bar while transcription runs."""
            while not transcription_complete.is_set():
                if transcription_progress[0] < 95:
                    transcription_progress[0] += 1
                    pbar.update(1)
                time.sleep(0.4)  # Update every 400ms

        with tqdm(total=100, desc="Transcribing (Whisper)", ncols=100,
                 bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]',
                 file=sys.__stdout__) as pbar:
            pbar.set_postfix_str("Processing audio...")

            # Start progress animation thread
            anim_thread = threading.Thread(target=animate_transcription, args=(pbar,), daemon=True)
            anim_thread.start()

            # Determine language
            language = None
            if lang_flag_list and "--language" in lang_flag_list:
                lang_idx = lang_flag_list.index("--language")
                if lang_idx + 1 < len(lang_flag_list):
                    language = lang_flag_list[lang_idx + 1]

            result = model_manager.transcribe_model.transcribe(
                audio_data,
                batch_size=BATCH_SIZE,
                language=language,
                print_progress=False  # We handle progress ourselves
            )

            # Signal completion
            transcription_complete.set()
            pbar.update(100 - transcription_progress[0])
            pbar.set_postfix_str("Complete")

        detected_language = result.get("language", language or "en")
        print(f"✓ Transcription complete (Language: {detected_language})")

        # Align timestamps
        align_model, metadata = model_manager.get_align_model(detected_language)

        # Use threading to show animated progress during alignment
        alignment_complete = threading.Event()
        alignment_progress = [0]

        def animate_alignment(pbar):
            """Animate progress bar while alignment runs."""
            while not alignment_complete.is_set():
                if alignment_progress[0] < 95:
                    alignment_progress[0] += 1
                    pbar.update(1)
                time.sleep(0.3)

        with tqdm(total=100, desc="Aligning timestamps", ncols=100,
                 bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]',
                 file=sys.__stdout__) as pbar:
            pbar.set_postfix_str("Syncing timestamps with words...")

            # Start progress animation thread
            anim_thread = threading.Thread(target=animate_alignment, args=(pbar,), daemon=True)
            anim_thread.start()

            result = whisperx.align(
                result["segments"],
                align_model,
                metadata,
                audio_data,
                model_manager.device,
                return_char_alignments=False
            )

            # Signal completion
            alignment_complete.set()
            pbar.update(100 - alignment_progress[0])
            pbar.set_postfix_str("Complete")

        print(f"✓ Timestamp alignment complete")

        # Diarization (optional)
        if enable_diarization:
            print("\n" + "="*60)
            print("SPEAKER DIARIZATION")
            print("="*60)

            # Step 1: Get model and run diarization
            diarize_model = model_manager.get_diarize_model(hf_token)

            # Convert audio to WAV format for pyannote (it doesn't like m4a)
            import soundfile as sf
            wav_temp = None
            try:
                # Check if file is already WAV
                if not afile.lower().endswith('.wav'):
                    with tqdm(total=100, desc="Preparing audio for diarization", ncols=100,
                             file=sys.__stdout__) as pbar:
                        # Create temporary WAV file
                        wav_temp = str(Path(tempfile.gettempdir()) / f"diarize_temp_{time.time()}.wav")
                        # Save audio_data as WAV
                        sf.write(wav_temp, audio_data, 16000)  # WhisperX uses 16kHz
                        pbar.update(100)
                    audio_file_for_diarization = wav_temp
                else:
                    audio_file_for_diarization = afile

                # Use threading to show animated progress during diarization
                diarization_complete = threading.Event()
                diarization_progress = [0]

                def animate_diarization(pbar):
                    """Animate progress bar while diarization runs."""
                    while not diarization_complete.is_set():
                        if diarization_progress[0] < 95:
                            diarization_progress[0] += 1
                            pbar.update(1)
                        time.sleep(0.5)  # Update every 500ms (diarization is slow)

                with tqdm(total=100, desc="Step 1/2: Identifying speakers", ncols=100,
                         bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]',
                         file=sys.__stdout__) as pbar:
                    pbar.set_postfix_str("Analyzing audio patterns...")

                    # Start progress animation thread
                    anim_thread = threading.Thread(target=animate_diarization, args=(pbar,), daemon=True)
                    anim_thread.start()

                    # Run diarization (this is the slow part)
                    diarization_params = {}
                    if DIA_MIN_SPK is not None:
                        diarization_params['min_speakers'] = DIA_MIN_SPK
                    if DIA_MAX_SPK is not None:
                        diarization_params['max_speakers'] = DIA_MAX_SPK

                    diarize_segments = diarize_model(audio_file_for_diarization, **diarization_params)

                    # Signal completion
                    diarization_complete.set()
                    pbar.update(100 - diarization_progress[0])
                    pbar.set_postfix_str("Complete")

            finally:
                # Clean up temporary WAV file
                if wav_temp and Path(wav_temp).exists():
                    try:
                        Path(wav_temp).unlink()
                    except Exception:
                        pass

            with tqdm(total=100, desc="Step 2/2: Assigning speaker labels", ncols=100,
                     file=sys.__stdout__) as pbar:
                # Manually assign speakers from diarization output
                # Convert pyannote diarization to list of speaker segments
                speaker_segments = []
                for turn, _, speaker in diarize_segments.itertracks(yield_label=True):
                    speaker_segments.append({
                        'start': turn.start,
                        'end': turn.end,
                        'speaker': speaker
                    })

                pbar.update(30)

                # Assign speakers to transcript segments based on overlap
                for segment in result.get("segments", []):
                    seg_start = segment.get("start", 0)
                    seg_end = segment.get("end", 0)
                    seg_mid = (seg_start + seg_end) / 2

                    # Find which speaker is talking at the midpoint of this segment
                    best_speaker = None
                    for spk_seg in speaker_segments:
                        if spk_seg['start'] <= seg_mid <= spk_seg['end']:
                            best_speaker = spk_seg['speaker']
                            break

                    if best_speaker:
                        segment['speaker'] = best_speaker

                pbar.update(70)

            # Count unique speakers
            speakers = set()
            for seg in result.get("segments", []):
                if "speaker" in seg:
                    speakers.add(seg["speaker"])

            print(f"✓ Diarization complete - {len(speakers)} speaker(s) identified")
            print("="*60)

        # Convert result to rows format (now with word timestamps)
        rows_for_clip = []
        segments = result.get("segments", [])
        for seg in segments:
            start_ms = int(float(seg.get("start", 0)) * 1000)
            end_ms = int(float(seg.get("end", 0)) * 1000)
            text = (seg.get("text") or "").strip()
            speaker = seg.get("speaker")
            words = seg.get("words", [])  # Word-level timestamps for sentence splitting

            vid_rel_s = (start_ms // 1000) + clip_start_s
            rows_for_clip.append((
                start_ms + clip_start_s*1000,
                end_ms + clip_start_s*1000,
                text,
                vid_rel_s,
                speaker,
                words  # Add word timestamps
            ))

        all_rows.extend(rows_for_clip)

        # Save raw JSON output
        json_output = rawdir / (f"{safe_title}_clip{idx}.json" if len(targets) > 1 else f"{safe_title}.json")
        json_output = get_unique_path(json_output)
        with open(json_output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

    # Merge sentence fragments
    print("\n" + "="*60)
    print("FINALIZING OUTPUT")
    print("="*60)

    with tqdm(total=100, desc="Merging segments", ncols=100, file=sys.__stdout__) as pbar:
        merged_rows = merge_segments(all_rows, MERGE_GAP_MS)
        pbar.update(50)

        # Fix capitalization and split long sentences
        fixed_rows = []
        for row in merged_rows:
            # Unpack with word timestamps
            if len(row) == 6:
                start_ms, end_ms, text, vrel, speaker, words = row
            else:
                start_ms, end_ms, text, vrel, speaker = row
                words = []

            # Fix Problem 1: Ensure text starts with capital letter (100% guaranteed)
            if text:
                text = text.lstrip()  # Remove leading whitespace first
                if text and text[0].islower():
                    text = text[0].upper() + text[1:]

            # Fix Problem 2: Fix mid-sentence capitalization using blacklist
            text = fix_capitalization(text)

            # Fix false starts: replace repeated utterances with em dashes
            text = fix_false_starts(text)

            # Split long sentences (> 300 chars AND > 2 sentences)
            split_entries = split_long_sentence(text, start_ms, end_ms, words, model_manager)

            # Add each split entry
            for sub_text, sub_start_ms, sub_end_ms in split_entries:
                sub_vrel = sub_start_ms // 1000
                fixed_rows.append((sub_start_ms, sub_end_ms, sub_text, sub_vrel, speaker))

        merged_rows = fixed_rows
        pbar.update(50)

    # If no duration, infer hour_mode from merged rows
    if duration is None and merged_rows:
        hour_mode = (max(r[1] for r in merged_rows) >= 3600_000)

    # Build HTML
    html_out = OUT_DIR / f"{sanitize_filename(title)}.html"
    html_out = get_unique_path(html_out)

    # Copy audio file for local files
    audio_file_name = None
    if is_local and local_audio_path:
        audio_ext = Path(local_audio_path).suffix
        audio_file_name = f"{sanitize_filename(title)}_audio{audio_ext}"
        audio_dest = OUT_DIR / audio_file_name
        audio_dest = get_unique_path(audio_dest)
        with tqdm(total=1, desc="Copying audio file", ncols=100, file=sys.__stdout__):
            shutil.copy2(local_audio_path, audio_dest)
        audio_file_name = audio_dest.name  # Use just the filename for relative path

    # Find proper noun corrections
    corrections = None
    print(f"\n🔍 DEBUG: PROPER_NOUN_CORRECTION_AVAILABLE = {PROPER_NOUN_CORRECTION_AVAILABLE}")
    if PROPER_NOUN_CORRECTION_AVAILABLE:
        # Gather all transcript text
        transcript_text = ' '.join(text for _, _, text, _, _ in merged_rows)
        print(f"🔍 DEBUG: Transcript length = {len(transcript_text)} chars")
        print(f"🔍 DEBUG: Title = '{title}'")
        print(f"🔍 DEBUG: Description = '{description[:100] if description else '(empty)'}...'")

        # Find corrections using title and description (or empty strings for local files)
        print("🔍 DEBUG: Calling find_proper_noun_corrections...")
        corrections = find_proper_noun_corrections(transcript_text, title, description or "", rows=merged_rows)
        print(f"🔍 DEBUG: Corrections returned = {corrections}")

        if corrections:
            print(f"✓ Found {len(corrections)} proper noun corrections")

            # Review medium/low confidence corrections with LLM
            corrections = review_corrections_with_llm(corrections, title, description or "", transcript_text)
        else:
            print("⚠️ No proper noun corrections found")
    else:
        print("⚠️ Proper noun correction disabled (missing dependencies: spacy/metaphone/rapidfuzz)")

    with tqdm(total=100, desc="Building HTML", ncols=100, file=sys.__stdout__) as pbar:
        video_url_param = strip_t_param(url) if url else None
        html_text = build_html(merged_rows, video_url_param, f"{title}", hour_mode, audio_file=audio_file_name, corrections=corrections, description=description)
        html_out.write_text(html_text, encoding="utf-8")
        pbar.update(100)

    print(f"\n✅ Wrote: {html_out}")

    # Calculate processing time
    processing_end = time.time()
    processing_duration = processing_end - processing_start

    # Save performance report
    save_performance_report(
        filename=title,
        duration_seconds=processing_duration,
        segments_count=len(merged_rows),
        audio_duration=total_processed_length,
        has_diarization=enable_diarization,
        rawdir=rawdir
    )

    # Display performance summary
    print("\n" + "="*60)
    print("PERFORMANCE SUMMARY")
    print("="*60)
    print(f"Processing time: {processing_duration:.1f}s ({processing_duration/60:.1f} min)")
    if total_processed_length > 0:
        ratio = processing_duration / total_processed_length
        print(f"Audio duration: {total_processed_length}s ({total_processed_length/60:.1f} min)")
        print(f"Speed: {ratio:.2f}x realtime")
    print(f"Segments: {len(merged_rows)}")
    print("="*60 + "\n")

    try:
        os.startfile(str(html_out))
    except Exception:
        pass

    # Clean up temp directory
    try:
        shutil.rmtree(work)
    except Exception:
        pass

# -----------------------
# Main
# -----------------------
def main():
    # Load HF_TOKEN from .env (if present)
    env_file = OUT_DIR / ".env"
    if env_file.exists():
        try:
            for line in env_file.read_text(encoding='utf-8').splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if key == 'HF_TOKEN' and value:
                        os.environ['HF_TOKEN'] = value
        except Exception as e:
            print(f"[Warning: Could not read .env file: {e}]")
    HF_TOKEN = os.environ.get("HF_TOKEN", "").strip()

    # Initialize model manager and load models
    model_manager = ModelManager()

    # Register cleanup handlers for when window closes
    def cleanup_handler():
        """Cleanup function to unload models when program exits."""
        print("\nCleaning up... Unloading models from memory...")
        model_manager.unload_models()
        print("Resources freed. Goodbye!")

    # Register for normal exit
    atexit.register(cleanup_handler)

    # Register for Ctrl+C
    def signal_handler(sig, frame):  # noqa: ARG001
        """Handle interrupt signals."""
        print("\n\nInterrupted by user.")
        sys.exit(0)  # This will trigger atexit

    signal.signal(signal.SIGINT, signal_handler)

    # Load models with timing
    model_manager.load_transcribe_model()

    # Main loop for multiple transcriptions
    rawdir = OUT_DIR / RAW_SUBFOLDER

    while True:
        print("\n" + "="*60)
        print("READY FOR NEW TRANSCRIPTION")
        print("="*60)
        print("Paste YouTube URL or local audio file path (or enter 0 to open file picker)")
        print("Or press Enter to exit")
        user_input = input("> ").strip()

        # Check for exit
        if not user_input:
            print("\nExiting...")
            break

        # Check if user wants to use file picker
        if user_input == "0":
            print("Opening file picker...")
            user_input = open_file_picker()
            if not user_input:
                print("No file selected.")
                continue
            print(f"Selected: {user_input}")

        # Language
        print("\nLanguage? [Enter=English (en), 0=Auto, or type code like 'pt'/'pt-BR'/'en']")
        lang_in = input("Language: ").strip()
        lang_flag = []
        if not lang_in:
            lang_flag = ["--language", "en"]
        elif lang_in == "0":
            lang_flag = []
        else:
            lang_flag = ["--language", lang_in]

        # Scope
        print("\nScope? 1) Whole audio  2) One or more clips")
        mode = input("Choose [1/2]: ").strip() or "1"

        # If clips mode, collect clip times BEFORE downloading
        clip_times = []
        if mode == "2":
            print("\nEnter clips (empty start to finish):")
            while True:
                ss = input("  Start (mm:ss or hh:mm:ss), blank to stop: ").strip()
                if not ss:
                    break
                ee = input("  End   (mm:ss or hh:mm:ss): ").strip()
                if not ee:
                    print("  End is required.")
                    continue
                try:
                    s_s = parse_timecode(ss)
                    e_s = parse_timecode(ee)
                    if e_s <= s_s:
                        print("  End must be > Start.")
                        continue
                except Exception as e:
                    print("  Bad time:", e)
                    continue
                clip_times.append((s_s, e_s))
            if not clip_times:
                print("No clips provided; using whole audio.")
                mode = "1"

        # Diarization
        print("\nIdentify speakers with pyannote? [y/n]")
        diarize_in = input("Diarization: ").strip().lower()
        enable_diarization = diarize_in in ["y", "yes"]

        # Perform transcription
        try:
            transcribe_file(
                model_manager=model_manager,
                user_input=user_input,
                lang_flag_list=lang_flag,
                clip_times=clip_times,
                enable_diarization=enable_diarization,
                hf_token=HF_TOKEN,
                rawdir=rawdir,
                mode=mode
            )
        except Exception as e:
            print(f"\n❌ Error during transcription: {e}")
            import traceback
            traceback.print_exc()
            print("\nYou can try another file or exit.")

if __name__ == "__main__":
    main()