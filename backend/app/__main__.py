"""Start the server, or run a maintenance command:
    python -m app                                  start the server (HOST / PORT from .env)
    python -m app --test-email you@example.com     check the SMTP settings without starting the server
    python -m app --ensure-admins                  apply ADMIN_EMAILS and USER_ACCOUNTS now, then list the admins
    python -m app --import-sqlite servicedesk.db   one-time import of users from the old SQLite version
Run these from the backend/ folder."""
import sys
import uvicorn
from .config import HOST, PORT, APP_URL
from .db import pool
from .mailer import mail
from .bootstrap import start_db, import_sqlite

def main():
    args = sys.argv[1:]
    if len(args) == 2 and args[0] == "--test-email":  # checks the SMTP settings without starting the server
        err = mail(args[1], "MLOps Service Desk test email", "If you can read this, email notifications are working.")
        print("\nTest email sent." if not err else f"\nTest email NOT sent: {err}"); sys.exit(1 if err else 0)
    if args == ["--ensure-admins"]:  # repair: apply ADMIN_EMAILS to the database now, then list the admins
        admins = start_db()
        print("\nAdmins now:", ", ".join(admins) or "NONE (set ADMIN_EMAILS in .env)"); pool.close(); sys.exit(0 if admins else 1)
    if len(args) == 2 and args[0] == "--import-sqlite":
        start_db(); import_sqlite(args[1]); pool.close(); sys.exit(0)
    import socket
    with socket.socket() as s:  # friendlier than uvicorn's bind error when a second copy is started
        if s.connect_ex(("127.0.0.1", PORT)) == 0:
            print(f"\nPort {PORT} is already in use, probably by another copy of this app that is still running.\n"
                  f"Open http://127.0.0.1:{PORT} to use it, or stop it first with:\n"
                  f"  Get-NetTCPConnection -LocalPort {PORT} -State Listen | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force }}\n")
            sys.exit(1)
    # Uvicorn prints http://0.0.0.0:PORT, which browsers can't open; show the addresses people should use
    print(f"\n  Open on this PC:        http://127.0.0.1:{PORT}" + (f"\n  Open from other PCs:    {APP_URL}" if HOST != "127.0.0.1" else "") + "\n", flush=True)
    from .main import app
    uvicorn.run(app, host=HOST, port=PORT)

if __name__ == "__main__":
    main()
