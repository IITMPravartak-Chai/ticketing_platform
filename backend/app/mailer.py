"""Email (SMTP), in-app notifications and one-time verification codes."""
import os, smtplib, secrets
from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage
from fastapi import HTTPException
from .config import SMTP, DELETED_DOMAIN
from .db import q, run

def mail(to, subject, body):
    # Returns None when sent, otherwise the reason it was not sent
    print(f"\n--- EMAIL to {to} | {subject}\n{body}\n---", flush=True)
    if not SMTP: return "email is not set up (fill in SMTP_HOST, SMTP_USER and SMTP_PASS in .env, then restart)"
    try:
        m = EmailMessage(); m["To"] = to; m["Subject"] = subject
        m["From"] = os.environ.get("SMTP_FROM") or os.environ["SMTP_USER"]; m.set_content(body)
        host, port = os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT") or 587)
        with (smtplib.SMTP_SSL(host, port, timeout=20) if port == 465 else smtplib.SMTP(host, port, timeout=20)) as s:
            if port != 465: s.starttls()
            s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"]); s.send_message(m)
        print(f"Mail sent to {to}", flush=True)
        return None
    except Exception as ex:
        print("Mail failed:", ex, flush=True)
        return str(ex)
mailer = ThreadPoolExecutor(max_workers=4, thread_name_prefix="mail")
def notify(email, ticket_id, msg, subject, wait=False):
    # In-app notification when the address has an account, plus an email either way.
    # Emails go out in the background so a button press doesn't wait on the mail server; wait=True returns the send error.
    if email.endswith("@" + DELETED_DOMAIN): return None
    x = q("select id from users where email=%s", (email,), True)
    if x: run("insert into notifications(user_id,ticket_id,message) values(%s,%s,%s)", (x["id"], ticket_id, msg))
    if wait: return mail(email, subject, msg)
    mailer.submit(mail, email, subject, msg)
def admin_emails(): return [a["email"] for a in q("select email from users where role='admin' and pw_hash is not null")]
OTP_TRIES, OTP_GAP_S = 5, 30
def send_otp(email, name, purpose):
    # A code was sent less than 30 s ago: don't let anyone flood an inbox with codes
    if q("select 1 from otps where email=%s and expires_at > now() + make_interval(secs => %s)", (email, 600 - OTP_GAP_S), True):
        raise HTTPException(429, f"A code was just sent. Please wait {OTP_GAP_S} seconds before asking for another.")
    code = f"{secrets.randbelow(1000000):06d}"
    run("""insert into otps(email,code,name,purpose,expires_at) values(%s,%s,%s,%s,now()+interval '10 minutes')
           on conflict (email) do update set code=excluded.code, name=excluded.name, purpose=excluded.purpose,
             expires_at=excluded.expires_at, attempts=0""",
        (email, code, name, purpose))
    err = mail(email, "Your verification code", f"Your 6-digit verification code is {code}. It expires in 10 minutes.")
    if SMTP and err: raise HTTPException(502, f"Could not send the verification email: {err}")
    return {"ok": True, "dev_code": None if SMTP else code}
