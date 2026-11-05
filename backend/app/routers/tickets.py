"""Tickets: lists, details, attachments, and every workflow action (create, comment, assign, start, hold, resume,
close, fail, resubmit)."""
import time, base64
from datetime import datetime
import psycopg
from psycopg.types.json import Jsonb
from fastapi import APIRouter, HTTPException, Depends
from ..config import (TYPES, ENVS, ACTIVE, DEPLOY_STATUSES, ACCESS_STATUSES, DEP_ENVS, URL_RE, BRANCH_RE, log)
from ..db import q, tx
from ..mailer import notify, admin_emails
from ..schemas import ReqIn, CmtIn, AsgIn, HoldIn, CloseIn, FailIn, ResubmitIn
from ..security import user, admin, resolver
from ..services.tickets import (fetch, get_ticket, lock, must_own, hist, audit, link, ticket_text, listing,
                                parse_images, parse_pdfs, parse_access, parse_deployment, SHOT_TYPES)
from ..utils import deploy_window, clean_email, email_list, name_from, fmt

router = APIRouter()

@router.get("/api/requests")
def my_requests(s: str = "ALL", u=Depends(user)): return listing("t.requester_id=%s", [u["id"]], s)
@router.get("/api/assigned")
def assigned(s: str = "ALL", u=Depends(resolver)): return listing("t.assignee_id=%s", [u["id"]], s)
@router.get("/api/queue")
def queue(s: str = "ALL", u=Depends(admin)): return listing("true", [], s)
@router.get("/api/requests/{rid}")
def detail(rid: str, u=Depends(user)):
    t = get_ticket(rid, u)
    hist_rows = q("""select h.*, x.name actor from ticket_history h left join users x on x.id=h.actor_id
                     where h.ticket_id=%s order by h.id""", (t["id"],))
    ts = {}
    for h in hist_rows:
        if h["to_status"]: ts.setdefault(h["to_status"], h["created_at"])
    cm = q("""select m.author_id, m.body, m.created_at, x.name, x.role from comments m join users x on x.id=m.author_id
              where m.ticket_id=%s order by m.id""", (t["id"],))
    imgs = q("select id, name from ticket_images where ticket_id=%s and bug_id is null order by id", (t["id"],))
    bugs = q("""select b.id, b.description, b.reported_at, b.fix_notes, b.fixed_at, x.name reported_by_name, y.name fixed_by_name,
                  coalesce((select json_agg(json_build_object('id', i.id, 'name', i.name) order by i.id) from ticket_images i where i.bug_id=b.id), '[]') images
                from deploy_bugs b join users x on x.id=b.reported_by left join users y on y.id=b.fixed_by where b.ticket_id=%s order by b.id""", (t["id"],))
    files = q("select id, name from ticket_files where ticket_id=%s order by id", (t["id"],))
    creds = q("""select vpn_user, vpn_password, api_key from ticket_resolutions
                 where ticket_id=%s and (vpn_user<>'' or api_key<>'')""", (t["id"],), True)
    # Exact times (epoch seconds) for the tracker's step-to-step durations, plus total time spent ON HOLD
    tse, hold, hold_from = {}, 0.0, None
    for h in q("""select from_status, to_status, extract(epoch from created_at)::float at from ticket_history
                  where ticket_id=%s and to_status is not null order by id""", (t["id"],)):
        tse.setdefault(h["to_status"], h["at"])
        if h["to_status"] == "ON HOLD" and h["from_status"] != "ON HOLD": hold_from = h["at"]
        elif hold_from is not None and h["to_status"] != "ON HOLD": hold += h["at"] - hold_from; hold_from = None
    now = time.time()
    if hold_from is not None: hold += now - hold_from
    return {**t, "history": hist_rows, "comments": cm, "images": imgs, "files": files, "creds": creds, "bugs": bugs,
            "deployment": q("select id, deployment_type, app_name, environment from deployment_records where ticket_id=%s", (t["id"],), True) if u["role"] == "admin" else None, "ts": ts, "tse": tse, "hold_secs": hold, "now": now,
            "is_owner": t["assignee_id"] == u["id"]}
