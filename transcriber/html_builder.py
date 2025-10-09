#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
HTML generation for transcripts with speaker relabeling and proper noun correction.
"""

import json
from pathlib import Path
from utils import html_escape, ms_to_label, add_t

# Try to import spacy for person name extraction
try:
    import spacy
    SPACY_AVAILABLE = True
    _nlp_cache = None
except ImportError:
    SPACY_AVAILABLE = False


def extract_person_names(text: str) -> list:
    """
    Extract person names from text using spacy NER.
    Returns list of person names found.
    """
    if not SPACY_AVAILABLE or not text:
        return []

    global _nlp_cache
    if _nlp_cache is None:
        try:
            _nlp_cache = spacy.load("en_core_web_sm")
        except OSError:
            return []

    doc = _nlp_cache(text)
    person_names = []

    # Blacklist of words that should never be part of names
    BLACKLIST_WORDS = {
        'subscribe', 'click', 'watch', 'listen', 'follow', 'like',
        'share', 'comment', 'join', 'download', 'visit', 'read',
        'buy', 'purchase', 'check', 'learn', 'discover', 'explore'
    }

    # Common single-word false positives (book titles, concepts, etc.)
    SINGLE_WORD_BLACKLIST = {
        'breakneck', 'america', 'china', 'united', 'states', 'york',
        'times', 'podcast', 'episode', 'author', 'book', 'chapter'
    }

    for ent in doc.ents:
        if ent.label_ == 'PERSON':
            # Clean up the name
            name = ent.text.strip()

            # Skip very short names
            if len(name) <= 2:
                continue

            # Split into words and filter out blacklisted words
            words = name.split()
            filtered_words = [w for w in words if w.lower() not in BLACKLIST_WORDS]

            # If all words were filtered out, skip
            if not filtered_words:
                continue

            # Reconstruct the name
            clean_name = ' '.join(filtered_words)

            # Skip if single word and in single-word blacklist
            if len(filtered_words) == 1 and filtered_words[0].lower() in SINGLE_WORD_BLACKLIST:
                continue

            # Skip if we've already added this name
            if clean_name in person_names:
                continue

            person_names.append(clean_name)

    return person_names


def build_html(rows, video_url, title, hour_mode, audio_file=None, corrections=None, description=""):
    """Build complete HTML document with transcript, relabeling UI, and correction UI."""
    # Check if diarization was used (any speaker labels present)
    has_speakers = any(speaker for _, _, _, _, speaker in rows)

    # Collect first occurrence of each speaker for the relabeling table
    speaker_samples = {}
    if has_speakers:
        for start_ms, end_ms, text, video_rel_s, speaker in rows:
            if speaker and speaker not in speaker_samples:
                label = ms_to_label(start_ms, hour_mode)
                sample_text = text[:150] + "..." if len(text) > 150 else text
                speaker_samples[speaker] = {"label": label, "sample": sample_text, "time": video_rel_s}

    # Build HTML head with CSS
    head = f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>{html_escape(title)}</title>
<style>
  body {{ margin:24px; background:#fff; }}
  .title {{ font-family: Arial, sans-serif; font-size:14pt; font-weight:bold; margin-bottom:16px; }}
  table {{ border-collapse: collapse; width:100%; }}
  td, th {{ border:1px solid #ddd; padding:8px; font-family: Arial, sans-serif; font-size:12pt; vertical-align:top; }}
  th {{ background:transparent; text-align:left; }}
  a {{ color:#1565c0; text-decoration:none; }}
  a:hover {{ text-decoration:underline; }}
  .ts {{ white-space:nowrap; width:1%; text-align:center; }}
  .title a {{ text-decoration:underline; }}
  .speaker {{ font-weight:bold; color:#666; margin-bottom:4px; }}
  .relabel-section {{ background:#f5f5f5; border:1px solid #ccc; padding:16px; margin:16px 0; border-radius:4px; }}
  .relabel-section h3 {{ margin-top:0; font-size:13pt; font-family: Arial, sans-serif; }}
  .relabel-table {{ width:100%; margin-bottom:12px; }}
  .relabel-table td {{ padding:6px; }}
  .relabel-table input {{ width:200px; padding:4px; font-size:11pt; }}
  .relabel-sample {{ color:#666; font-size:10pt; font-style:italic; }}
  .relabel-buttons {{ margin-top:12px; }}
  .relabel-buttons button {{ padding:8px 16px; margin-right:8px; font-size:11pt; cursor:pointer; }}
  .relabel-buttons button:hover {{ opacity:0.8; }}
  .audio-player {{ margin:16px 0; }}
  .audio-player audio {{ width:100%; max-width:600px; }}
  .correction-section {{ background:#fff3e0; border:1px solid #ff9800; padding:16px; margin:16px 0; border-radius:4px; }}
  .correction-section h3 {{ margin-top:0; font-size:13pt; font-family: Arial, sans-serif; }}
  .correction-table {{ width:100%; margin-bottom:12px; }}
  .correction-table td, .correction-table th {{ padding:6px; border:1px solid #ddd; }}
  .correction-table input[type="checkbox"] {{ cursor:pointer; }}
  .suggested-input {{ width:95%; padding:4px; font-size:11pt; font-family: Arial, sans-serif; border:1px solid #ccc; }}
  .confidence-high {{ color:#2e7d32; font-weight:bold; }}
  .confidence-medium {{ color:#f57c00; font-weight:bold; }}
  .confidence-low {{ color:#c62828; font-weight:bold; }}
  .context-snippet {{ font-size:10pt; color:#666; font-style:italic; margin-top:4px; }}
  .correction-buttons {{ margin-top:12px; }}
  .correction-buttons button {{ padding:8px 16px; margin-right:8px; font-size:11pt; cursor:pointer; }}
  .correction-buttons button:hover {{ opacity:0.8; }}
  .highlight-change {{ background-color:yellow; transition:background-color 2s; }}
</style>
</head><body>
<div class="title">{html_escape(title)}{' - <a href="' + html_escape(video_url) + '" target="_blank" rel="noopener noreferrer">link</a>' if video_url else ''}</div>
"""

    # Add audio player if local file
    if audio_file:
        audio_ext = Path(audio_file).suffix.lower()
        mime_types = {
            '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
            '.opus': 'audio/opus', '.wav': 'audio/wav', '.webm': 'audio/webm', '.flac': 'audio/flac'
        }
        mime_type = mime_types.get(audio_ext, 'audio/mpeg')
        head += f'<div class="audio-player"><audio controls preload="metadata"><source src="{html_escape(audio_file)}" type="{mime_type}">Your browser does not support the audio element.</audio></div>\n'

    # Add relabeling section if speakers exist
    if has_speakers:
        head += build_relabeling_section(speaker_samples, audio_file, video_url, title, description)

    # Add proper noun correction section if corrections exist
    if corrections and len(corrections) > 0:
        head += build_correction_section(corrections, audio_file, video_url, hour_mode)

    head += '<table>\n<thead><tr><th>Time</th><th>Transcript</th></tr></thead>\n<tbody>\n'

    # Build transcript rows
    body = []
    prev_speaker = None

    for idx, (start_ms, end_ms, text, video_rel_s, speaker) in enumerate(rows):
        label = ms_to_label(start_ms, hour_mode)

        # For local files, use onclick to seek audio; for videos, use URL with timestamp
        if audio_file:
            link = f"javascript:void(0)\" onclick=\"document.querySelector('audio').currentTime={video_rel_s};document.querySelector('audio').play();"
        else:
            link = add_t(video_url, video_rel_s)

        if speaker and (idx == 0 or speaker != prev_speaker):
            transcript_html = f'<div class="speaker" data-speaker="{html_escape(speaker)}">{html_escape(speaker)}:</div>{html_escape(text)}'
        else:
            transcript_html = html_escape(text)

        # Different link styling for local vs YouTube
        if audio_file:
            body.append(f'<tr><td class="ts"><a href="{link}" style="cursor:pointer;">{html_escape(label)}</a></td><td>{transcript_html}</td></tr>')
        else:
            body.append(f'<tr><td class="ts"><a href="{html_escape(link)}" target="_blank" rel="noopener noreferrer">{html_escape(label)}</a></td><td>{transcript_html}</td></tr>')
        prev_speaker = speaker

    # Add JavaScript
    js_script = build_javascript(has_speakers, speaker_samples if has_speakers else {})

    tail = "\n</tbody></table>\n" + js_script + "\n</body></html>\n"
    return head + "\n".join(body) + tail


