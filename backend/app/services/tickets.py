"""Ticket helpers: reading, access rules, locking, history, counts, and validation of uploads and forms."""
import base64
from datetime import datetime
from fastapi import HTTPException
from ..config import (APP_URL, STAT, ADMIN_VIEW, ACCESS_TYPES, ACCESS_LEVELS, DEP_TYPES, DEP_ENVS, URL_RE, HOST_RE, COMMIT_RE)
from ..db import q

SEL = """select t.*, r.name rname, r.email remail, a.name aname, a.email aemail, ab.name assigned_by_name,
    res.deploy_status, res.deployed_at, res.notes deploy_notes, res.issues, res.resolution, res.deploy_url, res.version,
    res.environment res_env, res.server_type, res.closed_at, cb.name closed_by_name, cb.email closed_by_email,
    exists(select 1 from deploy_bugs db where db.ticket_id=t.id and db.fixed_at is null) fix_open,
    r.deleted_at is not null requester_gone
  from tickets t join users r on r.id=t.requester_id left join users a on a.id=t.assignee_id
  left join users ab on ab.id=t.assigned_by left join ticket_resolutions res on res.ticket_id=t.id
  left join users cb on cb.id=res.closed_by"""
def fetch(rid): return q(SEL + " where t.rid=%s", (rid,), True)
def can_view(t, u):
    return (u["role"] in ADMIN_VIEW or t["requester_id"] == u["id"] or t["assignee_id"] == u["id"]
            or u["email"] in (t["access"] or {}).get("for", "").split(","))  # the people an access request is for
def get_ticket(rid, u):
    t = fetch(rid)
    if not t or not can_view(t, u): raise HTTPException(404, "Ticket not found")
    return t
def lock(c, t):
    # Row lock so two people cannot change the same ticket at the same moment
    return c.execute("select status, assignee_id from tickets where id=%s for update", (t["id"],)).fetchone()
def must_own(cur, t, u):
    if cur["assignee_id"] != u["id"]:
        who = f"{t['aname']} <{t['aemail']}>" if t["assignee_id"] else "nobody yet"
        raise HTTPException(403, f"Only the ticket owner ({who}) can do this."
                                 + (" Use Take Ownership to work on it yourself." if u["role"] == "admin" else ""))
def hist(c, tid, action, actor_id, detail="", frm=None, to=None):
    c.execute("insert into ticket_history(ticket_id,action,from_status,to_status,actor_id,detail) values(%s,%s,%s,%s,%s,%s)",
              (tid, action, frm, to, actor_id, detail))
def audit(c, actor_id, action, target, detail=""):
    c.execute("insert into audit_log(actor_id,action,target,detail) values(%s,%s,%s,%s)", (actor_id, action, target, detail))
def link(rid): return f"{APP_URL}/#/t/{rid}"
def ticket_text(t):
    a = t.get("access")
    extra = (f"Access To: {a['type']}\n" + (f"Server / System: {a['resource']}\n" if a["resource"] else "") + (f"Access Level: {a['level']}\n" if a["level"] else "")) if a else "" if t["type"] == "Other" else (
                 f"Repository: {t['repo'] or '-'}\n" + (f"Branch: {t['branch']}\n" if t["branch"] else "") + f"Pull Request: {t['pr_url'] or '-'}\n")
    return (f"Ticket: {t['rid']}\nTitle: {t['title']}\nType: {t['type']}\nEnvironment: {t['env']}\n"
            f"{extra}Raised by: {t['rname']} <{t['remail']}>\n"
            f"Created: {t['created_at']}\n\nDescription:\n{t['description']}\n\nOpen ticket: {link(t['rid'])}")
def status_counts(where="true", a=()):
    # Dashboards and list tabs both use this, so the numbers always match the ticket lists
    d = dict.fromkeys(STAT, 0)
    for x in q(f"select t.status, count(*) c from tickets t where {where} group by t.status", a): d[x["status"]] = x["c"]
    d["TOTAL"] = sum(d[s] for s in STAT); d["OPEN"] = d["TOTAL"] - d["CLOSED"]
    return d
def listing(where, a, s):
    rows = q(f"{SEL} where {where} and t.status=%s order by t.id desc", [*a, s]) if s in STAT else q(f"{SEL} where {where} order by t.id desc", a)
    return {"rows": rows, "counts": status_counts(where, a)}
def count(where, a=()): return q(f"select count(*) c from tickets t where {where}", a, True)["c"]
FIX_OPEN = "exists(select 1 from deploy_bugs db where db.ticket_id=t.id and db.fixed_at is null)"
LAST_COMMENTER = "(select m.author_id from comments m where m.ticket_id=t.id order by m.id desc limit 1)"

MAX_IMAGES, MAX_IMAGE_MB, SHOT_TYPES = 5, 5, ("Other",)  # request types that can attach screenshots
def image_mime(d):
    if d.startswith(b"\x89PNG"): return "image/png"
    if d.startswith(b"\xff\xd8\xff"): return "image/jpeg"
    if d.startswith(b"GIF8"): return "image/gif"
    if d[:4] == b"RIFF" and d[8:12] == b"WEBP": return "image/webp"
