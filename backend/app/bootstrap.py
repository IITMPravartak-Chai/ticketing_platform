"""Startup work: connect to PostgreSQL, apply the schema, and create the admins and users listed in .env."""
import os, re
from .config import DATABASE_URL, ROLES, EMAIL_RE, log
from .utils import name_from, safe_url
from .db import pool, SCHEMA, tx, run
from .security import DEFAULT_ADMIN_PW, hash_pw, check_pw
from .services.tickets import audit

def start_db():
    try:
        pool.open(wait=True, timeout=15)
    except Exception as ex:
        log.error("Cannot connect to PostgreSQL at %s (%s). Start it with: docker compose up -d", safe_url(DATABASE_URL), ex)
        raise RuntimeError("PostgreSQL is not reachable") from None
    with tx() as c:
        c.execute(SCHEMA)
        admins = ensure_admins(c)
        ensure_users(c)
    log.info("Connected to PostgreSQL at %s", safe_url(DATABASE_URL))
    return admins

def configured_admin_emails():
    # ADMIN_EMAILS (comma-separated) plus the older single ADMIN_EMAIL, trimmed, lowercased, de-duplicated
    raw = re.split(r"[,;\s]+", f"{os.environ.get('ADMIN_EMAILS', '')},{os.environ.get('ADMIN_EMAIL', '')}")
    out = []
    for e in (x.strip().lower() for x in raw if x.strip()):
        if not EMAIL_RE.match(e): log.error("Ignoring invalid admin email in ADMIN_EMAILS/ADMIN_EMAIL: %r", e)
        elif e not in out: out.append(e)
    return out
def configured_users():
    # USER_ACCOUNTS=Name|email|password,Name|email|password  ->  [(name, email, password)]; bad entries are logged and skipped
    out = []
    for item in (x.strip() for x in os.environ.get("USER_ACCOUNTS", "").split(",") if x.strip()):
        parts = [x.strip() for x in item.split("|")]
        if len(parts) != 3 or not parts[0]:
            log.error("Ignoring USER_ACCOUNTS entry %r: use Name|email|password", item.split("|")[0]); continue
        name, email, pw = parts[0], parts[1].lower(), parts[2]
        if not EMAIL_RE.match(email): log.error("Ignoring USER_ACCOUNTS entry for %r: invalid email", name)
        elif len(pw) < 8: log.error("Ignoring USER_ACCOUNTS entry for %s: password must be at least 8 characters", email)
        elif email not in (e for _, e, _ in out): out.append((name, email, pw))
    return out
def ensure_users(c):
    # Runs on every start: creates the USER_ACCOUNTS people who don't have an account yet. Never changes an existing
    # account (name, role or password); an invited account without a password is activated with the configured one.
    admins = configured_admin_emails()
    for name, email, pw in configured_users():
        if email in admins: continue  # ADMIN_EMAILS wins
        x = c.execute("select id, pw_hash, deleted_at from users where email=%s for update", (email,)).fetchone()
        if not x:
            c.execute("insert into users(name,email,pw_hash,role) values(%s,%s,%s,'user')", (name, email, hash_pw(pw)))
            audit(c, None, "USER_CREATED", email, f"{name} created from USER_ACCOUNTS")
            log.info("Created user account %s (%s) from USER_ACCOUNTS", email, name)
        elif not x["pw_hash"] and not x["deleted_at"]:
            c.execute("update users set pw_hash=%s, updated_at=now() where id=%s", (hash_pw(pw), x["id"]))
            audit(c, None, "USER_ACTIVATED", email, "Password set from USER_ACCOUNTS")
            log.info("Activated invited account %s from USER_ACCOUNTS", email)
def ensure_admins(c):
    # Runs on every start (and with --ensure-admins). Every configured email ends up as an admin:
    # existing accounts are promoted, missing ones are created. Existing passwords are never changed,
    # and admins who are not listed are left alone.
    pw = os.environ.get("ADMIN_PASSWORD", "")
    for e in configured_admin_emails():
        x = c.execute("select id, role from users where email=%s for update", (e,)).fetchone()
        if not x:
            # Without ADMIN_PASSWORD the account is created without a password; the owner activates it
            # with "Create account" (a code is emailed to that address) and keeps the admin role.
            c.execute("insert into users(name,email,pw_hash,role) values(%s,%s,%s,'admin')", (name_from(e), e, hash_pw(pw) if pw else None))
            audit(c, None, "ADMIN_CREATED", e, "Created from ADMIN_EMAILS" + ("" if pw else " without a password; activate with Create account"))
            log.info("Created admin account %s%s", e, "" if pw else " (no password yet: activate it with 'Create account')")
        elif x["role"] != "admin":
            c.execute("update users set role='admin', updated_at=now() where id=%s", (x["id"],))
            audit(c, None, "ROLE_CHANGED", e, f"{x['role']} -> admin (listed in ADMIN_EMAILS)")
            log.info("Promoted %s from %s to admin (listed in ADMIN_EMAILS)", e, x["role"])
    admins = c.execute("select email, pw_hash from users where role='admin' order by id").fetchall()
    if not admins:
        log.error("There is no admin account. Set ADMIN_EMAILS in .env and restart, or run: python mlops_service_desk.py --ensure-admins")
    for a in admins:
        if a["pw_hash"] and check_pw(DEFAULT_ADMIN_PW, a["pw_hash"]):
            log.warning("Admin %s still uses the default password %s. Change it now: sign in, open the profile menu (top right) > Settings > Change Password.", a["email"], DEFAULT_ADMIN_PW)
    return [a["email"] for a in admins]

def import_sqlite(path):
    # One-time copy of user accounts (with their password hashes and roles) from the old SQLite database
    import sqlite3
    s = sqlite3.connect(path); s.row_factory = sqlite3.Row
    added = 0
    for x in s.execute("select name, email, pw, role from users"):
        r = run("""insert into users(name,email,pw_hash,role) values(%s,%s,%s,%s) on conflict (email) do nothing returning id""",
                (x["name"], x["email"].lower(), x["pw"], x["role"] if x["role"] in ROLES else "user"))
        added += bool(r)
    print(f"Imported {added} user(s) from {path}. Existing emails were left unchanged.")