def build_relabeling_section(speaker_samples, audio_file, video_url, title="", description=""):
    """Build the speaker relabeling UI section with person name suggestions."""
    # Extract person names from title and description
    combined_text = f"{title} {description}".strip()
    person_names = extract_person_names(combined_text)

    html = '<div class="relabel-section" id="relabelSection">\n'

    # Add header with person names in italics if found
    if person_names:
        names_display = ', '.join(person_names)
        html += f'<h3>Speaker Relabeling – <em>{html_escape(names_display)}</em></h3>\n'
    else:
        html += '<h3>Speaker Relabeling</h3>\n'

    # Add datalist for name suggestions
    if person_names:
        html += '<datalist id="personNameSuggestions">\n'
        for name in person_names:
            html += f'  <option value="{html_escape(name)}">\n'
        html += '</datalist>\n'

    html += '<table class="relabel-table">\n'
    html += '<tr><th>Speaker Tag</th><th>New Name</th><th>Sample</th></tr>\n'

    for speaker in sorted(speaker_samples.keys()):
        sample_info = speaker_samples[speaker]
        # Create appropriate timestamp link for local vs YouTube
        if audio_file:
            timestamp_link = f'<a href="javascript:void(0)" onclick="document.querySelector(\'audio\').currentTime={sample_info["time"]};document.querySelector(\'audio\').play();" style="cursor:pointer;">{html_escape(sample_info["label"])}</a>'
        else:
            link = add_t(video_url, sample_info["time"])
            timestamp_link = f'<a href="{html_escape(link)}" target="_blank" rel="noopener noreferrer">{html_escape(sample_info["label"])}</a>'
        sample_display = f"[{timestamp_link}] {html_escape(sample_info['sample'])}"
        html += f'<tr><td>{html_escape(speaker)}</td>'

        # Add list attribute to input if we have person names
        list_attr = ' list="personNameSuggestions"' if person_names else ''
        html += f'<td><input type="text" id="input-{html_escape(speaker)}" placeholder="Enter name..."{list_attr}></td>'
        html += f'<td class="relabel-sample">{sample_display}</td></tr>\n'

    html += '</table>\n'
    html += '<div class="relabel-buttons">\n'
    html += '<button onclick="applyRelabeling()">Apply Relabeling</button>\n'
    html += '<button onclick="applyAndSave()">Apply and Save</button>\n'
    html += '<button onclick="applyAndSaveAs()">Apply and Save as...</button>\n'
    html += '<button onclick="dismissRelabeling()">Dismiss</button>\n'
    html += '</div>\n'
    html += '</div>\n\n'
    return html


