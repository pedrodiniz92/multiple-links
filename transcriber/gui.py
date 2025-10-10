"""
Gradio GUI for WhisperX Transcriber
Provides a modern web interface for transcription with persistent preferences.
"""
import os
import sys
import time
import threading
import gradio as gr
from pathlib import Path
from datetime import datetime

# Import transcription logic
from models import ModelManager
from preferences import PreferencesManager
from transcribe import OUT_DIR, RAW_SUBFOLDER
from transcribe_gradio import transcribe_with_progress
from utils import parse_time_to_seconds as parse_timecode

# Try to import ollama for model detection
try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

# Global model manager (loaded once at startup)
model_manager = None
prefs_manager = PreferencesManager()

# Loading state tracking
model_loading_status = {
    "is_loading": True,
    "is_complete": False,
    "progress": 0,
    "message": "Initializing...",
    "error": None
}

def get_ollama_models():
    """Query Ollama for available models."""
    if not OLLAMA_AVAILABLE:
        return ["llama3.2:3b"]  # Fallback default

    try:
        response = ollama.list()

        # Debug: print the response structure
        print(f"DEBUG: Ollama response type: {type(response)}")

        # Handle different response formats
        models = []

        # Check if it's a ListResponse object (has .models attribute)
        if hasattr(response, 'models'):
            print(f"DEBUG: Found {len(response.models)} model entries")
            for model in response.models:
                # Model objects have a 'name' or 'model' attribute
                name = getattr(model, 'name', None) or getattr(model, 'model', None)
                if name:
                    models.append(name)
        # Fallback: try as dict
        elif isinstance(response, dict):
            model_list = response.get('models', [])
            for model in model_list:
                if isinstance(model, dict):
                    name = model.get('name') or model.get('model') or model.get('id')
                    if name:
                        models.append(name)
                elif isinstance(model, str):
                    models.append(model)

        print(f"DEBUG: Extracted model names: {models}")

        # Filter for common chat models (exclude embedding models)
        chat_models = [m for m in models if not any(x in m.lower() for x in ['embed', 'nomic'])]

        if not chat_models:
            print("WARNING: No Ollama models found. Using fallback.")
            return ["llama3.2:3b"]  # Fallback if no models found

        return sorted(chat_models)
    except Exception as e:
        print(f"WARNING: Could not query Ollama models: {e}")
        print(f"TIP: Make sure Ollama is running with 'ollama serve'")
        print(f"TIP: Check installed models with 'ollama list'")
        return ["llama3.2:3b"]  # Fallback to single default

def load_models_on_startup():
    """Load WhisperX models at GUI startup."""
    global model_manager, model_loading_status

    try:
        model_loading_status["progress"] = 10
        model_loading_status["message"] = "Loading WhisperX models..."

        if model_manager is None:
            model_manager = ModelManager()

        model_loading_status["progress"] = 50
        model_loading_status["message"] = "Loading transcription model..."

        # Load transcription model (alignment models loaded on-demand per language)
        model_manager.load_transcribe_model()

        model_loading_status["progress"] = 100
        model_loading_status["message"] = "Models loaded successfully!"
        model_loading_status["is_loading"] = False
        model_loading_status["is_complete"] = True

    except Exception as e:
        model_loading_status["is_loading"] = False
        model_loading_status["error"] = str(e)
        model_loading_status["message"] = f"Error loading models: {str(e)}"

    return "Models loaded and ready"

