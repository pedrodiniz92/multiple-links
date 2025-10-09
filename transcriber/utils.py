#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Utility functions for transcription system.
"""

import os
import re
import json
import subprocess
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse


def run(cmd: str, cwd=None, check=True) -> int:
    """Run a shell command and stream output."""
    print(f"\n$ {cmd}")
    proc = subprocess.run(cmd, shell=True, cwd=cwd)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}")
    return proc.returncode


def run_capture(cmd: str, cwd=None, check=True) -> str:
    """Run a shell command and capture output."""
    proc = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}")
    return proc.stdout


def sanitize_filename(name: str) -> str:
    """Remove or replace characters that are problematic in filenames."""
    name = name.replace("/", "_").replace("\\", "_")
    name = re.sub(r'[<>:"|?*]', "", name)
    name = name.strip(". ")
    if not name:
        name = "Untitled"
    return name[:200]


def ms_to_label(ms: int, hour_mode: bool = False) -> str:
    """Convert milliseconds to MM:SS or HH:MM:SS label."""
    total_sec = ms // 1000
    h = total_sec // 3600
    m = (total_sec % 3600) // 60
    s = total_sec % 60
    if hour_mode:
        return f"{h:02d}:{m:02d}:{s:02d}"
    else:
        return f"{m:02d}:{s:02d}"


def sec_to_tc(sec: float) -> str:
    """Convert seconds to HH:MM:SS timecode."""
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


def html_escape(text: str) -> str:
    """Escape HTML special characters."""
    if not text:
        return ""
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&#x27;"))


def strip_t_param(url: str) -> str:
    """Remove ?t= or &t= timestamp parameter from YouTube URL."""
    parsed = urlparse(url)
    qd = parse_qs(parsed.query)
    qd.pop("t", None)
    new_query = urlencode(qd, doseq=True)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path,
                      parsed.params, new_query, parsed.fragment))


def add_t(url: str, seconds: int) -> str:
    """Add ?t=<seconds> to a YouTube URL."""
    parsed = urlparse(url)
    qd = parse_qs(parsed.query)
    qd["t"] = [str(seconds)]
    new_query = urlencode(qd, doseq=True)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path,
                      parsed.params, new_query, parsed.fragment))


def get_unique_path(path: Path) -> Path:
    """If path exists, append (1), (2), etc. until unique."""
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    counter = 1
    while True:
        new_path = parent / f"{stem}({counter}){suffix}"
        if not new_path.exists():
            return new_path
        counter += 1


def parse_time_to_seconds(t: str) -> int:
    """Parse mm:ss or hh:mm:ss to seconds."""
    parts = t.strip().split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    elif len(parts) == 2:
        return int(parts[0]) * 60 + int(parts[1])
    else:
        return int(parts[0])


def is_local_file(path: str) -> bool:
    """Check if path is a local file (not a URL)."""
    return Path(path).exists() and Path(path).is_file()


def extract_info(url: str):
    """Use yt-dlp to get title, duration, and description without downloading."""
    try:
        info_json = run_capture(f'yt-dlp -j --no-warnings --skip-download "{url}"', check=False)
        data = None
        for line in info_json.splitlines():
            try:
                obj = json.loads(line)
                if obj.get("_type") == "playlist":
                    continue
                data = obj
                break
            except Exception:
                pass
        if not data:
            video_id = None
            if "v=" in url:
                video_id = url.split("v=")[1].split("&")[0]
            elif "youtu.be/" in url:
                video_id = url.split("youtu.be/")[1].split("?")[0]
            title = f"YouTube Video {video_id}" if video_id else "YouTube Video"
            return title, None, ""
        title = data.get("title", "YouTube Video")
        duration = data.get("duration")
        description = data.get("description", "")
        return title, duration, description
    except Exception as e:
        print(f"Warning: Could not extract metadata: {e}")
        video_id = None
        if "v=" in url:
            video_id = url.split("v=")[1].split("&")[0]
        elif "youtu.be/" in url:
            video_id = url.split("youtu.be/")[1].split("?")[0]
        title = f"YouTube Video {video_id}" if video_id else "YouTube Video"
        return title, None, ""


def get_audio_duration(audio_path: str) -> int:
    """Get duration of audio file in seconds using ffprobe."""
    try:
        cmd = f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{audio_path}"'
        result = run_capture(cmd, check=False)
        return int(float(result.strip()))
    except Exception:
        return 0


def ensure_audio(url: str, work_dir: str) -> str:
    """Download audio from YouTube URL."""
    out_template = str(Path(work_dir) / "audio.%(ext)s")
    run(f'yt-dlp -f bestaudio --extract-audio --audio-format m4a '
        f'--audio-quality 0 -o "{out_template}" "{url}"')
    # Find the downloaded file
    for f in Path(work_dir).iterdir():
        if f.name.startswith("audio."):
            return str(f)
    raise FileNotFoundError("Audio file not downloaded")


def clip_audio(audio_path: str, start_sec: float, end_sec: float, output_path: str):
    """Extract a clip from audio using ffmpeg."""
    duration = end_sec - start_sec
    run(f'ffmpeg -y -ss {start_sec} -i "{audio_path}" -t {duration} '
        f'-c copy "{output_path}"', check=True)


def open_file_picker():
    """Open a Windows file picker dialog and return the selected file path."""
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        file_path = filedialog.askopenfilename(
            title="Select Audio/Video File",
            filetypes=[
                ("Audio/Video Files", "*.mp3 *.m4a *.wav *.flac *.ogg *.opus *.mp4 *.mkv *.webm *.avi"),
                ("All Files", "*.*")
            ]
        )
        root.destroy()
        return file_path if file_path else None
    except Exception as e:
        print(f"Error opening file picker: {e}")
        return None