def parse_images(items):
    if len(items) > MAX_IMAGES: raise HTTPException(400, f"You can attach up to {MAX_IMAGES} images")
    out = []
    for x in items:
        name = str(x.get("name") or "image")[:120]
        try: data = base64.b64decode(str(x.get("data", "")).split(",", 1)[-1], validate=True)
        except Exception: raise HTTPException(400, f"{name} could not be read")
        if len(data) > MAX_IMAGE_MB * 1024 * 1024: raise HTTPException(400, f"{name} is larger than {MAX_IMAGE_MB} MB")
        mime = image_mime(data)
        if not mime: raise HTTPException(400, f"{name} is not a PNG, JPG, GIF or WebP image")
        out.append((name, mime, data))
    return out

MAX_PDFS, MAX_PDF_MB = 5, 10
def parse_pdfs(items):
    if len(items) > MAX_PDFS: raise HTTPException(400, f"You can attach up to {MAX_PDFS} PDF files")
    out = []
    for x in items:
        name = str(x.get("name") or "document.pdf")[:120]
        try: data = base64.b64decode(str(x.get("data", "")).split(",", 1)[-1], validate=True)
        except Exception: raise HTTPException(400, f"{name} could not be read")
        if len(data) > MAX_PDF_MB * 1024 * 1024: raise HTTPException(400, f"{name} is larger than {MAX_PDF_MB} MB")
        if not data.startswith(b"%PDF"): raise HTTPException(400, f"{name} is not a PDF file")
        out.append((name, data))
    return out

def parse_access(a, u):
    kind, res, level = str(a.get("type", "")), str(a.get("resource", "")).strip(), str(a.get("level", ""))
    if kind not in ACCESS_TYPES: raise HTTPException(400, "Choose what you need access to")
    if kind == "Model Endpoint": res, level = "", ""  # the admin sends the endpoint URL and key when closing
    elif not res: raise HTTPException(400, "Enter the repository or VPN you need access to")
    if kind == "VPN": level = ""  # VPN access has no read/write level
    elif kind != "Model Endpoint" and level not in ACCESS_LEVELS: raise HTTPException(400, "Choose an access level")
    # Access is always for the requester; the admin decides how long it lasts
    return {"type": kind, "resource": res[:300], "level": level, "for": u["email"], "until": ""}

def parse_deployment(d):
    # Validates the deployment details form; every problem is reported at once
    g = lambda k, n=200: str(d.get(k) or "").strip()[:n]
    x = {"deployment_type": g("deployment_type"), "app_name": g("app_name"), "app_url": g("app_url", 500), "server_name": g("server_name"),
         "server_ip": g("server_ip", 253), "environment": g("environment"), "method": g("method"), "deployed_at": g("deployed_at", 40),
         "version": g("version", 100), "notes": g("notes", 5000), "manual_steps": g("manual_steps", 5000), "cicd_tool": g("cicd_tool"),
         "pipeline_name": g("pipeline_name"), "pipeline_run_id": g("pipeline_run_id"), "repo_url": g("repo_url", 500), "commit_id": g("commit_id", 64)}
    if x["deployment_type"] not in DEP_TYPES: raise HTTPException(400, "Choose the deployment type: Manual or CI/CD")
    cicd = x["deployment_type"] == "CI/CD"
    need = [("application name", "app_name"), ("application URL", "app_url"), ("server name", "server_name"), ("server IP / host", "server_ip"),
            ("environment", "environment"), ("deployment date/time", "deployed_at")]
    need += [("pipeline name", "pipeline_name"), ("pipeline run ID", "pipeline_run_id")] if cicd else []
    missing = [n for n, k in need if not x[k]]
    if missing: raise HTTPException(400, "Please fill in: " + ", ".join(missing))
    bad = []
    if not URL_RE.match(x["app_url"]): bad.append("Application URL must start with http:// or https://")
    if not HOST_RE.match(x["server_ip"]): bad.append("Server IP / host must be an IP address or host name (letters, digits, . - :)")
    if x["environment"] not in DEP_ENVS: bad.append("Environment must be Development, Testing or Production")
    if cicd and x["commit_id"] and not COMMIT_RE.match(x["commit_id"]): bad.append("Commit ID must be 7 to 40 hexadecimal characters")
    try: x["deployed_at"] = datetime.fromisoformat(x["deployed_at"]).astimezone()
    except ValueError: bad.append("Enter a valid deployment date/time")
    if bad: raise HTTPException(400, "; ".join(bad))
    x.update(method="", cicd_tool="", repo_url="")  # no longer asked for
    if not cicd: x.update(cicd_tool="", pipeline_name="", pipeline_run_id="", repo_url="", commit_id="")  # keep only what fits the type
    else: x["manual_steps"] = ""
    return x
