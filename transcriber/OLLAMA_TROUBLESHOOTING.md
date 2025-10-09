# Ollama Model Detection Issue - Troubleshooting Guide

## Problem
The GUI is not detecting installed Ollama models even though they are available via `ollama list`.

```
🔍 DEBUG: Ollama response type: <class 'ollama._types.ListResponse'>
🔍 DEBUG: Ollama response keys: not a dict
🔍 DEBUG: Found 0 models: []
⚠️ No Ollama models found. Using fallback.
```

## Root Cause
The `ollama.list()` function returns a `ListResponse` object (not a dict), which has a `.models` attribute containing the list of models. The current code tries to treat it as a dict with `.get('models', [])`, which doesn't work.

## Solution

### Location: `gui.py`, function `get_ollama_models()` (around line 30-69)

**Current Code (lines 43-53):**
```python
# Handle different response formats
models = []
if isinstance(response, dict):
    model_list = response.get('models', [])
    for model in model_list:
        # Try different key names
        if isinstance(model, dict):
            name = model.get('name') or model.get('model') or model.get('id')
            if name:
                models.append(name)
        elif isinstance(model, str):
            models.append(model)
```

**Suggested Fix:**
```python
# Handle different response formats
models = []

# Check if it's a ListResponse object (has .models attribute)
if hasattr(response, 'models'):
    model_list = response.models
    for model in model_list:
        # Model objects have a 'name' or 'model' attribute
        if hasattr(model, 'name'):
            models.append(model.name)
        elif hasattr(model, 'model'):
            models.append(model.model)
        elif isinstance(model, dict):
            name = model.get('name') or model.get('model') or model.get('id')
            if name:
                models.append(name)
        elif isinstance(model, str):
            models.append(model)
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
```

## Alternative Solution (Simpler)

You can also directly access the ListResponse object's models:

```python
def get_ollama_models():
    """Query Ollama for available models."""
    if not OLLAMA_AVAILABLE:
        return ["llama3.2:3b"]  # Fallback default

    try:
        response = ollama.list()

        # Debug: print the response structure
        print(f"🔍 DEBUG: Ollama response type: {type(response)}")

        # ListResponse has a .models attribute
        models = []
        if hasattr(response, 'models'):
            print(f"🔍 DEBUG: Found {len(response.models)} model entries")
            for model in response.models:
                # Each model has a 'name' attribute
                name = getattr(model, 'name', None) or getattr(model, 'model', None)
                if name:
                    models.append(name)

        print(f"🔍 DEBUG: Extracted model names: {models}")

        # Filter for common chat models (exclude embedding models)
        chat_models = [m for m in models if not any(x in m.lower() for x in ['embed', 'nomic'])]

        if not chat_models:
            print("⚠️ No Ollama models found. Using fallback.")
            return ["llama3.2:3b"]  # Fallback if no models found

        return sorted(chat_models)
    except Exception as e:
        print(f"⚠️ Could not query Ollama models: {e}")
        print(f"💡 TIP: Make sure Ollama is running with 'ollama serve'")
        print(f"💡 TIP: Check installed models with 'ollama list'")
        return ["llama3.2:3b"]  # Fallback to single default
```

## Expected Output After Fix

```
🔍 DEBUG: Ollama response type: <class 'ollama._types.ListResponse'>
🔍 DEBUG: Found 8 model entries
🔍 DEBUG: Extracted model names: ['llama3.2:3b', 'llama3.1:8b', 'qwen2.5:32b-instruct-q3_K_M', 'gpt-oss:120b-cloud', 'gemma3:12b', 'gpt-oss:20b', 'deepseek-r1:8b', 'qwen3:8b']
```

## Testing

After applying the fix:
1. Restart the GUI
2. Check the debug output
3. The dropdown should show all your installed models
4. Select the model you want to use for LLM review

## References

- Ollama Python library documentation: https://github.com/ollama/ollama-python
- The `ListResponse` type is defined in `ollama._types`
