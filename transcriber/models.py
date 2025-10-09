#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Model management for WhisperX, diarization, and punctuation models.
"""

import sys
import time
import threading
import whisperx
import torch
from tqdm import tqdm

# Check if diarization is available
try:
    from pyannote.audio import Pipeline as DiarizationPipeline
    DIARIZATION_AVAILABLE = True
except ImportError:
    DIARIZATION_AVAILABLE = False

# Check if punctuation model is available
try:
    from deepmultilingualpunctuation import PunctuationModel
    PUNCTUATION_AVAILABLE = True
except ImportError:
    PUNCTUATION_AVAILABLE = False


class ModelManager:
    """Manages WhisperX models with persistent loading."""

    def __init__(self, device="cuda", compute_type="float16", whisperx_model="large-v3"):
        self.transcribe_model = None
        self.align_models = {}  # Cache by language code
        self.diarize_model = None
        self.punctuation_model = None
        self.device = device
        self.compute_type = compute_type
        self.whisperx_model = whisperx_model

    def load_transcribe_model(self):
        """Load the main transcription model with progress bar."""
        if self.transcribe_model is not None:
            return  # Already loaded

        print("\n" + "="*60)
        print("LOADING MODELS - This happens once per session")
        print("="*60)

        load_start = time.time()
        loading_complete = threading.Event()
        progress_value = [0]

        def animate_progress(pbar):
            """Animate progress bar while model loads."""
            while not loading_complete.is_set():
                if progress_value[0] < 95:
                    progress_value[0] += 1
                    pbar.update(1)
                time.sleep(0.3)

        import contextlib
        import io

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with tqdm(total=100, desc="Loading Whisper model", ncols=100,
                      bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]',
                      file=sys.__stdout__) as pbar:
                pbar.set_postfix_str(f"Model: {self.whisperx_model}, Device: {self.device}")

                anim_thread = threading.Thread(target=animate_progress, args=(pbar,), daemon=True)
                anim_thread.start()

                self.transcribe_model = whisperx.load_model(
                    self.whisperx_model,
                    self.device,
                    compute_type=self.compute_type,
                    language=None,
                    download_root=None
                )

                loading_complete.set()
                pbar.update(100 - progress_value[0])
                pbar.set_postfix_str("Ready")

        load_time = time.time() - load_start
        print(f"✓ Transcription model loaded: {self.whisperx_model} (took {load_time:.1f}s)")

        # Also load punctuation model at startup
        self.load_punctuation_model()

        print("="*60 + "\n")

    def get_align_model(self, language_code):
        """Load or retrieve cached alignment model for a language."""
        if language_code in self.align_models:
            return self.align_models[language_code]

        loading_complete = threading.Event()
        progress_value = [0]

        def animate_progress(pbar):
            """Animate progress bar while model loads."""
            while not loading_complete.is_set():
                if progress_value[0] < 95:
                    progress_value[0] += 1
                    pbar.update(1)
                time.sleep(0.2)

        import contextlib
        import io

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with tqdm(total=100, desc=f"Loading alignment model ({language_code})", ncols=100,
                      bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]',
                      file=sys.__stdout__) as pbar:

                anim_thread = threading.Thread(target=animate_progress, args=(pbar,), daemon=True)
                anim_thread.start()

                model_a, metadata = whisperx.load_align_model(
                    language_code=language_code,
                    device=self.device
                )

                loading_complete.set()
                pbar.update(100 - progress_value[0])

        self.align_models[language_code] = (model_a, metadata)
        return model_a, metadata

    def get_diarize_model(self, hf_token):
        """Load or retrieve cached diarization model."""
        if self.diarize_model is not None:
            return self.diarize_model

        if not DIARIZATION_AVAILABLE:
            raise RuntimeError("Diarization not available. Please install pyannote.audio")

        loading_complete = threading.Event()
        progress_value = [0]

        def animate_progress(pbar):
            """Animate progress bar while model loads."""
            while not loading_complete.is_set():
                if progress_value[0] < 95:
                    progress_value[0] += 1
                    pbar.update(1)
                time.sleep(0.3)

        import contextlib
        import io

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with tqdm(total=100, desc="Loading diarization model", ncols=100,
                      bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]',
                      file=sys.__stdout__) as pbar:
                pbar.set_postfix_str("Initializing pyannote...")

                anim_thread = threading.Thread(target=animate_progress, args=(pbar,), daemon=True)
                anim_thread.start()

                self.diarize_model = DiarizationPipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=hf_token
                )
                self.diarize_model.to(torch.device(self.device))

                loading_complete.set()
                pbar.update(100 - progress_value[0])
                pbar.set_postfix_str("Ready")

        print("✓ Diarization model loaded")
        return self.diarize_model

    def load_punctuation_model(self):
        """Load the punctuation restoration model with progress bar."""
        if self.punctuation_model is not None:
            return self.punctuation_model

        if not PUNCTUATION_AVAILABLE:
            print("⚠ Punctuation model not available. Long sentence splitting will use basic detection.")
            return None

        loading_complete = threading.Event()
        progress_value = [0]

        def animate_progress(pbar):
            """Animate progress bar while model loads."""
            while not loading_complete.is_set():
                if progress_value[0] < 95:
                    progress_value[0] += 1
                    pbar.update(1)
                time.sleep(0.3)

        import contextlib
        import io

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with tqdm(total=100, desc="Loading punctuation model", ncols=100,
                      bar_format='{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}]',
                      file=sys.__stdout__) as pbar:
                pbar.set_postfix_str("Downloading (~500MB, first time only)...")

                anim_thread = threading.Thread(target=animate_progress, args=(pbar,), daemon=True)
                anim_thread.start()

                self.punctuation_model = PunctuationModel()

                loading_complete.set()
                pbar.update(100 - progress_value[0])
                pbar.set_postfix_str("Ready")

        print("✓ Punctuation model loaded")
        return self.punctuation_model

    def unload_models(self):
        """Unload models to free memory."""
        self.transcribe_model = None
        self.align_models = {}
        self.diarize_model = None
        self.punctuation_model = None
        if self.device == "cuda":
            torch.cuda.empty_cache()
