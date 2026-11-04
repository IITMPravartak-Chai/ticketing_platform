// Fixed lists and labels shared by the pages (statuses, roles, request types, colours).

export const STAT=["NEW","ASSIGNED","IN PROGRESS","ON HOLD","CLOSED"],TRACK=["NEW","ASSIGNED","IN PROGRESS","CLOSED"],ACTIVE=["ASSIGNED","IN PROGRESS","ON HOLD"];
export const DESC={"NEW":"Waiting for assignment","ASSIGNED":"Owner assigned","IN PROGRESS":"Work in progress","ON HOLD":"Paused by the owner","CLOSED":"Resolved and closed"};
export const ROLES=["user","engineer","admin"],ROLE_NAME={user:'User',engineer:'MLOps Engineer',admin:'Admin'};
export const ACTION={CREATED:'Created',ASSIGNED:'Assigned',REASSIGNED:'Reassigned',OWNERSHIP_TAKEN:'Ownership taken',STATUS_CHANGED:'Status changed',COMMENTED:'Comment',CLOSED:'Closed',
  DEPLOY_FAILED:'Failed / bug fix required',RESUBMITTED:'Resubmitted for redeployment'};
export const TYPES=["Deployment Request","Access Request","Other"],ENVS=["Development","Staging","Production"];
export const DEPLOY=["Successfully Deployed","Failed / Bug Fix Required"],FAILED=DEPLOY[1],ACCESS_STAT=["Access Granted","Partially Granted","Rejected"];
export const ACCESS_LEVELS=["Read only","Read & Write","Admin"];
// What to ask for in the "server / system" box, per kind of access
export const ACCESS_TYPES={"Git Repository":["Repository name or URL","https://github.com/org/ml-model-service"],
  "Model Endpoint":["Model endpoint name or URL","https://ml.example.com/v1/fraud-model"],"VPN":["VPN name or location","Office VPN"]};

export const LABEL={NEW:'Pending','ASSIGNED':'Assigned','IN PROGRESS':'In Progress','ON HOLD':'On Hold',CLOSED:'Closed'};
export const SC={NEW:['#1d4ed8','#dbeafe','#3b82f6'],ASSIGNED:['#92400e','#fef3c7','#f59e0b'],'IN PROGRESS':['#075985','#e0f2fe','#0ea5e9'],'ON HOLD':['#475569','#f1f5f9','#94a3b8'],CLOSED:['#166534','#dcfce7','#22c55e']};
export const SICON={NEW:'plus',ASSIGNED:'user','IN PROGRESS':'clock','ON HOLD':'pause',CLOSED:'check'};

export const DEP_ENVS=['Development','Testing','Production'];
