"""
Gradio GUI for WhisperX Transcriber
Provides a modern web interface for transcription with persistent preferences.
"""
import os
import sys
import time
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

def get_ollama_models():
    """Query Ollama for available models."""
    if not OLLAMA_AVAILABLE:
        return ["llama3.2:3b", "llama3.2:8b"]  # Fallback defaults

    try:
        response = ollama.list()
        models = [model['name'] for model in response.get('models', [])]

        # Filter for common chat models (exclude embedding models)
        chat_models = [m for m in models if not any(x in m.lower() for x in ['embed', 'nomic'])]

        if not chat_models:
            return ["llama3.2:3b"]  # Fallback if no models found

        return sorted(chat_models)
    except Exception as e:
        print(f"Warning: Could not query Ollama models ({e}), using defaults")
        return ["llama3.2:3b", "llama3.2:8b"]

def load_models_on_startup():
    """Load WhisperX models at GUI startup."""
    global model_manager

    if model_manager is None:
        model_manager = ModelManager()
        # Load transcription model (alignment models loaded on-demand per language)
        model_manager.load_transcribe_model()

    return "✓ Models loaded and ready"

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
        return "<div style='color: red;'>Error: Please provide a YouTube URL or upload a file</div>", "❌ No input provided"

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
                        return f"<div style='color: red;'>Error parsing clip time '{line}': {e}</div>", "❌ Invalid clip format"

    if mode == "2" and not clip_times:
        return "<div style='color: red;'>Error: Clips mode selected but no valid clips provided</div>", "❌ No clips provided"

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
        result_html = "<div style='color: green; font-size: 18px; margin: 20px 0;'>✅ Transcription complete!</div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Title:</strong> {result['title']}</div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Output:</strong> <code>{result['html_path'].name}</code></div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Location:</strong> <code>{result['html_path']}</code></div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Segments:</strong> {result['segments_count']}</div>"
        result_html += f"<div style='margin: 10px 0;'><strong>Processing Time:</strong> {result['processing_time']:.1f}s</div>"

        if result['audio_duration'] > 0:
            ratio = result['processing_time'] / result['audio_duration']
            result_html += f"<div style='margin: 10px 0;'><strong>Speed:</strong> {ratio:.2f}x realtime</div>"

        return result_html, f"✅ Done in {result['processing_time']:.1f}s"

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        error_html = f"<div style='color: red;'><strong>❌ Error:</strong> {str(e)}</div>"
        error_html += f"<details><summary>Stack Trace</summary><pre style='font-size: 11px;'>{error_trace}</pre></details>"
        return error_html, f"❌ Error: {str(e)}"

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

        return "✓ Preferences saved"
    except Exception as e:
        return f"❌ Error saving preferences: {e}"

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
        .output-box {max-height: 600px; overflow-y: auto;}
        .status-text {font-size: 16px; font-weight: bold; margin: 10px 0;}
        .custom-title-container {
            margin-bottom: 20px;
        }
        .custom-title {
            display: inline;
            font-size: 36px;
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
        /* Remove blue background from inputs */
        .gradio-container input,
        .gradio-container textarea,
        .gradio-container select {
            background-color: white !important;
        }
        .gr-box {
            background-color: white !important;
        }
        """
    ) as app:

        with gr.Tabs():
            # Main transcription tab
            with gr.Tab("Transcribe"):
                with gr.Row():
                    with gr.Column(scale=1):
                        # Header aligned with content
                        gr.HTML("""
                        <div class="custom-title-container">
                            <div class="custom-title">Pedro's Transcriber</div>
                            <div class="custom-subtitle">(WhisperX, Pyannote)</div>
                            <div class="custom-description">Transcribe YouTube videos or local audio files with speaker diarization and proper noun correction.</div>
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

                        transcribe_btn = gr.Button(
                            "🎬 Start Transcription",
                            variant="primary",
                            size="lg"
                        )

                    with gr.Column(scale=1):
                        gr.Markdown("### Output")

                        status_text = gr.Markdown(
                            "Ready to transcribe",
                            elem_classes=["status-text"]
                        )

                        output_html = gr.HTML(
                            "<div style='color: gray;'>Results will appear here...</div>",
                            elem_classes=["output-box"]
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

                save_prefs_btn = gr.Button("💾 Save Settings", variant="primary")
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
    print("\n📦 Loading models... This may take a minute...")

    # Load models at startup
    status = load_models_on_startup()
    print(f"{status}\n")

    print("🌐 Starting web interface...")
    print("="*60)

    # Create and launch the interface
    app = create_interface()

    # Launch with auto-open in browser
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
