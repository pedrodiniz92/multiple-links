"""
Gradio-optimized transcription wrapper.
Provides clean progress updates without tqdm complexity.
"""
import os
import sys
import time
import tempfile
import shutil
from pathlib import Path
from datetime import datetime

import whisperx
import torch

from models import ModelManager
from utils import (
    sanitize_filename, is_local_file, extract_info, get_audio_duration,
    ensure_audio, clip_audio, strip_t_param, get_unique_path, sec_to_tc
)
from text_processing import merge_segments, fix_capitalization, fix_false_starts
from proper_nouns import find_proper_noun_corrections
from html_builder import build_html
from transcribe import (
    OUT_DIR, RAW_SUBFOLDER, MERGE_GAP_MS, split_long_sentence,
    review_corrections_with_llm, PROPER_NOUN_CORRECTION_AVAILABLE
)

def transcribe_with_progress(
    model_manager: ModelManager,
    user_input: str,
    lang_flag_list: list,
    clip_times: list,
    enable_diarization: bool,
    hf_token: str,
    rawdir: Path,
    mode: str,
    progress_callback=None
):
    """
    Transcribe with progress callbacks for Gradio.

    progress_callback(progress_float, status_message) where progress_float is 0.0-1.0
    """
    def report_progress(progress: float, message: str):
        """Helper to report progress."""
        if progress_callback:
            progress_callback(progress, message)

    processing_start = time.time()
    report_progress(0.0, "🚀 Starting transcription...")

    # Check if local file or URL
    is_local = is_local_file(user_input)

    report_progress(0.05, "📋 Fetching metadata...")

    if is_local:
        title = Path(user_input).stem
        local_audio_path = str(Path(user_input).resolve())
        duration = get_audio_duration(local_audio_path)
        url = None
        description = ""
    else:
        url = user_input
        local_audio_path = None
        title, duration, description = extract_info(url)

    hour_mode = bool(duration and duration >= 3600)

    # Workdir
    work = tempfile.mkdtemp(prefix="yt2html_")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rawdir.mkdir(parents=True, exist_ok=True)

    report_progress(0.1, "🎵 Preparing audio...")

    # Download/prepare targets
    targets = []
    total_processed_length = 0

    if mode == "2":
        # Clips mode
        if is_local:
            audio = local_audio_path
        else:
            audio = ensure_audio(url, work)

        for idx, (s_s, e_s) in enumerate(clip_times, 1):
            clip_dur = e_s - s_s
            total_processed_length += clip_dur
            out_clip = str(Path(work) / f"clip_{idx}.m4a")
            clip_audio(audio, s_s, e_s, out_clip)
            targets.append((out_clip, s_s, clip_dur))
            report_progress(0.1 + (0.1 * idx / len(clip_times)), f"✂️ Cutting clip {idx}/{len(clip_times)}")
    else:
        # Whole audio
        if is_local:
            audio = local_audio_path
        else:
            audio = ensure_audio(url, work)
        total_processed_length = duration if duration else 0
        targets = [(audio, 0, total_processed_length)]

    report_progress(0.2, "🎤 Loading audio into memory...")

    # Transcribe each target
    all_rows = []
    safe_title = sanitize_filename(title)

    for idx, (afile, clip_start_s, clip_dur) in enumerate(targets, 1):
        base_progress = 0.2 + (0.5 * (idx - 1) / len(targets))
        clip_progress_span = 0.5 / len(targets)

        report_progress(base_progress, f"📝 Transcribing [{idx}/{len(targets)}]...")

        # Load audio
        audio_data = whisperx.load_audio(afile)

        report_progress(base_progress + clip_progress_span * 0.2, "🧠 Running Whisper model...")

        # Determine language
        language = None
        if lang_flag_list and "--language" in lang_flag_list:
            lang_idx = lang_flag_list.index("--language")
            if lang_idx + 1 < len(lang_flag_list):
                language = lang_flag_list[lang_idx + 1]

        # Transcribe
        result = model_manager.transcribe_model.transcribe(
            audio_data,
            batch_size=model_manager.batch_size,
            language=language,
            print_progress=False
        )

        detected_language = result.get("language", language or "en")

        report_progress(base_progress + clip_progress_span * 0.5, f"⏱️ Aligning timestamps... (detected: {detected_language})")

        # Align timestamps
        align_model, metadata = model_manager.get_align_model(detected_language)

        result = whisperx.align(
            result["segments"],
            align_model,
            metadata,
            audio_data,
            model_manager.device,
            return_char_alignments=False
        )

        # Diarization (optional)
        if enable_diarization:
            report_progress(base_progress + clip_progress_span * 0.7, "👥 Identifying speakers...")

            diarize_model = model_manager.get_diarize_model(hf_token)

            # Convert to WAV if needed
            import soundfile as sf
            wav_temp = None
            try:
                if not afile.lower().endswith('.wav'):
                    wav_temp = str(Path(tempfile.gettempdir()) / f"diarize_temp_{time.time()}.wav")
                    sf.write(wav_temp, audio_data, 16000)
                    audio_file_for_diarization = wav_temp
                else:
                    audio_file_for_diarization = afile

                # Run diarization
                from transcribe import DIA_MIN_SPK, DIA_MAX_SPK
                diarization_params = {}
                if DIA_MIN_SPK is not None:
                    diarization_params['min_speakers'] = DIA_MIN_SPK
                if DIA_MAX_SPK is not None:
                    diarization_params['max_speakers'] = DIA_MAX_SPK

                diarize_segments = diarize_model(audio_file_for_diarization, **diarization_params)

                # Convert pyannote diarization to segments
                speaker_segments = []
                for turn, _, speaker in diarize_segments.itertracks(yield_label=True):
                    speaker_segments.append({
                        'start': turn.start,
                        'end': turn.end,
                        'speaker': speaker
                    })

                # Assign speakers to transcript segments
                for segment in result.get("segments", []):
                    seg_start = segment.get("start", 0)
                    seg_end = segment.get("end", 0)
                    seg_mid = (seg_start + seg_end) / 2

                    for spk_seg in speaker_segments:
                        if spk_seg['start'] <= seg_mid <= spk_seg['end']:
                            segment['speaker'] = spk_seg['speaker']
                            break

                speakers = set()
                for seg in result.get("segments", []):
                    if "speaker" in seg:
                        speakers.add(seg["speaker"])

                report_progress(base_progress + clip_progress_span * 0.85, f"✓ Found {len(speakers)} speaker(s)")

            finally:
                if wav_temp and Path(wav_temp).exists():
                    try:
                        Path(wav_temp).unlink()
                    except Exception:
                        pass

        # Convert to rows format
        rows_for_clip = []
        segments = result.get("segments", [])
        for seg in segments:
            start_ms = int(float(seg.get("start", 0)) * 1000)
            end_ms = int(float(seg.get("end", 0)) * 1000)
            text = (seg.get("text") or "").strip()
            speaker = seg.get("speaker")
            words = seg.get("words", [])

            vid_rel_s = (start_ms // 1000) + clip_start_s
            rows_for_clip.append((
                start_ms + clip_start_s*1000,
                end_ms + clip_start_s*1000,
                text,
                vid_rel_s,
                speaker,
                words
            ))

        all_rows.extend(rows_for_clip)

        # Save raw JSON
        import json
        json_output = rawdir / (f"{safe_title}_clip{idx}.json" if len(targets) > 1 else f"{safe_title}.json")
        json_output = get_unique_path(json_output)
        with open(json_output, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        report_progress(base_progress + clip_progress_span, f"✓ Clip {idx}/{len(targets)} complete")

    report_progress(0.7, "🔧 Processing transcript...")

    # Merge segments
    merged_rows = merge_segments(all_rows, MERGE_GAP_MS)

    # Fix capitalization and split long sentences
    fixed_rows = []
    for row in merged_rows:
        if len(row) == 6:
            start_ms, end_ms, text, vrel, speaker, words = row
        else:
            start_ms, end_ms, text, vrel, speaker = row
            words = []

        # Fix capitalization
        if text and text[0].islower():
            text = text[0].upper() + text[1:]

        text = fix_capitalization(text)
        text = fix_false_starts(text)

        # Split long sentences
        split_entries = split_long_sentence(text, start_ms, end_ms, words, model_manager)

        for sub_text, sub_start_ms, sub_end_ms in split_entries:
            sub_vrel = sub_start_ms // 1000
            fixed_rows.append((sub_start_ms, sub_end_ms, sub_text, sub_vrel, speaker))

    merged_rows = fixed_rows

    report_progress(0.8, "🔍 Finding proper noun corrections...")

    # Find proper noun corrections
    corrections = None
    if PROPER_NOUN_CORRECTION_AVAILABLE:
        transcript_text = ' '.join(text for _, _, text, _, _ in merged_rows)
        corrections = find_proper_noun_corrections(transcript_text, title, description or "", rows=merged_rows)

        if corrections:
            report_progress(0.85, f"🤖 Reviewing {len(corrections)} corrections with LLM...")
            corrections = review_corrections_with_llm(corrections, title, description or "", transcript_text)

    report_progress(0.9, "🎨 Building HTML output...")

    # Build HTML
    html_out = OUT_DIR / f"{sanitize_filename(title)}.html"
    html_out = get_unique_path(html_out)

    # Copy audio for local files
    audio_file_name = None
    if is_local and local_audio_path:
        audio_ext = Path(local_audio_path).suffix
        audio_file_name = f"{sanitize_filename(title)}_audio{audio_ext}"
        audio_dest = OUT_DIR / audio_file_name
        audio_dest = get_unique_path(audio_dest)
        shutil.copy2(local_audio_path, audio_dest)
        audio_file_name = audio_dest.name

    video_url_param = strip_t_param(url) if url else None
    html_text = build_html(merged_rows, video_url_param, f"{title}", hour_mode, audio_file=audio_file_name, corrections=corrections, description=description)
    html_out.write_text(html_text, encoding="utf-8")

    report_progress(0.95, "📊 Generating performance report...")

    # Calculate processing time
    processing_end = time.time()
    processing_duration = processing_end - processing_start

    # Save performance report
    from transcribe import save_performance_report
    save_performance_report(
        filename=title,
        duration_seconds=processing_duration,
        segments_count=len(merged_rows),
        audio_duration=total_processed_length,
        has_diarization=enable_diarization,
        rawdir=rawdir
    )

    # Clean up
    try:
        shutil.rmtree(work)
    except Exception:
        pass

    # Try to open the file
    try:
        os.startfile(str(html_out))
    except Exception:
        pass

    report_progress(1.0, "✅ Complete!")

    return {
        'html_path': html_out,
        'segments_count': len(merged_rows),
        'processing_time': processing_duration,
        'audio_duration': total_processed_length,
        'title': title,
    }
