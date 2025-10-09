"""
Preferences management for transcriber GUI.
Persists user settings between sessions.
"""
import json
from pathlib import Path
from typing import Any

# Default preferences
DEFAULT_PREFERENCES = {
    "whisperx_model": "large-v3",
    "ollama_model": "llama3.2:3b",
    "language": "en",
    "diarization": False,
    "scope": "whole",
    "device": "cuda",
    "compute_type": "float16",
    "batch_size": 16,
}

class PreferencesManager:
    """Manages user preferences with JSON persistence."""

    def __init__(self, prefs_file: Path = None):
        if prefs_file is None:
            prefs_file = Path(__file__).parent / "preferences.json"
        self.prefs_file = prefs_file
        self.prefs = self.load()

    def load(self) -> dict[str, Any]:
        """Load preferences from JSON file, or return defaults if not found."""
        if self.prefs_file.exists():
            try:
                with open(self.prefs_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                # Merge with defaults (in case new preferences were added)
                prefs = DEFAULT_PREFERENCES.copy()
                prefs.update(loaded)
                return prefs
            except Exception as e:
                print(f"Warning: Could not load preferences ({e}), using defaults")
                return DEFAULT_PREFERENCES.copy()
        return DEFAULT_PREFERENCES.copy()

    def save(self) -> None:
        """Save preferences to JSON file."""
        try:
            with open(self.prefs_file, 'w', encoding='utf-8') as f:
                json.dump(self.prefs, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save preferences ({e})")

    def get(self, key: str, default: Any = None) -> Any:
        """Get a preference value."""
        return self.prefs.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set a preference value and save."""
        self.prefs[key] = value
        self.save()

    def update(self, updates: dict[str, Any]) -> None:
        """Update multiple preferences at once."""
        self.prefs.update(updates)
        self.save()
