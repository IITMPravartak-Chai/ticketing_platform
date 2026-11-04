"""The signed-in person: /api/me (polled by the UI) and the My Account page."""
from fastapi import APIRouter, Depends
from ..db import q
from ..security import user
from ..services.tickets import status_counts, count
from ..frontend import BUILD

router = APIRouter()

@router.get("/api/me")
def me(u=Depends(user)):
    n = q("select count(*) c from notifications where user_id=%s and not seen", (u["id"],), True)["c"]
    last = q("select message from notifications where user_id=%s and not seen order by id desc limit 1", (u["id"],), True)
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"], "unread": n,
            "latest": last["message"].split("\n")[0] if last else None, "build": BUILD}
@router.get("/api/account")
def account(u=Depends(user)):
    # The signed-in person's own account: details plus a short summary of their tickets
    x = q("select created_at, updated_at from users where id=%s", (u["id"],), True)
    d = {"name": u["name"], "email": u["email"], "role": u["role"], "joined": x["created_at"], "updated": x["updated_at"],
         "raised": status_counts("t.requester_id=%s", (u["id"],))}
    if u["role"] in ("engineer", "admin"):
        d["owned"] = status_counts("t.assignee_id=%s", (u["id"],))
        d["closed_by_me"] = count("exists(select 1 from ticket_resolutions r where r.ticket_id=t.id and r.closed_by=%s)", (u["id"],))
    return d
