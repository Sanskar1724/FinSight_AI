# FinSight AI production image: the FastAPI API serves the built React app,
# so one container (and one origin) runs everything.

# --- 1. Build the web app ---------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- 2. Python runtime ------------------------------------------------------
FROM python:3.12-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    ENVIRONMENT=production \
    PORT=8000

WORKDIR /app/backend
RUN useradd --create-home --uid 10001 finsight

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
# main.py serves the SPA from ../frontend/dist when it exists.
COPY --from=web /app/frontend/dist /app/frontend/dist
RUN mkdir -p data && chown -R finsight:finsight /app

USER finsight
EXPOSE 8000

# --proxy-headers: hosting platforms terminate TLS at a proxy. Trusting its
# X-Forwarded-* headers gives the app the real client IP (for sign-in rate
# limiting) and the https scheme (for HSTS and secure cookies).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