@router.get("/api/requests/{rid}/images/{iid}")
def image(rid: str, iid: int, u=Depends(user)):
    t = get_ticket(rid, u)  # same access rule as the ticket itself
    x = q("select name, mime, data from ticket_images where id=%s and ticket_id=%s", (iid, t["id"]), True)
    if not x: raise HTTPException(404, "Image not found")
    return {"name": x["name"], "src": f"data:{x['mime']};base64," + base64.b64encode(x["data"]).decode()}
@router.get("/api/requests/{rid}/files/{fid}")
def pdf_file(rid: str, fid: int, u=Depends(user)):
    t = get_ticket(rid, u)  # same access rule as the ticket itself
    x = q("select name, data from ticket_files where id=%s and ticket_id=%s", (fid, t["id"]), True)
    if not x: raise HTTPException(404, "File not found")
    return {"name": x["name"], "src": "data:application/pdf;base64," + base64.b64encode(x["data"]).decode()}


@router.post("/api/requests")
def create(b: ReqIn, u=Depends(user)):
    # Deployment Requests are accepted at any time. One sent 06:00-07:59 ("early") or after 17:30 ("late") India time
    # (server clock) is flagged, so the requester sees the matching popup and the team sees it in the history and email.
    w = deploy_window()
    period = w["period"] if b.type == "Deployment Request" else ""
    after_hours = period == "late"
    note = {"early": ("submitted before 8:00 AM, before deployment hours", "Submitted before 8:00 AM (before the 8:00 AM - 5:30 PM deployment hours)."),
            "late": ("submitted after 5:30 PM, outside deployment hours", "Submitted after 5:30 PM (outside the 8:00 AM - 5:30 PM deployment hours).")}.get(period)
    title, desc, repo, pr, branch = b.title.strip(), b.description.strip(), b.repo.strip(), b.pr_url.strip(), b.branch.strip()
    if not title or not desc: raise HTTPException(400, "Title and description are required")
    if len(title) > 200: raise HTTPException(400, "Title must be 200 characters or fewer")
    if b.type not in TYPES or b.env not in ENVS: raise HTTPException(400, "Invalid type or environment")
    access = None
    if b.type == "Access Request":
        repo, pr, access = "", "", parse_access(b.access, u)
    elif b.type == "Other":
        repo, pr = "", ""  # general requests have no repository or pull request
    else:
        if not repo or not pr: raise HTTPException(400, "Repository URL and Pull Request URL are required")
        if not URL_RE.match(repo): raise HTTPException(400, "Repository URL must start with http:// or https://")
        if not URL_RE.match(pr): raise HTTPException(400, "Pull Request URL must start with http:// or https://")
    if b.type == "Deployment Request":
        if not branch: raise HTTPException(400, "Branch name is required for a Deployment Request")
        if not BRANCH_RE.match(branch): raise HTTPException(400, "Branch name can only use letters, numbers and _ . / - (no spaces)")
    else:
        branch = ""
    images = parse_images(b.images) if b.type in SHOT_TYPES else []
    with tx() as c:
        t = c.execute("""insert into tickets(title,description,type,env,repo,branch,pr_url,access,requester_id)
                         values(%s,%s,%s,%s,%s,%s,%s,%s,%s) returning id, rid""",
                      (title, desc, b.type, b.env, repo, branch, pr, Jsonb(access) if access else None, u["id"])).fetchone()
        for name, mime, data in images:
            c.execute("insert into ticket_images(ticket_id,name,mime,data) values(%s,%s,%s,%s)", (t["id"], name, mime, data))
        hist(c, t["id"], "CREATED", u["id"], f"Created by {u['name']} <{u['email']}>"
             + (f" with {len(images)} screenshot(s)" if images else "")
             + (f" ({note[0]})" if note else ""), None, "NEW")
    if note: log.info("Deployment Request %s from %s %s, at %s IST", t["rid"], u["email"], note[0], w["now"])
    t = fetch(t["rid"])
    when = note[1] + "\n" if note else ""
    for e in admin_emails():
        notify(e, t["id"], f"New ticket {t['rid']} is waiting to be assigned.\n{when}\n{ticket_text(t)}", f"[{t['rid']}] New ticket: {title}")
    return {"rid": t["rid"], "status": "NEW", "period": period, "after_hours": after_hours}
