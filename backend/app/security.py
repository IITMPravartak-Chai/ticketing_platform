"""Password hashing, signed tokens and the FastAPI dependencies that check who is calling."""
import json, hmac, hashlib, base64, time, secrets
from typing import Optional
from fastapi import HTTPException, Depends, Header, Request
from .config import SECRET, READ_ONLY, ADMIN_VIEW
from .db import q

# The only changes a read-only admin may make: their own password and marking their own notifications as read
READ_ONLY_WRITES = {"/api/auth/change-password", "/api/notifications/read"}

DEFAULT_ADMIN_PW = "Admin@123"  # only used to warn when an admin still has this well-known password
def hash_pw(p):
    s = secrets.token_hex(8); return s + "$" + hashlib.pbkdf2_hmac("sha256", p.encode(), s.encode(), 100000).hex()
def check_pw(p, h):
    s, x = h.split("$"); return hmac.compare_digest(x, hashlib.pbkdf2_hmac("sha256", p.encode(), s.encode(), 100000).hex())

def sign(d, ttl):
    b = base64.urlsafe_b64encode(json.dumps({**d, "exp": time.time() + ttl}).encode()).decode()
    return b + "." + hmac.new(SECRET.encode(), b.encode(), hashlib.sha256).hexdigest()
def unsign(t):
    try:
        b, s = t.split(".")
        if not hmac.compare_digest(s, hmac.new(SECRET.encode(), b.encode(), hashlib.sha256).hexdigest()): raise ValueError
        d = json.loads(base64.urlsafe_b64decode(b))
        if d["exp"] < time.time(): raise ValueError
        return d
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
def user(request: Request, authorization: Optional[str] = Header(None)):
    d = unsign((authorization or "").replace("Bearer ", ""))
    u = q("select id,name,email,role,pw_hash from users where id=%s", (d.get("uid"),), True) if d.get("p") == "auth" else None
    if not u or not u["pw_hash"]: raise HTTPException(401, "Not authenticated")
    # Every signed-in API call passes through here, so this one check blocks every write by a read-only admin,
    # whether it comes from the app, Postman or curl
    if u["role"] == READ_ONLY and request.method not in ("GET", "HEAD") and request.url.path not in READ_ONLY_WRITES:
        raise HTTPException(403, "Read-only access: you can view everything but cannot make changes")
    return u
def admin(u=Depends(user)):
    if u["role"] != "admin": raise HTTPException(403, "Admin only")
    return u
def admin_view(u=Depends(user)):
    # Admin pages that only read data: admins and read-only admins
    if u["role"] not in ADMIN_VIEW: raise HTTPException(403, "Admin only")
    return u
def resolver(u=Depends(user)):
    if u["role"] not in ("engineer", "admin"): raise HTTPException(403, "MLOps Engineers and admins only")
    return u
