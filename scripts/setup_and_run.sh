#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Glowtype.me – setup & run (Docker) ==="

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker is not installed or not in PATH."
  echo "Please install Docker first, then re-run scripts/setup_and_run.sh."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "[ERROR] Neither 'docker compose' nor 'docker-compose' was found."
  echo "Please install docker-compose or upgrade to a Docker version that supports 'docker compose'."
  exit 1
fi

echo "[OK] Using compose command: ${COMPOSE_CMD}"

# Ensure root .env exists (host ports + Vite API base)
if [ ! -f "${ROOT_DIR}/.env" ]; then
  if [ -f "${ROOT_DIR}/.env.example" ]; then
    cp "${ROOT_DIR}/.env.example" "${ROOT_DIR}/.env"
    echo "[INFO] Created .env from .env.example at project root."
  else
    cat > "${ROOT_DIR}/.env" <<EOF
GLOWTYPE_BACKEND_PORT_HOST=8080
GLOWTYPE_FRONTEND_PORT_HOST=5173
VITE_API_BASE_URL=http://backend:8080/api/v1
EOF
    echo "[INFO] Created a minimal .env at project root."
  fi
  echo "      Please edit .env as needed (ports, VITE_API_BASE_URL, etc.)."
fi

# Inject GEMINI_API_KEY if provided via environment (e.g. from one-line install command)
if [ -n "${GEMINI_API_KEY:-}" ]; then
  if [ -f "${ROOT_DIR}/.env" ]; then
    # Remove existing key if present (including empty ones from example) to avoid duplicates
    # Using temp file for cross-platform compatibility
    grep -v "^GEMINI_API_KEY=" "${ROOT_DIR}/.env" > "${ROOT_DIR}/.env.tmp" || true
    mv "${ROOT_DIR}/.env.tmp" "${ROOT_DIR}/.env"
    
    # Append the new key
    echo "GEMINI_API_KEY=${GEMINI_API_KEY}" >> "${ROOT_DIR}/.env"
    echo "[INFO] Configured GEMINI_API_KEY from environment variable."
  fi
fi

# Ensure backend/.env exists (backend settings)
if [ ! -f "${ROOT_DIR}/backend/.env" ]; then
  if [ -f "${ROOT_DIR}/backend/.env.example" ]; then
    cp "${ROOT_DIR}/backend/.env.example" "${ROOT_DIR}/backend/.env"
    echo "[INFO] Created backend/.env from backend/.env.example."
    echo "      Default ALLOWED_ORIGINS might be https://glowtype.me. Adjust if running locally."
  else
    cat > "${ROOT_DIR}/backend/.env" <<EOF
PORT=8080
ENV=production
ALLOWED_ORIGINS=*
LOG_LEVEL=info
CHAT_PROVIDER=mock
EOF
    echo "[INFO] Created a minimal backend/.env."
  fi
fi

# Load root .env for local variable substitution
set -a
if [ -f "${ROOT_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  source "${ROOT_DIR}/.env"
fi
set +a

echo "[STEP] Pulling latest images (if available)..."
(
  cd "${ROOT_DIR}"
  ${COMPOSE_CMD} pull || true
)

if [ "${GLOWTYPE_LOCAL_BUILD:-0}" = "1" ]; then
  echo "[STEP] Locally building images because GLOWTYPE_LOCAL_BUILD=1 ..."
  (
    cd "${ROOT_DIR}"
    ${COMPOSE_CMD} build
  )
else
  echo "[INFO] Skipping local image build; will use registry images if available."
  echo "       (Set GLOWTYPE_LOCAL_BUILD=1 to force local docker-compose build.)"
fi

echo "[STEP] Starting services in the background..."
(
  cd "${ROOT_DIR}"
  ${COMPOSE_CMD} up -d
)

BACKEND_PORT="${GLOWTYPE_BACKEND_PORT_HOST:-8080}"
FRONTEND_PORT="${GLOWTYPE_FRONTEND_PORT_HOST:-5173}"

echo
echo "=== Glowtype.me is starting via Docker Compose ==="
echo "Frontend:  http://localhost:${FRONTEND_PORT}"
echo "Backend:   http://localhost:${BACKEND_PORT}/api/v1"
echo
echo "Rerun this script to pull/up and update to the latest images."