@router.post("/api/requests/{rid}/comments")
def comment(rid: str, b: CmtIn, u=Depends(user)):
    t = get_ticket(rid, u); body = b.body.strip()
    if t["status"] == "CLOSED": raise HTTPException(400, "Ticket is closed")
    if not body: raise HTTPException(400, "Message is empty")
    with tx() as c:
        c.execute("insert into comments(ticket_id,author_id,body) values(%s,%s,%s)", (t["id"], u["id"], body))
        hist(c, t["id"], "COMMENTED", u["id"], body if len(body) <= 120 else body[:117] + "...")
    msg = f"{u['name']} replied on {rid}:\n{body}\n\nOpen ticket: {link(rid)}"
    for e in sorted({t["remail"], t["aemail"], *admin_emails()} - {None, u["email"]}):
        notify(e, t["id"], msg, f"[{rid}] New reply")
    return {"ok": True}

def _assign(rid, u, email, cc):
    t = get_ticket(rid, u)
    e = clean_email(email); cc_list = [x for x in email_list(cc) if x != e]
    with tx() as c:
        cur = lock(c, t)
        if cur["status"] == "CLOSED": raise HTTPException(400, "Ticket is already closed")
        tgt = c.execute("select id,name,email,role,deleted_at from users where email=%s for update", (e,)).fetchone()
        if tgt and tgt["deleted_at"]: raise HTTPException(400, f"{e} belongs to a deleted account and cannot own tickets")
        if not tgt:  # person without an account: create an invited engineer they can activate with "Create account"
            tgt = c.execute("insert into users(name,email,role) values(%s,%s,'engineer') returning id,name,email,role", (name_from(e), e)).fetchone()
            audit(c, u["id"], "USER_INVITED", e, f"Invited as engineer when {rid} was assigned")
        elif tgt["role"] == "user":
            c.execute("update users set role='engineer', updated_at=now() where id=%s", (tgt["id"],))
            audit(c, u["id"], "ROLE_CHANGED", e, f"user -> engineer (assigned {rid})")
        if cur["assignee_id"] == tgt["id"]: raise HTTPException(400, f"{rid} is already owned by {e}")
        self_take = tgt["id"] == u["id"]
        # A deployment waiting for a bug fix stays ON HOLD with its new owner; Resubmit for Redeployment moves it on
        waiting = c.execute("select 1 from deploy_bugs where ticket_id=%s and fixed_at is null", (t["id"],)).fetchone()
        to = "ON HOLD" if waiting else "ASSIGNED"
        c.execute("""update tickets set assignee_id=%s, ownership=%s, assigned_by=%s, assigned_at=now(), cc=%s, status=%s,
                     updated_at=now() where id=%s""", (tgt["id"], "owned" if self_take else "assigned", u["id"], ",".join(cc_list), to, t["id"]))
        detail = (f"{u['name']} <{u['email']}> took ownership" if self_take else
                  f"Assigned to {tgt['name']} <{e}> by {u['name']}")
        if t["assignee_id"]: detail += f" (previous owner: {t['aname']} <{t['aemail']}>)"
        if cc_list: detail += "; also notified " + ", ".join(cc_list)
        action = "OWNERSHIP_TAKEN" if self_take else ("REASSIGNED" if cur["assignee_id"] else "ASSIGNED")
        hist(c, t["id"], action, u["id"], detail, cur["status"], to)
    old, t = t["aemail"], fetch(rid)
    err = None
    if not self_take:
        err = notify(e, t["id"], f"Hi {t['aname']},\n\n{u['name']} has assigned ticket {rid} to you. You are now responsible for "
                     f"resolving and closing it.\n\n{ticket_text(t)}\n\nSign in with {e} to work on it. "
                     f"No account yet? Use 'Create account' with this email.", f"[{rid}] Assigned to you: {t['title']}", wait=True)
    for x in cc_list: notify(x, t["id"], f"Ticket {rid} is now owned by {t['aname']} <{e}>.\n\n{ticket_text(t)}", f"[{rid}] Ticket assigned: {t['title']}")
    if old and old != e: notify(old, t["id"], f"Ticket {rid} is now owned by {t['aname']} <{e}>. You no longer need to work on it.", f"[{rid}] Reassigned")
    if t["remail"] not in (e, u["email"]):
        notify(t["remail"], t["id"], f"{rid} is now owned by {t['aname']}" + (" (MLOps)." if self_take else "."), f"[{rid}] Ticket assigned")
    return {"ok": True, "email_error": err}