def get_loading_status():
    """Get current loading status for UI updates."""
    global model_loading_status

    if model_loading_status["error"]:
        return (
            f"<div style='color: red;'>Error: {model_loading_status['error']}</div>",
            f"<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- Error loading models</span></div>"
        )
    elif model_loading_status["is_complete"]:
        # Show checkmark briefly
        return (
            "<div style='color: green; font-size: 18px;'>Models loaded successfully!</div>",
            "<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- Models ready</span></div>"
        )
    elif model_loading_status["is_loading"]:
        progress = model_loading_status["progress"]
        message = model_loading_status["message"]
        # Create a loading bar
        loading_html = f"""
        <div style='padding: 20px;'>
            <div style='color: #2563eb; font-size: 16px; font-weight: 600; margin-bottom: 10px;'>
                Loading Models...
            </div>
            <div style='color: #666; margin-bottom: 15px;'>{message}</div>
            <div style='background: #e5e7eb; border-radius: 10px; height: 20px; overflow: hidden;'>
                <div style='background: linear-gradient(90deg, #3b82f6, #2563eb); height: 100%; width: {progress}%; transition: width 0.3s ease;'></div>
            </div>
            <div style='color: #888; margin-top: 8px; font-size: 14px;'>{progress}%</div>
        </div>
        """
        return (loading_html, f"<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- Loading... {progress}%</span></div>")
    else:
        return (
            "<div style='color: gray;'>Results will appear here...</div>",
            "<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span></div>"
        )

def transcribe_wrapper(
    input_source,
    uploaded_file,
    whisperx_model,
    ollama_model,
    language,
    scope,
    clip_data,
    diarization,
    progress=gr.Progress()
):
    """
    Wrapper for transcription that works with Gradio.
    Returns HTML output and status message.
    """
    global model_manager

    # Determine input source
    if uploaded_file is not None:
        user_input = uploaded_file.name
    elif input_source.strip():
        user_input = input_source.strip()
    else:
        return "<div style='color: red;'>Error: Please provide a YouTube URL or upload a file</div>", "<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- No input provided</span></div>"

    # Update preferences with current selections (not input source)
    prefs_manager.update({
        "whisperx_model": whisperx_model,
        "ollama_model": ollama_model,
        "language": language,
        "diarization": diarization,
        "scope": scope,
    })

    # Update Ollama model in transcribe.py (it's a global variable there)
    import transcribe
    transcribe.OLLAMA_MODEL = ollama_model
    transcribe.WHISPERX_MODEL = whisperx_model

    # Update ModelManager settings
    model_manager.batch_size = prefs_manager.get("batch_size", 16)

    # Parse language
    lang_flag = []
    if language == "auto":
        lang_flag = []
    elif language:
        lang_flag = ["--language", language]

    # Parse clips if in clips mode
    clip_times = []
    mode = "1"  # Default to whole audio

    if scope == "clips" and clip_data.strip():
        mode = "2"
        # Parse clip data (format: "start1-end1, start2-end2" or one per line)
        lines = clip_data.replace(',', '\n').split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Parse "start-end" format
            if '-' in line:
                parts = line.split('-', 1)
                if len(parts) == 2:
                    try:
                        start = parse_timecode(parts[0].strip())
                        end = parse_timecode(parts[1].strip())
                        if end > start:
                            clip_times.append((start, end))
                    except Exception as e:
                        return f"<div style='color: red;'>Error parsing clip time '{line}': {e}</div>", "<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- Invalid clip format</span></div>"

    if mode == "2" and not clip_times:
        return "<div style='color: red;'>Error: Clips mode selected but no valid clips provided</div>", "<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- No clips provided</span></div>"

    # Load HF_TOKEN from .env (for diarization)
    env_file = OUT_DIR / ".env"
    HF_TOKEN = ""
    if env_file.exists():
        try:
            for line in env_file.read_text(encoding='utf-8').splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    if key.strip() == 'HF_TOKEN':
                        HF_TOKEN = value.strip()
        except Exception:
            pass

    # Set up output directory
    rawdir = OUT_DIR / RAW_SUBFOLDER

    try:
        # Create progress callback for Gradio
        def progress_callback(prog, msg):
            progress(prog, desc=msg)

        # Run transcription with progress tracking
        result = transcribe_with_progress(
            model_manager=model_manager,
            user_input=user_input,
            lang_flag_list=lang_flag,
            clip_times=clip_times,
            enable_diarization=diarization,
            hf_token=HF_TOKEN,
            rawdir=rawdir,
            mode=mode,
            progress_callback=progress_callback
        )

        # Build success HTML
        result_html = "<div style='font-size: 18px; font-weight: bold; margin: 20px 0;'>Transcription complete!</div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Title:</strong> {result['title']}</div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Output:</strong> <code>{result['html_path'].name}</code></div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Location:</strong> <code>{result['html_path']}</code></div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Segments:</strong> {result['segments_count']}</div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Processing Time:</strong> {result['processing_time']:.1f}s</div>"

        if result['audio_duration'] > 0:
            ratio = result['processing_time'] / result['audio_duration']
            result_html += f"<div style='margin: 10px 0;'><strong>Speed:</strong> {ratio:.2f}x realtime</div>"

        return result_html, f"<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- Done in {result['processing_time']:.1f}s</span></div>"

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_html = f"<div style='color: red;'><strong>Error:</strong> {str(e)}</div>"
        error_html += f"<details><summary>Stack Trace</summary><pre style='font-size: 11px;'>{error_trace}</pre></details>"
        return error_html, f"<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- Error: {str(e)}</span></div>"

