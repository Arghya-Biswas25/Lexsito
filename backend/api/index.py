import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

_import_error = None

try:
    from server import app
except Exception as e:
    _import_error = f"{type(e).__name__}: {e}"
    import traceback
    _import_error += "\n" + traceback.format_exc()
    from fastapi import FastAPI
    app = FastAPI()

    @app.get("/{path:path}")
    async def error_handler(path: str):
        return {"server_import_failed": True, "error": _import_error}