@router.post("/api/requests/{rid}/assign")
def assign(rid: str, b: AsgIn, u=Depends(admin)): return _assign(rid, u, b.email, b.cc)
@router.post("/api/requests/{rid}/take-ownership")
def take_ownership(rid: str, u=Depends(admin)):
    t = get_ticket(rid, u); return _assign(rid, u, u["email"], t["cc"])

def _transition(rid, u, allowed, to, detail):
    t = get_ticket(rid, u)
    with tx() as c:
        cur = lock(c, t); must_own(cur, t, u)
        if cur["status"] not in allowed: raise HTTPException(400, f"This ticket is {cur['status']}, so it cannot be moved to {to}")
        c.execute("update tickets set status=%s, updated_at=now() where id=%s", (to, t["id"]))
        hist(c, t["id"], "STATUS_CHANGED", u["id"], detail, cur["status"], to)
    if t["remail"] != u["email"]: notify(t["remail"], t["id"], f"{rid} is now {to}: {detail}", f"[{rid}] Status: {to}")
    return {"status": to}
@router.post("/api/requests/{rid}/start")
def start(rid: str, u=Depends(user)):
    if get_ticket(rid, u)["fix_open"]: raise HTTPException(400, "This deployment is waiting for a bug fix. Use Resubmit for Redeployment once it is fixed.")
    return _transition(rid, u, ["ASSIGNED"], "IN PROGRESS", f"Work started by {u['name']}")
@router.post("/api/requests/{rid}/hold")
def hold(rid: str, b: HoldIn, u=Depends(user)):
    if not b.reason.strip(): raise HTTPException(400, "Give a reason for putting the ticket on hold")
    return _transition(rid, u, ["IN PROGRESS"], "ON HOLD", f"Put on hold by {u['name']}: {b.reason.strip()}")
@router.post("/api/requests/{rid}/resume")
def resume(rid: str, u=Depends(user)):
    if get_ticket(rid, u)["fix_open"]: raise HTTPException(400, "This deployment is waiting for a bug fix. Use Resubmit for Redeployment once it is fixed.")
    return _transition(rid, u, ["ON HOLD"], "IN PROGRESS", f"Work resumed by {u['name']}")
