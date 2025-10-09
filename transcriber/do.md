Use a structure-based rule that only hits the top label that’s a direct child of a component block, which leaves radio/checkbox/toggle option labels alone.

Drop this into your css="""...""" (keep it below the theme line and above any very specific .svelte-... rules):

/* Remove the blue pill behind component titles only (safe for radios/checkboxes/toggles) */
.gradio-container .gr-block > label,
.gradio-container .block > label,
.gradio-container .form .block > label,
.gradio-container .gr-form > .gr-block > label {
  background: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

/* Make sure option labels KEEP their styling */
.gradio-container .gr-radio label,
.gradio-container .gr-checkbox label,
.gradio-container .gr-checkbox-group label,
.gradio-container .gr-toggle label {
  background: initial !important; /* don’t force transparent here */
}