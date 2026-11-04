"""Request bodies accepted by the API."""
from pydantic import BaseModel

class RegIn(BaseModel): name: str; email: str
class EmailIn(BaseModel): email: str
class VerIn(BaseModel): email: str; code: str
class PwIn(BaseModel): ticket: str; password: str
class ChangePwIn(BaseModel): current: str; password: str
class LoginIn(BaseModel): email: str; password: str
class ReqIn(BaseModel):
    title: str; description: str; type: str = "Deployment Request"
    env: str = "Production"; repo: str = ""; branch: str = ""; pr_url: str = ""; images: list[dict] = []  # images: [{name, data: "data:image/png;base64,..."}]
    access: dict = {}  # Access Request only: {type, resource, level, for, until}
class FailIn(BaseModel): description: str; images: list[dict] = []
class ResubmitIn(BaseModel): fix_notes: str; branch: str = ""; pr_url: str = ""
class CmtIn(BaseModel): body: str
class AsgIn(BaseModel): email: str; cc: str = ""
class HoldIn(BaseModel): reason: str
class RoleIn(BaseModel): role: str
class CloseIn(BaseModel):
    deploy_status: str; deployed_at: str; notes: str; issues: str = ""; resolution: str; deploy_url: str
    version: str = ""; env: str = "Production"
    vpn_user: str = ""; vpn_password: str = ""; api_key: str = ""; files: list[dict] = []
    deployment: dict = {}; idem: str = ""  # Deployment Request only: the deployment details form + its one-time key  # files: PDFs [{name, data: "data:application/pdf;base64,..."}]
