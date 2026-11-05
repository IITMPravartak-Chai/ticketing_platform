"""Users & roles (admins only): list, team picker, change role, delete."""
import os
import psycopg
from fastapi import APIRouter, HTTPException, Depends
from ..bootstrap import configured_admin_emails
from ..config import ROLES, DELETED_DOMAIN
from ..db import q, tx
from ..schemas import RoleIn
from ..security import admin
from ..services.tickets import audit
from ..utils import email_list, name_from

router = APIRouter()

@router.get("/api/users")
def users(u=Depends(admin)):
    return q("""select u.id, u.name, u.email, u.role, (u.pw_hash is not null) active, u.created_at,
                  (select count(*) from tickets t where t.assignee_id=u.id and t.status<>'CLOSED') owned_open
                from users u where u.deleted_at is null order by array_position(array['admin','engineer','user'], u.role), u.name""")

@router.get("/api/team")
def team(u=Depends(admin)):
    # People the admin can pick when assigning: only TEAM_EMAILS from .env. Names come from their account once they sign up.
    emails = email_list(os.environ.get("TEAM_EMAILS", ""))
    known = {x["email"]: x["name"] for x in q("select email, name from users where email = any(%s)", (emails,))}
    return [{"email": e, "name": known.get(e) or name_from(e)} for e in emails]
@router.post("/api/users/{uid}/role")
def set_role(uid: int, b: RoleIn, u=Depends(admin)):
    if b.role not in ROLES: raise HTTPException(400, "Invalid role")
    if uid == u["id"]: raise HTTPException(400, "You cannot change your own role")
    with tx() as c:
        x = c.execute("select id, email, role from users where id=%s and deleted_at is null for update", (uid,)).fetchone()
        if not x: raise HTTPException(404, "User not found")
        if x["role"] == b.role: return {"ok": True}
        if b.role != "admin" and x["email"] in configured_admin_emails():
            raise HTTPException(400, f"{x['email']} is listed in ADMIN_EMAILS, so it would become an admin again on the next restart. Remove it from .env first.")
        if b.role == "user":
            n = c.execute("select count(*) c from tickets where assignee_id=%s and status<>'CLOSED'", (uid,)).fetchone()["c"]
            if n: raise HTTPException(400, f"{x['email']} still owns {n} open ticket(s). Reassign them first.")
        c.execute("update users set role=%s, updated_at=now() where id=%s", (b.role, uid))
        audit(c, u["id"], "ROLE_CHANGED", x["email"], f"{x['role']} -> {b.role}")
    return {"ok": True}

@router.delete("/api/users/{uid}")
def delete_user(uid: int, u=Depends(admin)):
    # Accounts with no tickets, comments or history are removed completely. Accounts with history are anonymised instead:
    # they can no longer sign in, their email is freed (they can register again), and their name stays on old tickets.
    if uid == u["id"]: raise HTTPException(400, "You cannot delete your own account")
    with tx() as c:
        x = c.execute("select id, name, email, role from users where id=%s and deleted_at is null for update", (uid,)).fetchone()
        if not x: raise HTTPException(404, "User not found")
        if x["email"] in configured_admin_emails():
            raise HTTPException(400, f"{x['email']} is listed in ADMIN_EMAILS, so it would be created again on the next restart. Remove it from .env first.")
        n = c.execute("select count(*) c from tickets where assignee_id=%s and status<>'CLOSED'", (uid,)).fetchone()["c"]
        if n: raise HTTPException(400, f"{x['email']} still owns {n} open ticket(s). Reassign them first.")
        try:
            with c.transaction():  # savepoint: a foreign-key error only undoes this delete
                c.execute("delete from users where id=%s", (uid,))
            how = "deleted"
        except psycopg.errors.ForeignKeyViolation:
            c.execute("""update users set name=%s, email=%s, pw_hash=null, role='user', deleted_at=now(), updated_at=now() where id=%s""",
                      (f"{x['name']} (deleted)", f"deleted-{uid}@{DELETED_DOMAIN}", uid))
            c.execute("delete from notifications where user_id=%s", (uid,))
            how = "anonymised"
        audit(c, u["id"], "USER_DELETED", x["email"], f"{x['name']} ({x['role']}) " + ("removed" if how == "deleted" else "deleted; kept on old tickets as a deleted user"))
    return {"ok": True, "how": how}
