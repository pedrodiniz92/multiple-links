You’re getting two bars because gr.Progress renders a bar for each output component tied to the click event — and your click wires two outputs (output_html and status_text). So the same progress stream shows twice.

Clean fix (keep native Gradio progress, show only one bar)

Capture the status in a hidden gr.State, so the click has only one visible output. Then update status_text in a chained step.

Define a state holder next to your outputs:

status_state = gr.State("")


Keep your transcribe_wrapper returning (result_html, status_html) exactly as it does now.

Change the click wiring to output the HTML and the hidden state (instead of the visible status HTML):

job = transcribe_btn.click(
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
    outputs=[output_html, status_state],   # ← only one visible output
    show_progress=True
)


After it finishes, push the status text into the visible status_text:

job.then(fn=lambda s: s, inputs=[status_state], outputs=[status_text])


That way the progress bar is attached only to output_html, so it appears once, and status_text updates at the end. Keep your Option-B setup (progress=gr.Progress(track_tqdm=False) and calling the passed progress_callback inside your pipeline).