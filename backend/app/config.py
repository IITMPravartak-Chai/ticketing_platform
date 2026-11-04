"""Settings from the environment (and the project-root .env file), plus the fixed lists the API validates against."""
import os, re, logging
from datetime import timedelta, timezone

# Project root: the folder that holds backend/, frontend/ and .env
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def _load_env(path):
    # Minimal .env reader so settings can live in a file next to the app; real environment variables win.
    if not os.path.exists(path): return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
_load_env(os.path.join(ROOT_DIR, ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("servicedesk")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://servicedesk:servicedesk@127.0.0.1:5434/servicedesk")
SECRET = os.environ.get("SECRET_KEY", "change-me-in-production")
SMTP = all(os.environ.get(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS"))
APP_URL = os.environ.get("APP_URL", "http://127.0.0.1:8000").rstrip("/")
HOST = os.environ.get("HOST", "127.0.0.1")  # 0.0.0.0 makes the app reachable from other machines on the network
PORT = int(os.environ.get("PORT") or 8000)
# Built React app (frontend/dist, made by "npm run build"). Docker sets this to where the image keeps it.
FRONTEND_DIST = os.environ.get("FRONTEND_DIST") or os.path.join(ROOT_DIR, "frontend", "dist")
ROLES = ["user", "engineer", "admin"]
STAT = ["NEW", "ASSIGNED", "IN PROGRESS", "ON HOLD", "CLOSED"]
ACTIVE = ["ASSIGNED", "IN PROGRESS", "ON HOLD"]
TYPES = ["Deployment Request", "Access Request", "Other"]
ENVS = ["Development", "Staging", "Production"]
DEPLOY_STATUSES = ["Successfully Deployed"]
DEP_TYPES = ["Manual", "CI/CD"]
DEP_ENVS = ["Development", "Testing", "Production"]
HOST_RE = re.compile(r"^[A-Za-z0-9]([A-Za-z0-9.\-:]{0,252})$")  # a host name, IPv4 or IPv6 address
COMMIT_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")  # failures go through /fail instead of closing the ticket
ACCESS_TYPES = ["Git Repository", "Model Endpoint", "VPN"]
ACCESS_LEVELS = ["Read only", "Read & Write", "Admin"]
ACCESS_STATUSES = ["Access Granted", "Partially Granted", "Rejected"]
EMAIL_RE = re.compile(r"^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$")
BRANCH_RE = re.compile(r"^[\w][\w./-]{0,199}$")  # Git branch names: letters, digits, _ . / - and no spaces
URL_RE = re.compile(r"^https?://\S+$")
DELETED_DOMAIN = "removed.invalid"  # deleted accounts with ticket history get deleted-<id>@removed.invalid; never emailed
# Deployment Requests can be raised only from 08:00 to 17:30 (both included, to the minute) India time. The server clock
# decides, never the browser. India has no daylight saving, so a fixed +05:30 offset is exact and needs no tzdata.
IST = timezone(timedelta(hours=5, minutes=30), "Asia/Kolkata")
DEPLOY_OPEN, DEPLOY_CLOSE = (8, 0), (17, 30)
