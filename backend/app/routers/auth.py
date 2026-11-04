"""Sign-up with an emailed code, password reset, login and password change."""
from fastapi import APIRouter, HTTPException, Depends
from ..db import q, run, tx
from ..mailer import send_otp, OTP_TRIES
from ..schemas import RegIn, EmailIn, VerIn, PwIn, ChangePwIn, LoginIn
from ..security import hash_pw, check_pw, sign, unsign, user
from ..utils import clean_email

router = APIRouter()

@router.post("/api/auth/register")
def register(b: RegIn):
    e, name = clean_email(b.email), b.name.strip()
    if not name: raise HTTPException(400, "Enter your name")
    x = q("select pw_hash from users where email=%s", (e,), True)
    if x and x["pw_hash"]: raise HTTPException(400, "Email already registered. Please login.")
    return send_otp(e, name, "register")
@router.post("/api/auth/forgot")
def forgot(b: EmailIn):
    e = clean_email(b.email); u = q("select name from users where email=%s", (e,), True)
    if not u: raise HTTPException(404, "No account found for that email")
    return send_otp(e, u["name"], "reset")
@router.post("/api/auth/resend")
def resend(b: EmailIn):
    o = q("select * from otps where email=%s", (b.email.strip().lower(),), True)
    if not o: raise HTTPException(400, "Start again")
    return send_otp(o["email"], o["name"], o["purpose"])
@router.post("/api/auth/verify")
def verify(b: VerIn):
    e = b.email.strip().lower()
    o = q("select *, expires_at > now() valid from otps where email=%s", (e,), True)
    if o and o["attempts"] >= OTP_TRIES: raise HTTPException(400, "Too many wrong codes. Use Resend Code to get a new one.")
    if not o or o["code"] != b.code.strip() or not o["valid"]:
        if o: run("update otps set attempts=attempts+1 where email=%s", (e,))  # stops someone guessing all million codes
        raise HTTPException(400, "Invalid or expired code")
    run("delete from otps where email=%s", (e,))
    return {"ticket": sign({"p": "setpw", "email": e, "name": o["name"], "purpose": o["purpose"]}, 900)}
@router.post("/api/auth/set-password")
def set_password(b: PwIn):
    d = unsign(b.ticket)
    if d.get("p") != "setpw": raise HTTPException(401, "Invalid ticket")
    if len(b.password) < 8: raise HTTPException(400, "Password must be at least 8 characters")
    with tx() as c:
        x = c.execute("select id, pw_hash from users where email=%s for update", (d["email"],)).fetchone()
        if d["purpose"] == "reset":
            if not x: raise HTTPException(404, "No account found for that email")
            c.execute("update users set pw_hash=%s, updated_at=now() where id=%s", (hash_pw(b.password), x["id"]))
        elif x and x["pw_hash"]: raise HTTPException(400, "Already registered. Please login.")
        elif x:  # invited when a ticket was assigned to this email; activating keeps their role
            c.execute("update users set pw_hash=%s, name=%s, updated_at=now() where id=%s", (hash_pw(b.password), d["name"], x["id"]))
        else:
            c.execute("insert into users(name,email,pw_hash) values(%s,%s,%s)", (d["name"], d["email"], hash_pw(b.password)))
    return {"ok": True}
@router.post("/api/auth/login")
def login(b: LoginIn):
    u = q("select id,pw_hash from users where email=%s", (b.email.strip().lower(),), True)
    if u and not u["pw_hash"]: raise HTTPException(400, "This account isn't activated yet. Use 'Create account' with this email to set a password.")
    if not u or not check_pw(b.password, u["pw_hash"]): raise HTTPException(400, "Invalid email or password")
    return {"token": sign({"p": "auth", "uid": u["id"]}, 7 * 86400)}
@router.post("/api/auth/change-password")
def change_password(b: ChangePwIn, u=Depends(user)):
    # Signed-in users change their own password; works for accounts without a real mailbox (e.g. admin@example.com)
    if not check_pw(b.current, u["pw_hash"]): raise HTTPException(400, "Current password is wrong")
    if len(b.password) < 8: raise HTTPException(400, "New password must be at least 8 characters")
    if b.password == b.current: raise HTTPException(400, "New password must be different from the current one")
    run("update users set pw_hash=%s, updated_at=now() where id=%s", (hash_pw(b.password), u["id"]))
    return {"ok": True}