def build_correction_section(corrections, audio_file, video_url, hour_mode):
    """Build the proper noun correction UI section."""
    html = '<div class="correction-section" id="correctionSection">\n'
    html += '<h3>Proper Noun Corrections</h3>\n'
    html += '<button onclick="showAddCorrectionForm()" style="margin-bottom:12px; padding:6px 12px; cursor:pointer;">+ Add Custom Correction</button>\n'

    # Add custom correction form (hidden by default)
    html += '<div id="addCorrectionForm" style="display:none; background:#fff; border:1px solid #ccc; padding:12px; margin-bottom:12px; border-radius:4px;">\n'
    html += '<div style="margin-bottom:8px;"><strong>Add Custom Correction</strong></div>\n'
    html += '<div style="margin-bottom:8px;">\n'
    html += '<label style="display:inline-block; width:100px;">Original:</label>\n'
    html += '<input type="text" id="customOriginal" placeholder="e.g., mark kerr" style="width:250px; padding:4px;">\n'
    html += '</div>\n'
    html += '<div style="margin-bottom:8px;">\n'
    html += '<label style="display:inline-block; width:100px;">Replacement:</label>\n'
    html += '<input type="text" id="customReplacement" placeholder="e.g., Mark Kerr" style="width:250px; padding:4px;">\n'
    html += '</div>\n'
    html += '<div style="margin-bottom:8px;">\n'
    html += '<label><input type="checkbox" id="customCaseSensitive" checked> Case-sensitive</label>\n'
    html += '</div>\n'
    html += '<button onclick="addCustomCorrection()" style="padding:6px 12px; margin-right:8px; cursor:pointer;">Add to Table</button>\n'
    html += '<button onclick="hideAddCorrectionForm()" style="padding:6px 12px; cursor:pointer;">Cancel</button>\n'
    html += '</div>\n\n'

    html += '<table class="correction-table" id="correctionsTable">\n'
    html += '<tr><th style="width:60px;">Apply?</th><th>Original</th><th>Suggested</th><th>Occurrences</th><th>Confidence</th><th>Context</th><th style="width:60px;">Delete</th></tr>\n'

    for idx, correction in enumerate(corrections):
        checked = ' checked' if correction['confidence'] == 'high' else ''
        conf_class = f"confidence-{correction['confidence']}"

        # For mid/low confidence with LLM review, show "Suggested by [model]"
        if correction.get('llm_reviewed') and correction['confidence'] in ['medium', 'low']:
            model_name = correction.get('llm_model', 'AI').replace('llama3.1:8b', 'llama-8b').replace('llama3.2:3b', 'llama-3b')
            confidence_display = f'<span class="{conf_class}">Suggested by {model_name}</span>'
        else:
            confidence_display = f'<span class="{conf_class}">{correction["confidence"].capitalize()}</span>'

        # Format contexts with clickable timestamps - remove bold markers
        context_html = ''
        timestamps = correction.get('context_timestamps', [])
        for ctx_idx, ctx in enumerate(correction['contexts']):
            # Remove ** markers instead of converting to <strong>
            ctx_clean = ctx.replace('**', '')
            ctx_escaped = html_escape(ctx_clean)

            # Add clickable timestamp if available (like in Speaker Relabeling)
            if ctx_idx < len(timestamps) and timestamps[ctx_idx] is not None:
                time_seconds = timestamps[ctx_idx]
                label = ms_to_label(int(time_seconds * 1000), hour_mode)

                # Create appropriate timestamp link for local vs YouTube
                if audio_file:
                    timestamp_link = f'<a href="javascript:void(0)" onclick="document.querySelector(\'audio\').currentTime={time_seconds};document.querySelector(\'audio\').play();" style="cursor:pointer;">{html_escape(label)}</a>'
                else:
                    link = add_t(video_url, time_seconds)
                    timestamp_link = f'<a href="{html_escape(link)}" target="_blank" rel="noopener noreferrer">{html_escape(label)}</a>'

                context_html += f'<div class="context-snippet">[{timestamp_link}] {ctx_escaped}</div>'
            else:
                context_html += f'<div class="context-snippet">{ctx_escaped}</div>'

        if correction.get('ambiguous', False):
            confidence_display += ' <span style="color:#999;">(ambiguous)</span>'

        html += f'<tr id="correction_row_{idx}">'
        html += f'<td style="text-align:center;"><input type="checkbox"{checked} id="fix_{idx}" data-original="{html_escape(correction["original"])}" data-suggested="{html_escape(correction["suggested"])}"></td>'
        html += f'<td>{html_escape(correction["original"])}</td>'
        html += f'<td><input type="text" class="suggested-input" id="suggested_{idx}" value="{html_escape(correction["suggested"])}" data-checkbox-id="fix_{idx}"></td>'
        html += f'<td>{correction["occurrences"]}</td>'
        html += f'<td>{confidence_display}</td>'
        html += f'<td>{context_html}</td>'
        html += f'<td style="text-align:center;"><button onclick="deleteCorrection({idx})" style="padding:4px 8px; cursor:pointer; background:#f44336; color:white; border:none; border-radius:3px;">Delete</button></td>'
        html += f'</tr>\n'

    html += '</table>\n'
    html += '<div class="correction-buttons">\n'
    html += '<button onclick="applyCorrections()">Apply Selected Corrections</button>\n'
    html += '<button onclick="applyHighConfidenceOnly()">Apply High-Confidence Only</button>\n'
    html += '<button onclick="applyCorrectionsAndSave()">Apply and Save</button>\n'
    html += '<button onclick="applyCorrectionsAndSaveAs()">Apply and Save as...</button>\n'
    html += '<button onclick="dismissCorrections()">Skip Corrections</button>\n'
    html += '</div>\n'
    html += '</div>\n\n'
    return html


