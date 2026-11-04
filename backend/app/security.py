"""Password hashing, signed tokens and the FastAPI dependencies that check who is calling."""
import json, hmac, hashlib, base64, time, secrets
from typing import Optional
from fastapi import HTTPException, Depends, Header
from .config import SECRET
from .db import q

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
def user(authorization: Optional[str] = Header(None)):
    d = unsign((authorization or "").replace("Bearer ", ""))
    u = q("select id,name,email,role,pw_hash from users where id=%s", (d.get("uid"),), True) if d.get("p") == "auth" else None
    if not u or not u["pw_hash"]: raise HTTPException(401, "Not authenticated")
    return u
def admin(u=Depends(user)):
    if u["role"] != "admin": raise HTTPException(403, "Admin only")
    return u
def resolver(u=Depends(user)):
    if u["role"] not in ("engineer", "admin"): raise HTTPException(403, "MLOps Engineers and admins only")
    return u
