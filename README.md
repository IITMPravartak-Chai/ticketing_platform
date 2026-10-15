# MLOps Service Desk

A ticketing platform for MLOps requests: deployments, PR reviews, access requests, bug fixes and general requests. Users raise tickets, an admin assigns each one to an ML Engineer (or takes ownership), and the owner works the ticket through to closure. Every step is emailed to the people involved and recorded in an audit trail.

| | |
|---|---|
| **Backend** | Python 3.12, FastAPI, served by Uvicorn |
| **Frontend** | React 18 single-page app, served by the backend (no build step) |
| **Database** | PostgreSQL 16 in Docker |
| **Email** | Any SMTP server (we use Microsoft 365 / Outlook) |

The whole application (API, database access and web UI) is one file, `mlops_service_desk.py`. Tables are created automatically on startup.

---

## Contents

1. [Project structure](#project-structure)
2. [How it fits together](#how-it-fits-together)
3. [Server requirements](#server-requirements)
4. [Deployment, step by step](#deployment-step-by-step)
5. [Configuration reference (.env)](#configuration-reference-env)
6. [Run it as a service](#run-it-as-a-service)
7. [Updating to a new version](#updating-to-a-new-version)
8. [Backup and restore](#backup-and-restore)
9. [Security checklist](#security-checklist)
10. [Troubleshooting](#troubleshooting)
11. [Features](#features)
12. [Database tables](#database-tables)

---

## Project structure

```
Ticketing_Platform/
├── mlops_service_desk.py   # The application: REST API, database access, emails and the React UI (one file)
├── docker-compose.yml      # PostgreSQL 16 container (servicedesk-postgres), data kept in a Docker volume
├── requirements.txt        # Python packages, pinned versions
├── .env.example            # Template for .env: copy it and fill in real values
├── .env                    # Real settings and passwords. NOT in Git; created on each server
├── .gitignore              # Keeps .env, databases and caches out of Git
└── README.md               # This file
```

Inside `mlops_service_desk.py`, the code runs top to bottom in this order:

| Section | What it does |
|---|---|
| Settings | Reads `.env`, defines ticket types, statuses, priorities and validation rules |
| Database | Connection pool and the `SCHEMA` (tables are created or upgraded on every start) |
| Auth | Sign-up with an emailed 6-digit code, login, forgot password, signed login tokens |
| Mail / notifications | Sends emails in the background and stores in-app notifications |
| Tickets | Raise, list, view, assign, take ownership, start, hold, resume, close, comment, screenshots |
| Users & roles | Admin role management and the team list for assigning |
| Frontend | The React page (`PAGE`), served at `/` |
| Command line | `--test-email` and `--import-sqlite` tools, then starts the web server |

---

## How it fits together

```
 Users' browsers ──HTTP :8000──▶  mlops_service_desk.py  ──SQL :5434──▶  PostgreSQL 16 (Docker)
        │                           (FastAPI + Uvicorn)                   volume: servicedesk_pgdata
        │                                   │
        │                                   └──SMTP :587──▶  smtp.office365.com  (notification emails)
        │
        └──HTTPS──▶ cdnjs.cloudflare.com  (React and Babel scripts loaded by the browser)
```

- The app serves both the web page (`/`) and the API (`/api/...`) on one port.
- PostgreSQL is published only on `127.0.0.1:5434`, so it can't be reached from the network.
- Users' browsers need internet access to `cdnjs.cloudflare.com` to load React. Without it the page stays blank.

---

## Server requirements

| Need | Details |
|---|---|
| OS | Linux or Windows. Anything that runs Python 3.12 and Docker |
| Python | 3.12 or newer |
| Docker | Docker Engine with the Compose plugin (`docker compose`) |
| Inbound port | `8000/tcp` (or the `PORT` you choose) from the office network |
| Outbound | SMTP to `smtp.office365.com:587` |
| Hardware | 1 CPU, 1 GB RAM and a few GB of disk is plenty for a team |

---

## Deployment, step by step

Commands are shown for Linux. Windows (PowerShell) equivalents are given where they differ.

### 1. Get the code

```bash
git clone https://github.com/JamesVasanth1712/Ticketing_Platform.git
cd Ticketing_Platform
```

### 2. Create `.env`

```bash
cp .env.example .env          # Windows: Copy-Item .env.example .env
```

Edit `.env` and set at least:

- `SECRET_KEY`: generate one with `python3 -c "import secrets; print(secrets.token_hex(32))"`.
- `POSTGRES_PASSWORD`, and the same password inside `DATABASE_URL`.
- `APP_URL`: the address users will open, for example `http://10.10.182.220:8000`. Links in emails use it.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: the first admin account.
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: the mailbox that sends notifications.
- `TEAM_EMAILS`: the people the admin assigns tickets to.

Every setting is described in the [configuration reference](#configuration-reference-env). The project owner can share the production values privately; they are never stored in Git.

### 3. Start PostgreSQL

```bash
docker compose up -d
docker compose ps             # servicedesk-postgres should be "healthy"
```

The container restarts automatically with Docker (`restart: unless-stopped`). Data lives in the `servicedesk_pgdata` volume, so it survives container restarts and upgrades.

### 4. Install the Python packages

```bash
python3 -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 5. Check that email works

```bash
python mlops_service_desk.py --test-email you@yourcompany.com
```

It prints `Test email sent.` on success, or the SMTP error.

### 6. Start the app

```bash
python mlops_service_desk.py
```

The first start creates all tables and the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. You should see `Uvicorn running on http://0.0.0.0:8000`.

### 7. Open the firewall port

```bash
sudo ufw allow 8000/tcp                                    # Linux with ufw
```
```powershell
# Windows (run as Administrator)
New-NetFirewallRule -DisplayName "MLOps Service Desk" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

### 8. Verify

1. Open `APP_URL` from another machine. The login page should appear.
2. Log in with the admin account. **Change its password straight away** with *Forgot password?*.
3. Raise a test ticket as a normal user, assign it, and check the emails arrive.
4. To run the app permanently, set it up as a [service](#run-it-as-a-service).

---

## Configuration reference (.env)

The app reads `.env` from its own folder. Real environment variables override `.env`.

| Variable | Required | Default | What it does |
|---|:-:|---|---|
| `HOST` | | `127.0.0.1` | Address to listen on. Use `0.0.0.0` so other machines can connect |
| `PORT` | | `8000` | Port for the web app and API |
| `APP_URL` | ✅ | `http://127.0.0.1:8000` | Public address of the app, used for links in emails |
| `SECRET_KEY` | ✅ | (insecure default) | Signs login tokens. Long random string. Changing it logs everyone out |
| `DATABASE_URL` | ✅ | | `postgresql://USER:PASSWORD@127.0.0.1:5434/DB` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | ✅ | | Used by `docker-compose.yml` to create the database. Must match `DATABASE_URL` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | | `admin@example.com` / `Admin@123` | First admin, created only when the database has no admin yet |
| `SMTP_HOST` / `SMTP_PORT` | | | Mail server, e.g. `smtp.office365.com` / `587` (STARTTLS). Port `465` uses SSL |
| `SMTP_USER` / `SMTP_PASS` | | | Mailbox login. Microsoft 365 and Gmail need an **app password** |
| `SMTP_FROM` | | `SMTP_USER` | Sender address shown on emails |
| `TEAM_EMAILS` | | | Comma-separated emails shown in the admin's **Assign** dropdown |

Without SMTP settings, emails are printed to the console and the sign-up code is shown on screen. That's fine for local testing, but not for production.

---

## Run it as a service

### Linux (systemd)

Assuming the project is in `/opt/Ticketing_Platform`, create `/etc/systemd/system/servicedesk.service`:

```ini
[Unit]
Description=MLOps Service Desk
After=network-online.target docker.service
Wants=network-online.target

[Service]
WorkingDirectory=/opt/Ticketing_Platform
ExecStart=/opt/Ticketing_Platform/.venv/bin/python mlops_service_desk.py
Restart=always
RestartSec=5
User=servicedesk

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now servicedesk
sudo journalctl -u servicedesk -f       # live logs
```

### Windows (Task Scheduler)

Run as Administrator. This starts the app at boot:

```powershell
schtasks /Create /TN "MLOps Service Desk" /SC ONSTART /RU SYSTEM /RL HIGHEST `
  /TR "C:\Ticketing_Platform\.venv\Scripts\python.exe C:\Ticketing_Platform\mlops_service_desk.py"
```

### HTTPS (recommended)

The app speaks plain HTTP. For HTTPS, put a reverse proxy such as nginx or IIS in front of it, keep `HOST=127.0.0.1`, and set `APP_URL` to the `https://` address. A minimal nginx example:

```nginx
server {
    listen 443 ssl;
    server_name servicedesk.yourcompany.com;
    ssl_certificate     /etc/ssl/servicedesk.crt;
    ssl_certificate_key /etc/ssl/servicedesk.key;
    client_max_body_size 40m;                  # screenshots are uploaded inside the request
    location / { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host; }
}
```

---

## Updating to a new version

```bash
cd Ticketing_Platform
git pull
pip install -r requirements.txt     # inside the virtual environment
# restart the app: sudo systemctl restart servicedesk (Linux), or stop and start the process
```

- **Database:** changes are applied automatically on startup (`create table if not exists`, `alter table ... add column if not exists`). No manual migrations are needed.
- **Users with the app open:** they see a *"A new version is available. Reload"* banner.
- **Back up first.** Take a [backup](#backup-and-restore) before upgrading.

---

## Backup and restore

All data (users, tickets, history, screenshots) is in PostgreSQL. Replace `servicedesk` below with your `POSTGRES_USER` / `POSTGRES_DB` if they differ.

```bash
# Backup to a file
docker exec servicedesk-postgres pg_dump -U servicedesk -d servicedesk > backup-$(date +%F).sql

# Restore: stop the app, empty the database, then load the backup
docker exec servicedesk-postgres psql -U servicedesk -d postgres -c "drop database servicedesk;" -c "create database servicedesk;"
docker exec -i servicedesk-postgres psql -U servicedesk -d servicedesk < backup-2026-10-15.sql

# Open a SQL prompt
docker exec -it servicedesk-postgres psql -U servicedesk -d servicedesk
```

Schedule the backup command daily (cron or Task Scheduler) and copy the files off the server.

---

## Security checklist

- [ ] `.env` is not in Git (`.gitignore` covers it), and only the service account can read it.
- [ ] `SECRET_KEY` is a long random value, not the example.
- [ ] The default admin password `Admin@123` has been changed.
- [ ] `POSTGRES_PASSWORD` is strong. PostgreSQL stays bound to `127.0.0.1` (as in `docker-compose.yml`).
- [ ] The SMTP password is an app password, not the mailbox's main password.
- [ ] Port 8000 is open only to the office network, or HTTPS is set up through a reverse proxy.
- [ ] Daily backups are scheduled.

Protections already built into the app:

- **Passwords:** stored as salted PBKDF2-SHA256 hashes.
- **Email codes:** stop working after 5 wrong guesses, and only one can be sent per 30 seconds.
- **Access checks:** every API call checks the user's role and whether they're allowed to see that ticket.
- **Screenshots:** must be real PNG, JPG, GIF or WebP files, 5 MB each, at most 5 per ticket.

---

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `Port 8000 is already in use` | Another copy is running. Stop it, or change `PORT` |
| `Cannot connect to PostgreSQL` at startup | The database isn't running. Run `docker compose up -d` and check `docker compose ps` |
| "The database is unavailable right now" in the app | PostgreSQL stopped while the app was running. Start it again (`docker compose up -d`); if errors continue, restart the app |
| Blank white page | The browser can't reach `cdnjs.cloudflare.com`. Allow it in the proxy or firewall |
| Others can't open the app | `HOST` isn't `0.0.0.0`, or the firewall blocks the port, or the server's IP changed |
| Links in emails point to the wrong address | Fix `APP_URL` in `.env` and restart |
| Emails not arriving | Run `python mlops_service_desk.py --test-email you@company.com` and read the error. Check the Junk folder |
| `535 Authentication unsuccessful` from Outlook | Use an app password, and make sure SMTP AUTH is enabled for the mailbox in Microsoft 365 |
| Users still see the old screen after an update | They press **Reload** on the banner, or F5 |

The app logs to the console (or `journalctl` when it runs as a service). Every email it sends is also printed there.

---

## Features

### Roles

| Action | User | ML Engineer | Admin |
|---|:-:|:-:|:-:|
| Raise tickets, see and comment on their own tickets | ✅ | ✅ | |
| See tickets assigned to them | | ✅ | ✅ |
| See every ticket | | | ✅ |
| Assign or reassign tickets, take ownership | | | ✅ |
| Start, hold, resume and close a ticket | owner only | owner only | owner only |
| Change user roles | | | ✅ |

- New sign-ups are **Users**.
- Assigning a ticket to someone makes them an **ML Engineer**. If they have no account yet, an invited account is created and they activate it with *Create account*.
- Admins can't change their own role, and someone who owns open tickets can't be demoted to User.

### Request types

| Type | Extra fields |
|---|---|
| Deployment Request | Repository (required), Pull Request URL (optional) |
| PR Review | Repository and Pull Request URL (both required) |
| Bug Fix | Repository (required), Pull Request URL (optional), up to 5 screenshots |
| Access Request | Access to (Server/SSH, Git, Database, AWS, Kubernetes, VPN, Grafana, Other), server or system, access level, needed until, access for |
| Other | Up to 5 screenshots |

### Ticket workflow

```
NEW ──assign / take ownership──▶ ASSIGNED ──Start Work──▶ IN PROGRESS ◀──Resume── ON HOLD
                                     │                        │  └──Put On Hold (reason)──┘
                                     └────────────Close Ticket (owner only)─────────────▶ CLOSED
```

- **Closing:** most tickets record the deployment status, date/time, notes, resolution and URL. Access requests record the result (Granted, Partially Granted or Rejected), the access given and instructions for the user.
- **Tracker tab:** hover over (or tap) the line between two steps to see how long that step took. On-hold time is shown separately.
- **Audit History tab:** every action is listed, with who did it and when.

### Notifications

- **Emails:** sent at every step to the requester, the owner, admins, anyone in *Also notify*, and the people an access request is for.
- **In-app:** notifications refresh every 5 seconds with an optional chime.
- **Dashboards:** each role has its own, refreshed every 10 seconds.

### Command-line tools

```bash
python mlops_service_desk.py --test-email you@company.com     # check the SMTP settings
python mlops_service_desk.py --import-sqlite old.db           # one-time import of users from the old SQLite version
```

---

## Database tables

| Table | Holds |
|---|---|
| `users` | Accounts, roles (`user`, `engineer`, `admin`) and password hashes. No hash means an invited account |
| `tickets` | Every ticket: type, priority, environment, repository, PR URL, access details (JSON), status, owner |
| `ticket_resolutions` | Closure details for each closed ticket |
| `ticket_history` | Audit trail: every assignment, status change, comment and closure |
| `comments` | Conversation messages on tickets |
| `ticket_images` | Screenshots attached to Bug Fix and Other tickets |
| `notifications` | In-app notifications per user |
| `audit_log` | Role changes and invited users |
| `otps` | Pending email verification codes (expire after 10 minutes) |

Status changes lock the ticket row, so two people can't change the same ticket at once. Multi-step changes run in one transaction, so nothing is half-saved.
