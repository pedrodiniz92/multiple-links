# Goal
Read the codebase to understand what it does.
Sometimes I run ‘speaker relabeling’ and ‘proper noun corrections’ by clicking to apply, and then there’s no button to save. Can we make sure we have some sort of “apply and save” and “apply and save as…” if i just clicked “apply” for both of those features?
Also, sometimes I apply selected corrections, then read the transcript and notice there are more corrections to be made. So I’d like to still keep “+ Add custom correction” even after applying corrections.
I thought of adding all of these as a navbar, horizontal and up top, that I can click to collapse (retaining a hamburger icon to the far right that I can click to bring back.
Also, ideally I don’t want anything in the navbar (buttons, icons, text, etc) to be selected if I ctrl + A  

# What to do 
File: html_builder.py
Do these 4 edits. No other changes.

1) Add CSS (append inside your existing <style> in <head>)
/* --- Persistent top navbar --- */
#appNavbar {
  position: sticky;
  top: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #0f172a;
  color: #e2e8f0;
  border-bottom: 1px solid #334155;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  font-family: Arial, sans-serif;
}

#appNavbar.collapsed .nav-content { display: none; }

#navHamburger {
  cursor: pointer;
  font-weight: 800;
  background: transparent;
  color: #e2e8f0;
  border: 1px solid #475569;
  border-radius: 8px;
  padding: 6px 10px;
  margin-left: 8px; /* right-side cosmetic spacing */
}

#appNavbar button.nav-btn {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #475569;
  background: #38bdf8;
  color: #0b1220;
  font-weight: 600;
  cursor: pointer;
}
#appNavbar button.nav-btn:hover { filter: brightness(0.95); }

#appNavbar .spacer { flex: 1 1 auto; }

2) Insert Navbar HTML (immediately after <body> open in build_html(...))
<div id="appNavbar" class="">
  <div class="nav-content" style="display:flex; gap:8px; align-items:center;">
    <button class="nav-btn" onclick="saveHTML()">Save</button>
    <button class="nav-btn" onclick="saveHTMLAs()">Save as…</button>
    <button class="nav-btn" onclick="applyCorrectionsAndSave()">Apply Corrections + Save</button>
    <button class="nav-btn" onclick="applyRelabelingAndSave()">Apply Relabeling + Save</button>
    <button class="nav-btn" onclick="openAddCorrectionDialog()">+ Add custom correction</button>
  </div>
  <div class="spacer"></div>
  <button id="navHamburger" title="Toggle menu">☰</button>
</div>

3) Add JS Helpers (append inside your existing big <script> block)
// --- Navbar collapse ---
(function initNavbar(){
  const bar = document.getElementById('appNavbar');
  const ham = document.getElementById('navHamburger');
  if (!bar || !ham) return;
  ham.addEventListener('click', () => { bar.classList.toggle('collapsed'); });
})();

// --- Save current HTML ---
function saveHTML() {
  const htmlContent = document.documentElement.outerHTML;
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (document.title || 'transcript') + '.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function saveHTMLAs() {
  const htmlContent = document.documentElement.outerHTML;
  try {
    const handle = await (window.showSaveFilePicker ? window.showSaveFilePicker({
      suggestedName: (document.title || 'transcript') + '.html',
      types: [{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }]
    }) : null);
    if (handle) {
      const writable = await handle.createWritable();
      await writable.write(htmlContent);
      await writable.close();
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  saveHTML();
}

// --- Apply + Save (Corrections) ---
function applyCorrectionsAndSave() {
  if (typeof applyCorrections === 'function') {
    applyCorrections();
  } else if (typeof applyCorrectionsToTranscript === 'function') {
    const selected = (typeof collectSelectedCorrections === 'function') ? collectSelectedCorrections() : null;
    if (selected) applyCorrectionsToTranscript(selected);
  }
  saveHTML();
}

// --- Apply + Save (Relabeling) ---
function applyRelabelingAndSave() {
  if (typeof applyAndSave === 'function') {
    applyAndSave();
  } else if (typeof applyRelabeling === 'function') {
    applyRelabeling();
    saveHTML();
  } else {
    saveHTML();
  }
}

// --- Quick “+ Add custom correction” ---
function openAddCorrectionDialog() {
  const original = prompt('Original text to replace (word/phrase):');
  if (!original) return;
  const suggested = prompt(`Replace "${original}" with:`);
  if (suggested == null) return;
  const caseSensitive = confirm('Case-sensitive? OK = yes, Cancel = no');

  const corr = [{ original, suggested, caseSensitive }];
  if (typeof applyCorrectionsToTranscript === 'function') {
    applyCorrectionsToTranscript(corr);
  } else {
    const flags = caseSensitive ? 'g' : 'gi';
    const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escapedOriginal + '\\b', flags);
    document.querySelectorAll('table tbody td:not(.ts)').forEach(cell => {
      const before = cell.innerHTML;
      const after = before.replace(regex, (m) => {
        if (caseSensitive) return suggested;
        if (m[0] === m[0].toUpperCase() && suggested) {
          return suggested[0].toUpperCase() + suggested.slice(1);
        }
        return suggested;
      });
      if (after !== before) cell.innerHTML = after;
    });
  }
}

// --- Keep navbar out of Ctrl+A selection ---
document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    const table = document.querySelector('table');
    if (table) {
      e.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(table);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}, true);

4) Stop hiding panels after Apply (search & delete these lines)

In the functions that run on plain “Apply”:

Remove any line that hides corrections:

document.getElementById('correctionSection').style.display = 'none';


(Optional) remove any line that hides relabel UI:

document.getElementById('relabelSection').style.display = 'none';