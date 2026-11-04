"""PostgreSQL: the connection pool, the schema (created or extended on every start) and query helpers."""
from contextlib import contextmanager
from datetime import datetime
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from .config import DATABASE_URL
from .utils import fmt

pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, open=False, kwargs={"row_factory": dict_row})
SCHEMA = """
create table if not exists users(
  id serial primary key, name text not null, email text not null unique, pw_hash text,
  role text not null default 'user' check (role in ('user','engineer','admin')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists otps(email text primary key, code text not null, name text, purpose text not null, expires_at timestamptz not null);
create table if not exists tickets(
  id serial primary key,
  rid text generated always as ('MLOPS-' || lpad(id::text, greatest(4, length(id::text)), '0')) stored unique,
  title text not null, description text not null, type text not null,
  priority text check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')), env text not null,  -- no longer used; kept for old tickets
  repo text not null default '', pr_url text not null default '',
  status text not null default 'NEW' check (status in ('NEW','ASSIGNED','IN PROGRESS','ON HOLD','CLOSED')),
  requester_id int not null references users(id), assignee_id int references users(id),
  ownership text check (ownership in ('assigned','owned')), assigned_by int references users(id), assigned_at timestamptz,
  cc text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists ticket_resolutions(
  ticket_id int primary key references tickets(id) on delete cascade, deploy_status text not null, deployed_at timestamptz not null,
  notes text not null, issues text not null, resolution text not null, deploy_url text not null, version text not null default '',
  environment text not null, closed_by int not null references users(id), closed_at timestamptz not null default now());
create table if not exists comments(
  id serial primary key, ticket_id int not null references tickets(id) on delete cascade,
  author_id int not null references users(id), body text not null, created_at timestamptz not null default now());
create table if not exists ticket_history(
  id serial primary key, ticket_id int not null references tickets(id) on delete cascade, action text not null,
  from_status text, to_status text, actor_id int references users(id), detail text not null default '',
  created_at timestamptz not null default now());
create table if not exists notifications(
  id serial primary key, user_id int not null references users(id) on delete cascade,
  ticket_id int references tickets(id) on delete cascade, message text not null, seen boolean not null default false,
  created_at timestamptz not null default now());
create table if not exists audit_log(
  id serial primary key, actor_id int references users(id), action text not null, target text not null,
  detail text not null default '', created_at timestamptz not null default now());
create table if not exists ticket_images(
  id serial primary key, ticket_id int not null references tickets(id) on delete cascade, name text not null,
  mime text not null, data bytea not null, created_at timestamptz not null default now());
alter table tickets alter column priority drop not null;  -- tickets no longer have a priority
alter table otps add column if not exists attempts int not null default 0;  -- wrong guesses; the code stops working after 5
alter table tickets add column if not exists branch text not null default '';  -- Git branch to deploy (Deployment Request)
alter table tickets add column if not exists access jsonb;  -- Access Request details: type, resource, level, for, until
create table if not exists ticket_files(  -- PDFs the owner attaches when closing an access request (VPN config, setup guide)
  id serial primary key, ticket_id int not null references tickets(id) on delete cascade, name text not null,
  data bytea not null, created_at timestamptz not null default now());
alter table ticket_resolutions add column if not exists vpn_user text not null default '';  -- VPN access only
alter table ticket_resolutions add column if not exists vpn_password text not null default '';
alter table ticket_resolutions add column if not exists api_key text not null default '';  -- Model Endpoint access only
create table if not exists deploy_bugs(  -- a failed deployment's bug report and, once fixed, what was fixed
  id serial primary key, ticket_id int not null references tickets(id) on delete cascade, description text not null,
  reported_by int not null references users(id), reported_at timestamptz not null default now(),
  fix_notes text not null default '', fixed_by int references users(id), fixed_at timestamptz);
alter table ticket_images add column if not exists bug_id int references deploy_bugs(id) on delete cascade;  -- screenshot of a failed deployment
create index if not exists ix_deploy_bugs_ticket on deploy_bugs(ticket_id);
alter table users add column if not exists deleted_at timestamptz;  -- set when an admin deletes an account that still has ticket history
create table if not exists deployment_records(  -- confidential: read only by admins
  id serial primary key, ticket_id int not null unique references tickets(id) on delete cascade,
  deployment_type text not null check (deployment_type in ('Manual','CI/CD')),
  app_name text not null, app_url text not null, server_name text not null, server_ip text not null,
  environment text not null, method text not null, deployed_at timestamptz not null, status text not null, version text not null default '',
  notes text not null default '', manual_steps text not null default '',
  cicd_tool text not null default '', pipeline_name text not null default '', pipeline_run_id text not null default '',
  repo_url text not null default '', commit_id text not null default '',
  deployed_by int not null references users(id), deployed_by_role text not null, submitted_at timestamptz not null default now(),
  idempotency_key text unique);  -- the form's one-time key: a retried submit cannot create a second record
create index if not exists ix_tickets_status on tickets(status);
create index if not exists ix_images_ticket on ticket_images(ticket_id);
create index if not exists ix_files_ticket on ticket_files(ticket_id);
create index if not exists ix_tickets_requester on tickets(requester_id);
create index if not exists ix_tickets_assignee on tickets(assignee_id);
create index if not exists ix_history_ticket on ticket_history(ticket_id);
create index if not exists ix_comments_ticket on comments(ticket_id);
create index if not exists ix_notifications_user on notifications(user_id, seen);
"""
def _row(r): return {k: fmt(v) if isinstance(v, datetime) else v for k, v in r.items()}
def q(sql, a=(), one=False):
    with pool.connection() as c:
        rows = [_row(r) for r in c.execute(sql, a).fetchall()]
    return (rows[0] if rows else None) if one else rows
def run(sql, a=()):
    with pool.connection() as c:
        cur = c.execute(sql, a)
        r = cur.fetchone() if cur.description else None
    return _row(r) if r else None
@contextmanager
def tx():
    # One transaction: commits when the block ends, rolls back if anything (including an HTTPException) is raised
    with pool.connection() as c:
        with c.transaction():
            yield c
