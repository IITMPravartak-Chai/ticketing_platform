"""Serves the built React app (frontend/dist) from the same address as the API, so no CORS setup is needed."""
import os, hashlib
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, FileResponse
from .config import FRONTEND_DIST, log

INDEX = os.path.join(FRONTEND_DIST, "index.html")
LOGO = os.path.join(FRONTEND_DIST, "logo.png")
ASSETS = os.path.join(FRONTEND_DIST, "assets")

def _load_page():
    if not os.path.exists(INDEX):
        log.error("Frontend not built: %s is missing. Run: cd frontend && npm ci && npm run build", INDEX)
        return None
    return open(INDEX, encoding="utf-8").read()

PAGE = _load_page()
# Changes whenever the built frontend changes; open tabs compare it with /api/me and offer a reload.
BUILD = hashlib.sha1(PAGE.encode()).hexdigest()[:10] if PAGE else "nobuild"
if PAGE: PAGE = PAGE.replace("__BUILD__", BUILD)

router = APIRouter()

@router.get("/", response_class=HTMLResponse)
def index():
    if PAGE is None:
        return HTMLResponse("<h1>MLOps Service Desk</h1><p>The frontend has not been built yet. Run "
                            "<code>cd frontend &amp;&amp; npm ci &amp;&amp; npm run build</code>, then restart the server.</p>", status_code=503)
    return HTMLResponse(PAGE, headers={"Cache-Control": "no-cache"})  # browsers pick up a new version after a restart

@router.get("/logo.png", include_in_schema=False)
def logo(): return FileResponse(LOGO, media_type="image/png", headers={"Cache-Control": "no-cache"})
