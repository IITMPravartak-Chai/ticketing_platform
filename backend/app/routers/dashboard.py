"""Dashboard numbers for users, MLOps Engineers and admins."""
import time
from fastapi import APIRouter, Depends
from ..config import ROLES, ADMIN_VIEW
from ..db import q
from ..security import user
from ..services.tickets import status_counts, count, FIX_OPEN, LAST_COMMENTER

router = APIRouter()

@router.get("/api/dashboard")
def dashboard(u=Depends(user)):
    uid = u["id"]
    d = {"raised": status_counts("t.requester_id=%s", (uid,)),
         "need_reply": count(f"t.requester_id=%s and t.status<>'CLOSED' and {LAST_COMMENTER}<>%s", (uid, uid)),
         "fix_needed": count(f"t.requester_id=%s and {FIX_OPEN}", (uid,))}
    if u["role"] in ("engineer", "admin"):
        d["owned"] = status_counts("t.assignee_id=%s", (uid,))
        d["owned_need_reply"] = count(f"t.assignee_id=%s and t.status<>'CLOSED' and {LAST_COMMENTER}<>%s", (uid, uid))
        d["closed_by_me"] = q("""select count(*) total, count(*) filter (where r.closed_at >= now() - interval '7 days') week,
                                    extract(epoch from avg(r.closed_at - t.created_at)) avg_s
                                 from ticket_resolutions r join tickets t on t.id=r.ticket_id where r.closed_by=%s""", (uid,), True)
    if u["role"] in ADMIN_VIEW:
        d["all"] = status_counts()
        d["kpi"] = q("""select (select count(*) from tickets where created_at >= now() - interval '7 days') created_7d,
                (select count(*) from ticket_resolutions where closed_at >= now() - interval '7 days') closed_7d,
                (select extract(epoch from avg(r.closed_at - t.created_at)) from ticket_resolutions r join tickets t on t.id=r.ticket_id) avg_resolution_s""", (), True)
        d["workload"] = q("""select u.id, u.name, u.email, u.role, (u.pw_hash is not null) active,
                  count(t.id) filter (where t.status='ASSIGNED') assigned, count(t.id) filter (where t.status='IN PROGRESS') in_progress,
                  count(t.id) filter (where t.status='ON HOLD') on_hold,
                  (select count(*) from ticket_resolutions r where r.closed_by=u.id) closed
                from users u left join tickets t on t.assignee_id=u.id and t.status<>'CLOSED'
                where u.role in ('engineer','admin') and u.deleted_at is null group by u.id
                order by count(t.id) desc, u.role='admin', u.name""")
        d["recent"] = q("""select h.id, h.action, h.from_status, h.to_status, h.detail, h.created_at, extract(epoch from h.created_at)::float ts,
                  x.name actor, t.rid, t.title, t.type, res.deploy_status
                from ticket_history h join tickets t on t.id=h.ticket_id left join users x on x.id=h.actor_id
                left join ticket_resolutions res on res.ticket_id=t.id order by h.id desc limit 15""")
        d["now"] = time.time()
        d["users"] = dict.fromkeys(ROLES, 0) | {x["role"]: x["c"] for x in q("select role, count(*) c from users where deleted_at is null group by role")}
        d["users"]["invited"] = q("select count(*) c from users where pw_hash is null and deleted_at is null", (), True)["c"]
    return d