@router.post("/api/requests/{rid}/close")
def close(rid: str, b: CloseIn, u=Depends(user)):
    t = get_ticket(rid, u)
    acc = t["type"] == "Access Request"  # access tickets record the access outcome; the URL is optional
    dep = None
    if t["type"] == "Deployment Request":  # needs the deployment details form, filled by an MLOps Engineer or admin
        if u["role"] not in ("engineer", "admin"): raise HTTPException(403, "Only MLOps Engineers and admins can record a deployment")
        key = b.idem.strip()[:80]
        if key and q("select 1 from deployment_records where ticket_id=%s and idempotency_key=%s", (t["id"], key), True):
            return {"ok": True, "duplicate": True}  # the same form was already saved (a retried submit): nothing new is created
        if not key: raise HTTPException(400, "Missing submission key; reload the page and try again")
        dep = parse_deployment(b.deployment)
        b.deployed_at, b.deploy_url, b.version, b.env, b.notes = dep["deployed_at"].isoformat(), dep["app_url"], dep["version"], dep["environment"], ""
    if b.deploy_status not in (ACCESS_STATUSES if acc else DEPLOY_STATUSES): raise HTTPException(400, "Choose a status")
    if b.env not in (DEP_ENVS if dep else ENVS): raise HTTPException(400, "Choose an environment")
    if t["fix_open"]: raise HTTPException(400, "This deployment is waiting for a bug fix. Resubmit it for redeployment first.")
    missing = [n for n, v in (("date/time", b.deployed_at), *((("access given", b.notes),) if acc else (("deployment URL", b.deploy_url),))) if not v.strip()]
    if missing: raise HTTPException(400, "Please fill in: " + ", ".join(missing))
    url = b.deploy_url.strip()
    if url and not URL_RE.match(url): raise HTTPException(400, "URL must start with http:// or https://")
    try: deployed = datetime.fromisoformat(b.deployed_at.strip()).astimezone()  # browser sends local time without a zone
    except ValueError: raise HTTPException(400, "Enter a valid date/time")
    issues = b.issues.strip() or "None"
    vpn = acc and (t["access"] or {}).get("type") == "VPN" and b.deploy_status != "Rejected"
    vuser, vpw = (b.vpn_user.strip(), b.vpn_password.strip()) if vpn else ("", "")
    if vpn and not (vuser and vpw): raise HTTPException(400, "Enter the VPN username and password for the user")
    ep = acc and (t["access"] or {}).get("type") == "Model Endpoint" and b.deploy_status != "Rejected"
    key = b.api_key.strip() if ep else ""
    if ep and not url: raise HTTPException(400, "Enter the model endpoint URL for the user")
    pdfs = parse_pdfs(b.files) if acc else []
    with tx() as c:
        cur = lock(c, t); must_own(cur, t, u)
        if cur["status"] not in ACTIVE: raise HTTPException(400, f"This ticket is {cur['status']}, so it cannot be closed")
        c.execute("""insert into ticket_resolutions(ticket_id,deploy_status,deployed_at,notes,issues,resolution,deploy_url,version,environment,closed_by,vpn_user,vpn_password,api_key)
                     values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                  (t["id"], b.deploy_status, deployed, b.notes.strip(), issues, b.resolution.strip(), url, b.version.strip(), b.env, u["id"], vuser, vpw, key))
        for name, data in pdfs:
            c.execute("insert into ticket_files(ticket_id,name,data) values(%s,%s,%s)", (t["id"], name, data))
        if dep:  # same transaction as the closure: both are saved, or neither
            try:
                with c.transaction():
                    c.execute("""insert into deployment_records(ticket_id,deployment_type,app_name,app_url,server_name,server_ip,environment,method,
                                   deployed_at,status,version,notes,manual_steps,cicd_tool,pipeline_name,pipeline_run_id,repo_url,commit_id,
                                   deployed_by,deployed_by_role,idempotency_key)
                                 values(%(tid)s,%(deployment_type)s,%(app_name)s,%(app_url)s,%(server_name)s,%(server_ip)s,%(environment)s,%(method)s,
                                   %(deployed_at)s,%(status)s,%(version)s,%(notes)s,%(manual_steps)s,%(cicd_tool)s,%(pipeline_name)s,%(pipeline_run_id)s,
                                   %(repo_url)s,%(commit_id)s,%(by)s,%(role)s,%(key)s)""",
                              {**dep, "tid": t["id"], "status": b.deploy_status, "by": u["id"], "role": u["role"], "key": b.idem.strip()[:80]})
            except psycopg.errors.UniqueViolation:
                raise HTTPException(409, "A deployment record for this ticket was already submitted")
            audit(c, u["id"], "DEPLOYMENT_RECORDED", rid, f"{dep['deployment_type']} deployment of {dep['app_name']} to {dep['environment']} recorded by {u['name']} ({u['role']})")
        c.execute("update tickets set status='CLOSED', updated_at=now() where id=%s", (t["id"],))
        hist(c, t["id"], "CLOSED", u["id"], f"Closed by {u['name']} <{u['email']}>. "
             + (f"{b.deploy_status} at {fmt(deployed)}." + (f" {len(pdfs)} PDF(s) attached." if pdfs else "") if acc else f"Deployment {b.deploy_status} at {fmt(deployed)}. URL: {url}"),
             cur["status"], "CLOSED")
    if acc:
        a = t["access"] or {}
        msg = (f"Access request {rid} has been closed by {u['name']} <{u['email']}>.\n\nTitle: {t['title']}\nResult: {b.deploy_status}\n"
               f"Access To: {a.get('type', '-')} - {a.get('resource', '-')}\nAccess Level: {a.get('level') or '-'}\n"
               f"Access For: {a.get('for', '-')}\nCompleted At: {fmt(deployed)}\n" + (f"{'Model Endpoint URL' if ep else 'Link'}: {url}\n" if url else "")
               + (f"VPN Username: {vuser}\nThe VPN password is not sent by email. Sign in and open the ticket to see it.\n" if vpn else "")
               + ("The API key is not sent by email. Sign in and open the ticket to see it.\n" if key else "")
               + (f"Attached PDFs: {', '.join(n for n, _ in pdfs)} (download them from the ticket)\n" if pdfs else "")
               + f"\nAccess Given:\n{b.notes.strip()}\n\nOpen ticket: {link(rid)}")
    else:
        msg = (f"Ticket {rid} has been closed by {u['name']} <{u['email']}>.\n\nTitle: {t['title']}\nDeployment Status: {b.deploy_status}\n"
               f"Deployed At: {fmt(deployed)}\nDeployment URL: {url}\nVersion: {b.version.strip() or '-'}   Environment: {b.env}\n"
               + (f"\nDeployment Notes:\n{b.notes.strip()}\n" if b.notes.strip() else "") + f"\nOpen ticket: {link(rid)}")
    grantees = email_list(t["access"]["for"]) if acc and t["access"] else []  # the people the access is for hear the outcome too
    for e in sorted({t["remail"], *admin_emails(), *email_list(t["cc"]), *grantees} - {None, u["email"]}):
        notify(e, t["id"], msg, f"[{rid}] Ticket closed: {t['title']}")
    return {"ok": True}


# ---------------- Failed deployments: bug report, fix, resubmit ----------------
@router.post("/api/requests/{rid}/fail")
def fail(rid: str, b: FailIn, u=Depends(user)):
    # The owner (or an admin) marks the deployment Failed / Bug Fix Required; it waits ON HOLD until it is resubmitted
    t = get_ticket(rid, u); desc = b.description.strip()
    if t["type"] == "Access Request": raise HTTPException(400, "Access requests cannot be marked as a failed deployment")
    if not desc: raise HTTPException(400, "Describe the bugs or errors you found")
    images = parse_images(b.images)
    with tx() as c:
        cur = lock(c, t)
        if u["role"] != "admin": must_own(cur, t, u)
        if cur["status"] not in ACTIVE: raise HTTPException(400, f"This ticket is {cur['status']}, so it cannot be marked as failed")
        if c.execute("select 1 from deploy_bugs where ticket_id=%s and fixed_at is null", (t["id"],)).fetchone():
            raise HTTPException(400, "This deployment is already waiting for a bug fix")
        bug = c.execute("insert into deploy_bugs(ticket_id,description,reported_by) values(%s,%s,%s) returning id", (t["id"], desc, u["id"])).fetchone()
        for name, mime, data in images:
            c.execute("insert into ticket_images(ticket_id,name,mime,data,bug_id) values(%s,%s,%s,%s,%s)", (t["id"], name, mime, data, bug["id"]))
        c.execute("update tickets set status='ON HOLD', updated_at=now() where id=%s", (t["id"],))
        hist(c, t["id"], "DEPLOY_FAILED", u["id"], f"Failed / Bug Fix Required, reported by {u['name']}"
             + (f" with {len(images)} screenshot(s)" if images else "") + f": {desc if len(desc) <= 120 else desc[:117] + '...'}", cur["status"], "ON HOLD")
    msg = (f"Deployment {rid} ({t['title']}) failed and needs a bug fix.\n\nReported by {u['name']} <{u['email']}>:\n{desc}\n"
           + (f"\n{len(images)} screenshot(s) attached on the ticket.\n" if images else "")
           + f"\nPlease fix the issues, then open the ticket and use Resubmit for Redeployment.\n\nOpen ticket: {link(rid)}")
    for e in sorted({t["remail"], t["aemail"], *admin_emails(), *email_list(t["cc"])} - {None, u["email"]}):
        notify(e, t["id"], msg, f"[{rid}] Deployment failed: bug fix required")
    return {"ok": True}
@router.post("/api/requests/{rid}/resubmit")
def resubmit(rid: str, b: ResubmitIn, u=Depends(user)):
    # After the fix, the requester (or the owner or an admin) sends the deployment back to the owner to redeploy
    t = get_ticket(rid, u); notes, branch, pr = b.fix_notes.strip(), b.branch.strip(), b.pr_url.strip()
    if not (u["role"] == "admin" or u["id"] in (t["requester_id"], t["assignee_id"])):
        raise HTTPException(403, "Only the requester, the owner or an admin can resubmit this deployment")
    if not notes: raise HTTPException(400, "Describe what was fixed")
    if branch and not BRANCH_RE.match(branch): raise HTTPException(400, "Branch name can only use letters, numbers and _ . / - (no spaces)")
    if pr and not URL_RE.match(pr): raise HTTPException(400, "Pull Request URL must start with http:// or https://")
    with tx() as c:
        cur = lock(c, t)
        bug = c.execute("select id from deploy_bugs where ticket_id=%s and fixed_at is null for update", (t["id"],)).fetchone()
        if not bug or cur["status"] == "CLOSED": raise HTTPException(400, "This deployment is not waiting for a bug fix")
        c.execute("update deploy_bugs set fix_notes=%s, fixed_by=%s, fixed_at=now() where id=%s", (notes, u["id"], bug["id"]))
        c.execute("update tickets set status='IN PROGRESS', branch=coalesce(nullif(%s,''),branch), pr_url=coalesce(nullif(%s,''),pr_url), updated_at=now() where id=%s",
                  (branch, pr, t["id"]))
        hist(c, t["id"], "RESUBMITTED", u["id"], f"Fixed and resubmitted for redeployment by {u['name']}"
             + (f" (branch {branch})" if branch and branch != t["branch"] else "") + f": {notes if len(notes) <= 120 else notes[:117] + '...'}",
             cur["status"], "IN PROGRESS")
    msg = (f"The bugs in deployment {rid} ({t['title']}) were fixed by {u['name']} and it is ready to redeploy.\n\nWhat was fixed:\n{notes}\n"
           + (f"Branch: {branch}\n" if branch else "") + (f"Pull Request: {pr}\n" if pr else "")
           + f"\n{t['aname'] or 'The owner'}, please redeploy it and close the ticket.\n\nOpen ticket: {link(rid)}")
    for e in sorted({t["remail"], t["aemail"], *admin_emails(), *email_list(t["cc"])} - {None, u["email"]}):
        notify(e, t["id"], msg, f"[{rid}] Bug fixed: ready to redeploy")
    return {"ok": True}
