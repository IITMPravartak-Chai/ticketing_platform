"""The FastAPI application: startup/shutdown, database error handlers, the API routers and the built frontend."""
import os
from contextlib import asynccontextmanager
import psycopg
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from .config import log
from .db import pool
from .bootstrap import start_db
from .mailer import mailer
from . import frontend
from .routers import auth, account, dashboard, tickets, deployments, users, notifications

@asynccontextmanager
async def lifespan(app):
    start_db(); yield; mailer.shutdown(wait=True); pool.close()  # let queued emails finish before stopping
app = FastAPI(title="MLOps Service Desk", lifespan=lifespan)

@app.exception_handler(psycopg.OperationalError)
async def db_unavailable(request: Request, ex):
    log.error("Database unavailable on %s: %s", request.url.path, ex)
    return JSONResponse(status_code=503, content={"detail": "The database is unavailable right now. Please try again in a moment."})
@app.exception_handler(psycopg.Error)
async def db_failed(request: Request, ex):
    log.exception("Database error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "A database error occurred, so the change was not saved. Please try again."})

for r in (auth, account, dashboard, tickets, deployments, users, notifications, frontend):
    app.include_router(r.router)
# Hashed JS/CSS bundles from "npm run build"; their names change with every build, so they can be cached
if os.path.isdir(frontend.ASSETS):
    app.mount("/assets", StaticFiles(directory=frontend.ASSETS), name="assets")
