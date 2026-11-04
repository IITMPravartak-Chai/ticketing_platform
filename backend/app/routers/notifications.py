"""In-app notifications."""
from fastapi import APIRouter, Depends
from ..db import q, run
from ..security import user

router = APIRouter()

@router.get("/api/notifications")
def notifs(u=Depends(user)):
    return q("""select n.id, n.message, n.created_at, n.seen, t.rid from notifications n left join tickets t on t.id=n.ticket_id
                where n.user_id=%s order by n.id desc limit 100""", (u["id"],))
@router.post("/api/notifications/read")
def read(u=Depends(user)): run("update notifications set seen=true where user_id=%s and not seen", (u["id"],)); return {"ok": True}
