"""Small helpers shared by the routers: time, the deployment window, email parsing and formatting."""
import re
from datetime import datetime
from fastapi import HTTPException
from .config import IST, DEPLOY_OPEN, DEPLOY_CLOSE, EARLY_OPEN, EMAIL_RE

def ist_now(): return datetime.now(IST)
def deploy_window(now=None):
    now = (now or ist_now()).astimezone(IST); hm = (now.hour, now.minute)
    is_open = DEPLOY_OPEN <= hm <= DEPLOY_CLOSE
    when = "" if is_open else "today" if hm < DEPLOY_OPEN else "tomorrow"  # before 08:00 it opens later today
    # "early": 06:00-07:59, "late": after 17:30; the Raise Request form shows a matching popup after saving
    period = "early" if EARLY_OPEN <= hm < DEPLOY_OPEN else "late" if hm > DEPLOY_CLOSE else ""
    return {"open": is_open, "reopens": when, "period": period, "opens": "8:00 AM", "closes": "5:30 PM", "tz": "Asia/Kolkata",
            "now": now.isoformat(timespec="seconds"), "now_ms": int(now.timestamp() * 1000)}

def fmt(d): return d.astimezone().strftime("%b %d, %Y %I:%M %p")
def clean_email(e):
    e = (e or "").strip().lower()
    if not EMAIL_RE.match(e): raise HTTPException(400, f"Invalid email address: {e or '(empty)'}")
    return e
def email_list(s): return list(dict.fromkeys(clean_email(x) for x in re.split(r"[,;\s]+", s or "") if x.strip()))
def name_from(e): return " ".join(p.capitalize() for p in re.split(r"[._-]+", e.split("@")[0]) if p) or e
def safe_url(u): return re.sub(r"//([^:/@]+):[^@]*@", r"//\1:***@", u)