def save_preferences_ui(device, compute_type, batch_size):
    """Save advanced preferences from settings tab."""
    try:
        prefs_manager.update({
            "device": device,
            "compute_type": compute_type,
            "batch_size": int(batch_size),
        })

        # Update the transcribe.py globals
        import transcribe
        transcribe.DEVICE = device
        transcribe.COMPUTE_TYPE = compute_type
        transcribe.BATCH_SIZE = int(batch_size)

        return "Preferences saved"
    except Exception as e:
        return f" Error saving preferences: {e}"

# Build Gradio interface
def create_interface():
    """Create the Gradio web interface."""

    # Get available Ollama models
    ollama_models = get_ollama_models()

    # Load saved preferences
    prefs = prefs_manager.prefs

    # Ensure saved ollama model is in the list
    if prefs["ollama_model"] not in ollama_models:
        ollama_models.insert(0, prefs["ollama_model"])

    with gr.Blocks(
        title="Pedro's Transcriber",
        theme=gr.themes.Soft(primary_hue="blue", secondary_hue="blue"),
        css="""
        * {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        }
        .output-box {max-height: calc(100vh - 250px); overflow-y: auto;}
        .status-text {font-size: 16px; font-weight: bold; margin: 10px 0;}
        h3 {
            font-size: 22px !important;
        }
        .custom-title-container {
            margin-top: 10px;
            margin-bottom: 20px;
            margin-left: -10px;
        }
        .custom-title {
            display: inline;
            font-size: 22px;
            font-weight: 600;
        }
        .custom-subtitle {
            display: inline;
            font-size: 18px;
            font-weight: 400;
            color: #666;
            margin-left: 10px;
        }
        .custom-description {
            margin-top: 8px;
            color: #555;
            font-size: 14px;
        }
        /* Remove blue background from inputs and labels */
        .gradio-container input,
        .gradio-container textarea,
        .gradio-container select {
            background-color: white !important;
        }
        .gr-box {
            background-color: white !important;
        }
        /* Remove blue background from label text only (not toggles/buttons) */
        span.svelte-g2oxp3:not(.has-info) {
            background-color: transparent !important;
            background: none !important;
        }
        /* Keep input/textarea/select backgrounds white */
        .wrap.svelte-1cl284s {
            background-color: white !important;
        }
        /* Enhanced checkbox styling - visible when checked */
        input[type="checkbox"]:checked {
            background-color: #2563eb !important;
            border-color: #2563eb !important;
            background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e") !important;
            background-size: 100% 100% !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
        }
        input[type="checkbox"] {
            width: 18px !important;
            height: 18px !important;
            border: 2px solid #cbd5e1 !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
        }
        input[type="checkbox"]:hover {
            border-color: #2563eb !important;
        }
        /* Make file upload single line */
        .file-preview {
            flex-direction: row !important;
        }
        .file-preview-holder {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
        }
        .upload-text, .file-preview span {
            display: inline !important;
            white-space: nowrap !important;
        }
        /* More aggressive single line for upload button */
        [role="button"] span, .upload-container span {
            display: inline !important;
        }
        .upload-container br, .file-upload br {
            display: none !important;
        }
        /* Target Gradio's file component text specifically */
        .file.svelte-116rqfv br,
        [data-testid="file"] br,
        .file-upload-text br {
            display: none !important;
        }
        /* Fixed bottom navbar for transcribe button */
        #transcribe-bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            background: linear-gradient(to top, rgba(255,255,255,0.98) 85%, rgba(255,255,255,0));
            backdrop-filter: blur(10px);
            padding: 20px 0 25px 0;
            border-top: 1px solid rgba(0,0,0,0.06);
            box-shadow: 0 -4px 12px rgba(0,0,0,0.08);
        }
        #transcribe-bottom-bar button {
            width: 70%;
            max-width: 280px;
            margin: 0 auto;
            display: block;
            padding: 12px 20px !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            border-radius: 8px !important;
        }
        /* Add padding to content so it doesn't get hidden behind fixed bar */
        #transcribe-tab-content {
            padding-bottom: 100px;
        }
        /* Kill scroll containers that break sticky */
        .gradio-container,
        .gradio-container .tabs,
        .gradio-container [role="tabpanel"] {
            overflow: visible !important;
        }
        /* Make right column (Output section) sticky */
        #output-column {
            position: sticky !important;
            position: -webkit-sticky !important;
            top: 20px !important;
            align-self: flex-start !important;
            height: fit-content !important;
            max-height: calc(100vh - 140px) !important;
            overflow-y: auto !important;
            z-index: 100 !important;
            background: none !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
        /* Ensure parent row has proper overflow */
        #transcribe-tab-content .grid {
            overflow: visible !important;
        }
        #transcribe-tab-content > div {
            overflow: visible !important;
        }
        """
    ) as app:

        # Add JavaScript to fix file upload text
        gr.HTML("""
        <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Fix file upload text to single line
            function fixUploadText() {
                const uploads = document.querySelectorAll('[data-testid="file"], .file-upload, .upload-container');
                uploads.forEach(upload => {
                    const spans = upload.querySelectorAll('span');
                    spans.forEach(span => {
                        if (span.innerHTML.includes('<br>')) {
                            span.innerHTML = span.innerHTML.replace(/<br\s*\/?>/gi, ' - ');
                        }
                    });
                });
            }

            // Run immediately and after mutations
            fixUploadText();
            const observer = new MutationObserver(fixUploadText);
            observer.observe(document.body, { childList: true, subtree: true });
        });
        </script>
        """)

        with gr.Tabs():
            # Main transcription tab
            with gr.Tab("Transcribe"):
                with gr.Column(elem_id="transcribe-tab-content"):
                    with gr.Row():
                        with gr.Column(scale=1):
                            # Header aligned with content
                            gr.HTML("""
                            <div class="custom-title-container">
                                <div class="custom-title">Pedro's Transcriber</div>
                                <div class="custom-description">Transcribe YouTube videos or local audio files with speaker diarization and proper noun correction. (WhisperX, Pyannote)</div>
                            </div>
                            """)

                            gr.Markdown("### Input")

                            input_source = gr.Textbox(
                                label="YouTube URL or File Path",
                                placeholder="https://youtube.com/watch?v=... or /path/to/audio.mp3",
                                lines=2
                            )

                            uploaded_file = gr.File(
                                label="Or Upload Audio File",
                                file_types=["audio"],
                                type="filepath"
                            )

                            gr.Markdown("### Options")

                            whisperx_model = gr.Dropdown(
                                label="WhisperX Model",
                                choices=["medium", "large-v2", "large-v3"],
                                value=prefs.get("whisperx_model", "large-v3"),
                                info="Larger models = better quality but slower"
                            )

                            ollama_model = gr.Dropdown(
                                label="Ollama Model (for LLM review)",
                                choices=ollama_models,
                                value=prefs.get("ollama_model", ollama_models[0]),
                                info="Used for reviewing uncertain proper noun corrections"
                            )

                            language = gr.Dropdown(
                                label="Language",
                                choices=["auto", "en", "pt", "pt-BR", "es", "fr", "de", "it", "ja", "zh", "ko"],
                                value=prefs.get("language", "en"),
                                info="Audio language (auto = detect automatically)"
                            )

                            scope = gr.Radio(
                                label="Scope",
                                choices=[("Whole audio", "whole"), ("Specific clips", "clips")],
                                value=prefs.get("scope", "whole"),
                                info="Process entire file or specific time ranges"
                            )

                            clip_data = gr.Textbox(
                                label="Clip Times (for clips mode)",
                                placeholder="0:30-1:45, 2:00-3:30 or one per line\nFormat: MM:SS-MM:SS or HH:MM:SS-HH:MM:SS",
                                lines=3,
                                visible=(prefs.get("scope") == "clips")
                            )

                            # Show/hide clip input based on scope
                            scope.change(
                                fn=lambda x: gr.update(visible=(x == "clips")),
                                inputs=[scope],
                                outputs=[clip_data]
                            )

                            diarization = gr.Checkbox(
                                label="Enable Speaker Diarization",
                                value=prefs.get("diarization", False),
                                info="Identify and label different speakers (requires HF_TOKEN in .env)"
                            )

                        with gr.Column(scale=1):
                            with gr.Group(elem_id="output-column"):
                                status_text = gr.HTML(
                                    "<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- Loading models...</span></div>"
                                )

                                output_html = gr.HTML(
                                    "<div style='color: gray;'>Loading models, please wait...</div>",
                                    elem_classes=["output-box"]
                                )

                                # Hidden timer for polling loading status
                                loading_timer = gr.Timer(value=0.5, active=True)

                    # Fixed bottom bar with button
                    with gr.Column(elem_id="transcribe-bottom-bar"):
                        transcribe_btn = gr.Button(
                            "Start Transcription",
                            variant="primary",
                            size="lg",
                            interactive=False  # Start disabled while loading
                        )

                # Wire up the transcription
                transcribe_btn.click(
                    fn=transcribe_wrapper,
                    inputs=[
                        input_source,
                        uploaded_file,
                        whisperx_model,
                        ollama_model,
                        language,
                        scope,
                        clip_data,
                        diarization,
                    ],
                    outputs=[output_html, status_text]
                )

                # Checkmark display state
                checkmark_shown_at = [None]  # Use list to make it mutable in closure

                def update_loading_status():
                    """Poll loading status and update UI."""
                    global model_loading_status

                    # If we're showing checkmark, wait 2 seconds then reset
                    if checkmark_shown_at[0] is not None:
                        elapsed = time.time() - checkmark_shown_at[0]
                        if elapsed >= 2.0:
                            checkmark_shown_at[0] = None
                            return (
                                "<div style='color: gray;'>Results will appear here...</div>",
                                "<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span></div>",
                                gr.Timer(active=False),  # Stop timer
                                gr.Button(interactive=True, variant="primary")  # Enable button
                            )
                        else:
                            # Keep showing checkmark
                            return (
                                "<div style='color: green; font-size: 18px;'>Models loaded successfully!</div>",
                                "<div style='margin: 10px 0;'><span style='font-size: 22px; font-weight: 600;'>Output</span> <span style='font-size: 16px; font-weight: normal;'>- Models ready</span></div>",
                                gr.Timer(active=True),
                                gr.Button(interactive=True, variant="primary")  # Enable button
                            )

                    html, status = get_loading_status()

                    # If loading just completed, mark checkmark time
                    if model_loading_status["is_complete"] and checkmark_shown_at[0] is None:
                        checkmark_shown_at[0] = time.time()

                    # Keep timer active if still loading or showing checkmark
                    timer_active = model_loading_status["is_loading"] or checkmark_shown_at[0] is not None

                    # Button state: disabled (grey) while loading, enabled (blue) when ready
                    button_enabled = not model_loading_status["is_loading"]
                    button_variant = "primary" if button_enabled else "secondary"

                    return (
                        html,
                        status,
                        gr.Timer(active=timer_active),
                        gr.Button(interactive=button_enabled, variant=button_variant)
                    )

                # Connect timer to update function
                loading_timer.tick(
                    fn=update_loading_status,
                    outputs=[output_html, status_text, loading_timer, transcribe_btn]
                )

            # Settings tab
            with gr.Tab("Settings"):
                gr.Markdown("### Advanced Settings")
                gr.Markdown("These settings affect model performance and resource usage.")

                device_input = gr.Radio(
                    label="Device",
                    choices=["cuda", "cpu"],
                    value=prefs.get("device", "cuda"),
                    info="Use CUDA (GPU) for faster processing or CPU for compatibility"
                )

                compute_type_input = gr.Dropdown(
                    label="Compute Type",
                    choices=["float16", "float32", "int8"],
                    value=prefs.get("compute_type", "float16"),
                    info="float16 = fastest (requires modern GPU), int8 = CPU-friendly"
                )

                batch_size_input = gr.Slider(
                    label="Batch Size",
                    minimum=1,
                    maximum=32,
                    step=1,
                    value=prefs.get("batch_size", 16),
                    info="Higher = faster but uses more VRAM"
                )

                save_prefs_btn = gr.Button("Save Settings", variant="primary")
                prefs_status = gr.Markdown("")

                save_prefs_btn.click(
                    fn=save_preferences_ui,
                    inputs=[device_input, compute_type_input, batch_size_input],
                    outputs=[prefs_status]
                )

                gr.Markdown("---")
                gr.Markdown("### About")
                gr.Markdown("""
                **WhisperX Transcriber** combines:
                - **WhisperX**: Fast, accurate speech-to-text
                - **Pyannote**: Speaker diarization
                - **Ollama**: LLM-powered proper noun correction
                - **Smart Processing**: Sentence merging, capitalization fixes, long-sentence splitting

                Output files are saved to the transcriber directory as `.html` files with embedded audio player.
                """)

            # Info tab
            with gr.Tab("Help"):
                gr.Markdown("""
                ## How to Use

                ### Basic Usage
                1. **Input**: Paste a YouTube URL or upload an audio file
                2. **Choose Models**: Select WhisperX and Ollama models
                3. **Set Language**: Choose language or use auto-detect
                4. **Options**: Enable diarization if you want speaker labels
                5. **Click Transcribe**: Processing starts and results appear on the right

                ### Clips Mode
                - Use clips mode to transcribe specific portions of audio
                - Format: `MM:SS-MM:SS` or `HH:MM:SS-HH:MM:SS`
                - Multiple clips: separate with commas or newlines
                - Example: `0:30-1:45, 2:00-3:30`

                ### Models
                - **medium**: Fast, good for clear audio
                - **large-v2**: Better accuracy, slower
                - **large-v3**: Best accuracy, slowest, most VRAM

                ### Speaker Diarization
                - Requires HuggingFace token in `.env` file
                - Format: `HF_TOKEN=your_token_here`
                - Get token from: https://huggingface.co/settings/tokens
                - Accept pyannote terms: https://huggingface.co/pyannote/speaker-diarization

                ### Output
                - HTML files are saved in the transcriber directory
                - Each transcription includes:
                  - Interactive timeline with clickable timestamps
                  - Speaker labels (if diarization enabled)
                  - Proper noun corrections
                  - Audio player (for local files)

                ### Settings Persistence
                - All your choices are automatically saved
                - Next time you open the app, your last settings are loaded
                """)

        return app

def main():
    """Main entry point for the GUI."""
    print("="*60)
    print("WhisperX Transcriber - GUI Mode")
    print("="*60)
    print("\nStarting web interface...")
    print("Models will load in the background")
    print("="*60)

    # Create the interface
    app = create_interface()

    # Start loading models in background thread AFTER app is ready
    def load_in_background():
        time.sleep(1)  # Give the UI a moment to initialize
        print("\nLoading models in background...")
        load_models_on_startup()
        print("Models loaded and ready\n")

    loading_thread = threading.Thread(target=load_in_background, daemon=True)
    loading_thread.start()

    # Launch with auto-open in browser (happens immediately)
    app.launch(
        server_name="127.0.0.1",
        server_port=7860,
        share=False,
        inbrowser=True,
        show_error=True,
        quiet=False
    )

if __name__ == "__main__":
    main()