def build_javascript(has_speakers, speaker_samples):
    """Build JavaScript for interactive features."""
    js_script = ""

    if has_speakers:
        js_script = """
<script>
function applyRelabeling() {
  const speakers = """ + json.dumps(list(speaker_samples.keys())) + """;
  const mapping = {};

  speakers.forEach(speaker => {
    const input = document.getElementById('input-' + speaker);
    if (input && input.value.trim()) {
      mapping[speaker] = input.value.trim();
    }
  });

  const speakerDivs = document.querySelectorAll('.speaker');
  speakerDivs.forEach(div => {
    const origSpeaker = div.getAttribute('data-speaker');
    if (origSpeaker && mapping[origSpeaker]) {
      div.textContent = mapping[origSpeaker] + ':';
    }
  });

  document.getElementById('relabelSection').style.display = 'none';
}

function applyAndSave() {
  const speakers = """ + json.dumps(list(speaker_samples.keys())) + """;
  const mapping = {};

  speakers.forEach(speaker => {
    const input = document.getElementById('input-' + speaker);
    if (input && input.value.trim()) {
      mapping[speaker] = input.value.trim();
    }
  });

  const speakerDivs = document.querySelectorAll('.speaker');
  speakerDivs.forEach(div => {
    const origSpeaker = div.getAttribute('data-speaker');
    if (origSpeaker && mapping[origSpeaker]) {
      div.textContent = mapping[origSpeaker] + ':';
    }
  });

  const relabelSection = document.getElementById('relabelSection');
  if (relabelSection) relabelSection.remove();

  const htmlContent = document.documentElement.outerHTML;
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = document.title + '_relabeled.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function applyAndSaveAs() {
  const speakers = """ + json.dumps(list(speaker_samples.keys())) + """;
  const mapping = {};

  speakers.forEach(speaker => {
    const input = document.getElementById('input-' + speaker);
    if (input && input.value.trim()) {
      mapping[speaker] = input.value.trim();
    }
  });

  const speakerDivs = document.querySelectorAll('.speaker');
  speakerDivs.forEach(div => {
    const origSpeaker = div.getAttribute('data-speaker');
    if (origSpeaker && mapping[origSpeaker]) {
      div.textContent = mapping[origSpeaker] + ':';
    }
  });

  const relabelSection = document.getElementById('relabelSection');
  if (relabelSection) relabelSection.remove();

  const htmlContent = document.documentElement.outerHTML;

  try {
    const opts = {
      suggestedName: document.title + '_relabeled.html',
      types: [{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }]
    };
    const handle = await window.showSaveFilePicker(opts);
    const writable = await handle.createWritable();
    await writable.write(htmlContent);
    await writable.close();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Save failed:', err);
      alert('Save as... not supported in this browser. File will be saved to Downloads folder instead.');
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.title + '_relabeled.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
}

function dismissRelabeling() {
  document.getElementById('relabelSection').style.display = 'none';
}
"""

    # Add correction JavaScript (always, not just when speakers exist)
    correction_script = """
function applyCorrections() {
  const checkboxes = document.querySelectorAll('[id^="fix_"]');
  const corrections = [];

  checkboxes.forEach(cb => {
    if (cb.checked) {
      const idx = cb.id.replace('fix_', '');
      const suggestedInput = document.getElementById('suggested_' + idx);
      const caseSensitive = cb.getAttribute('data-case-sensitive');
      corrections.push({
        original: cb.getAttribute('data-original'),
        suggested: suggestedInput ? suggestedInput.value : cb.getAttribute('data-suggested'),
        caseSensitive: caseSensitive === 'true'
      });
    }
  });

  applyCorrectionsToTranscript(corrections);
}

function applyHighConfidenceOnly() {
  const checkboxes = document.querySelectorAll('[id^="fix_"]');
  checkboxes.forEach(cb => {
    const row = cb.closest('tr');
    const confidenceCell = row.cells[4];
    if (!confidenceCell.textContent.includes('High')) {
      cb.checked = false;
    }
  });

  applyCorrections();
}

function applyCorrectionsToTranscript(corrections) {
  if (corrections.length === 0) {
    document.getElementById('correctionSection').style.display = 'none';
    return;
  }

  const transcriptCells = document.querySelectorAll('table tbody td:not(.ts)');

  corrections.forEach(corr => {
    // Use case-sensitive flag if provided, otherwise default to case-insensitive
    const flags = (corr.caseSensitive === true) ? 'g' : 'gi';
    const escapedOriginal = corr.original.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const regex = new RegExp('\\\\b' + escapedOriginal + '\\\\b', flags);

    transcriptCells.forEach(cell => {
      if (cell.classList.contains('ts')) return;

      const originalText = cell.innerHTML;
      const newText = originalText.replace(regex, (match) => {
        const replacement = corr.suggested;
        // For case-sensitive replacements, use exact replacement
        if (corr.caseSensitive === true) {
          return replacement;
        }
        // For case-insensitive, preserve capitalization of first letter
        if (match[0] === match[0].toUpperCase()) {
          return replacement[0].toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });

      if (newText !== originalText) {
        cell.innerHTML = newText;
        cell.classList.add('highlight-change');
        setTimeout(() => cell.classList.remove('highlight-change'), 2000);
      }
    });
  });

  document.getElementById('correctionSection').style.display = 'none';
}

function dismissCorrections() {
  document.getElementById('correctionSection').style.display = 'none';
}

function applyCorrectionsAndSave() {
  // Apply corrections
  const checkboxes = document.querySelectorAll('[id^="fix_"]');
  const corrections = [];

  checkboxes.forEach(cb => {
    if (cb.checked) {
      const idx = cb.id.replace('fix_', '');
      const suggestedInput = document.getElementById('suggested_' + idx);
      const caseSensitive = cb.getAttribute('data-case-sensitive');
      corrections.push({
        original: cb.getAttribute('data-original'),
        suggested: suggestedInput ? suggestedInput.value : cb.getAttribute('data-suggested'),
        caseSensitive: caseSensitive === 'true'
      });
    }
  });

  if (corrections.length === 0) {
    document.getElementById('correctionSection').style.display = 'none';
    return;
  }

  const transcriptCells = document.querySelectorAll('table tbody td:not(.ts)');

  corrections.forEach(corr => {
    const flags = (corr.caseSensitive === true) ? 'g' : 'gi';
    const escapedOriginal = corr.original.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const regex = new RegExp('\\\\b' + escapedOriginal + '\\\\b', flags);

    transcriptCells.forEach(cell => {
      if (cell.classList.contains('ts')) return;

      const originalText = cell.innerHTML;
      const newText = originalText.replace(regex, (match) => {
        const replacement = corr.suggested;
        if (corr.caseSensitive === true) {
          return replacement;
        }
        if (match[0] === match[0].toUpperCase()) {
          return replacement[0].toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });

      if (newText !== originalText) {
        cell.innerHTML = newText;
      }
    });
  });

  // Remove correction section
  const correctionSection = document.getElementById('correctionSection');
  if (correctionSection) correctionSection.remove();

  // Save file
  const htmlContent = document.documentElement.outerHTML;
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = document.title + '_corrected.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function applyCorrectionsAndSaveAs() {
  // Apply corrections
  const checkboxes = document.querySelectorAll('[id^="fix_"]');
  const corrections = [];

  checkboxes.forEach(cb => {
    if (cb.checked) {
      const idx = cb.id.replace('fix_', '');
      const suggestedInput = document.getElementById('suggested_' + idx);
      const caseSensitive = cb.getAttribute('data-case-sensitive');
      corrections.push({
        original: cb.getAttribute('data-original'),
        suggested: suggestedInput ? suggestedInput.value : cb.getAttribute('data-suggested'),
        caseSensitive: caseSensitive === 'true'
      });
    }
  });

  if (corrections.length === 0) {
    document.getElementById('correctionSection').style.display = 'none';
    return;
  }

  const transcriptCells = document.querySelectorAll('table tbody td:not(.ts)');

  corrections.forEach(corr => {
    const flags = (corr.caseSensitive === true) ? 'g' : 'gi';
    const escapedOriginal = corr.original.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    const regex = new RegExp('\\\\b' + escapedOriginal + '\\\\b', flags);

    transcriptCells.forEach(cell => {
      if (cell.classList.contains('ts')) return;

      const originalText = cell.innerHTML;
      const newText = originalText.replace(regex, (match) => {
        const replacement = corr.suggested;
        if (corr.caseSensitive === true) {
          return replacement;
        }
        if (match[0] === match[0].toUpperCase()) {
          return replacement[0].toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });

      if (newText !== originalText) {
        cell.innerHTML = newText;
      }
    });
  });

  // Remove correction section
  const correctionSection = document.getElementById('correctionSection');
  if (correctionSection) correctionSection.remove();

  // Save file with dialog
  const htmlContent = document.documentElement.outerHTML;

  try {
    const opts = {
      suggestedName: document.title + '_corrected.html',
      types: [{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }]
    };
    const handle = await window.showSaveFilePicker(opts);
    const writable = await handle.createWritable();
    await writable.write(htmlContent);
    await writable.close();
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Save failed:', err);
      alert('Save as... not supported in this browser. File will be saved to Downloads folder instead.');
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.title + '_corrected.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
}

function showAddCorrectionForm() {
  document.getElementById('addCorrectionForm').style.display = 'block';
}

function hideAddCorrectionForm() {
  document.getElementById('addCorrectionForm').style.display = 'none';
  // Clear form fields
  document.getElementById('customOriginal').value = '';
  document.getElementById('customReplacement').value = '';
  document.getElementById('customCaseSensitive').checked = true;
}

function addCustomCorrection() {
  const original = document.getElementById('customOriginal').value.trim();
  const replacement = document.getElementById('customReplacement').value.trim();
  const caseSensitive = document.getElementById('customCaseSensitive').checked;

  if (!original || !replacement) {
    alert('Please enter both original and replacement text.');
    return;
  }

  // Count occurrences in the transcript
  const transcriptCells = document.querySelectorAll('table tbody td:not(.ts)');
  let occurrences = 0;
  const contexts = [];

  transcriptCells.forEach(cell => {
    if (cell.classList.contains('ts')) return;

    const text = cell.textContent;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp('\\\\b' + original.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + '\\\\b', flags);
    const matches = text.match(regex);

    if (matches) {
      occurrences += matches.length;

      // Extract context (first occurrence only)
      if (contexts.length < 3) {
        const words = text.split(' ');
        const matchIndex = words.findIndex(word => regex.test(word));
        if (matchIndex !== -1) {
          const start = Math.max(0, matchIndex - 6);
          const end = Math.min(words.length, matchIndex + 7);
          const contextWords = words.slice(start, end);
          const context = (start > 0 ? '...' : '') + contextWords.join(' ') + (end < words.length ? '...' : '');
          contexts.push(context);
        }
      }
    }
  });

  if (occurrences === 0) {
    alert('No occurrences of "' + original + '" found in the transcript.');
    return;
  }

  // Get current number of rows to generate unique IDs
  const table = document.getElementById('correctionsTable');
  const rowCount = table.rows.length - 1; // Subtract header row
  const newIdx = rowCount;

  // Create context HTML
  let contextHtml = '';
  contexts.forEach(ctx => {
    contextHtml += '<div class="context-snippet">' + escapeHtml(ctx) + '</div>';
  });

  // Add new row to table
  const newRow = table.insertRow(-1);
  newRow.id = 'correction_row_' + newIdx;
  newRow.innerHTML = `
    <td style="text-align:center;"><input type="checkbox" checked id="fix_${newIdx}" data-original="${escapeHtml(original)}" data-suggested="${escapeHtml(replacement)}" data-case-sensitive="${caseSensitive}"></td>
    <td>${escapeHtml(original)}</td>
    <td><input type="text" class="suggested-input" id="suggested_${newIdx}" value="${escapeHtml(replacement)}" data-checkbox-id="fix_${newIdx}"></td>
    <td>${occurrences}</td>
    <td><span class="confidence-high">Custom</span></td>
    <td>${contextHtml}</td>
    <td style="text-align:center;"><button onclick="deleteCorrection(${newIdx})" style="padding:4px 8px; cursor:pointer; background:#f44336; color:white; border:none; border-radius:3px;">Delete</button></td>
  `;

  // Hide and reset form
  hideAddCorrectionForm();

  // Show success message
  alert('Custom correction added! Found ' + occurrences + ' occurrence(s). Check the box and click "Apply Selected Corrections" to apply.');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function deleteCorrection(rowIdx) {
  const row = document.getElementById('correction_row_' + rowIdx);
  if (row) {
    row.remove();
  }
}
"""

    # Combine scripts
    if has_speakers:
        js_script += correction_script + "\n</script>\n"
    else:
        js_script = "<script>\n" + correction_script + "</script>\n"

    return js_script
