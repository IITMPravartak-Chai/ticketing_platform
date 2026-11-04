"""Deployment records (confidential, admins only): list, Excel download, one record."""
import base64
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from ..db import q, tx
from ..security import admin
from ..services.tickets import audit
from ..services.xlsx import XLSX_COLS, xlsx

router = APIRouter()

DEP_SEL = """select d.*, t.rid, t.title, x.name deployed_by_name, x.email deployed_by_email
  from deployment_records d join tickets t on t.id=d.ticket_id join users x on x.id=d.deployed_by"""
@router.get("/api/deployments")
def deployments(u=Depends(admin)):
    return [{k: v for k, v in r.items() if k != "idempotency_key"} for r in q(DEP_SEL + " order by d.submitted_at desc, d.id desc")]
@router.get("/api/deployments/export")
def deployments_export(q_: str = "", type: str = "ALL", env: str = "ALL", u=Depends(admin)):
    qq = q_.strip().lower()[:200]
    rows = [r for r in q(DEP_SEL + " order by d.submitted_at desc, d.id desc")
            if (type == "ALL" or r["deployment_type"] == type) and (env == "ALL" or r["environment"] == env)
            and (not qq or qq in " ".join(str(r[k] or "") for k in ("rid", "app_name", "server_name", "server_ip", "deployed_by_name", "app_url", "title")).lower())]
    with tx() as c:  # who downloaded confidential data, and how much
        audit(c, u["id"], "DEPLOYMENTS_EXPORTED", "deployment_records", f"{u['name']} downloaded {len(rows)} deployment record(s) as Excel")
    name = f"deployment_details_{datetime.now().strftime('%Y-%m-%d_%H%M')}.xlsx"
    return {"name": name, "count": len(rows), "src": "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,"
            + base64.b64encode(xlsx("Deployment Details", XLSX_COLS, rows)).decode()}
@router.get("/api/deployments/{did}")
def deployment(did: int, u=Depends(admin)):
    d = q(DEP_SEL + " where d.id=%s", (did,), True)
    if not d: raise HTTPException(404, "Deployment record not found")
    d.pop("idempotency_key", None)
    return d
