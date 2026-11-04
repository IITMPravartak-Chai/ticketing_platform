# MLOps Service Desk application image: the React frontend is built, then served by the FastAPI backend.
# Build and run everything (app + PostgreSQL) with: docker compose up -d --build

# ---------- Stage 1: build the React frontend (frontend/ -> dist/) ----------
FROM node:24-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Python backend, which also serves the built frontend ----------
FROM python:3.12-slim

# tzdata lets TZ work, so ticket times are shown in local time instead of UTC
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Kolkata \
    HOST=0.0.0.0 \
    PORT=8000 \
    FRONTEND_DIST=/app/frontend/dist

WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /src/frontend/dist /app/frontend/dist

# Run as a normal user, not root
RUN useradd --system --uid 10001 servicedesk
USER servicedesk

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=4)" || exit 1

CMD ["python", "-m", "app"]
