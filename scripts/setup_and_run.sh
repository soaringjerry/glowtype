#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Glowtype.me – setup & run (Docker) ==="

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] Docker is not installed or not in PATH."
  echo "请先安装 Docker，然后重新运行 scripts/setup_and_run.sh。"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  echo "[ERROR] Neither 'docker compose' nor 'docker-compose' was found."
  echo "请安装 docker-compose 或升级到支持 'docker compose' 的 Docker 版本。"
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
  echo "      请根据需要编辑 .env（端口、VITE_API_BASE_URL 等）。"
fi

# Ensure backend/.env exists (backend settings)
if [ ! -f "${ROOT_DIR}/backend/.env" ]; then
  if [ -f "${ROOT_DIR}/backend/.env.example" ]; then
    cp "${ROOT_DIR}/backend/.env.example" "${ROOT_DIR}/backend/.env"
    echo "[INFO] Created backend/.env from backend/.env.example."
    echo "      默认 ALLOWED_ORIGINS 可能是 https://glowtype.me，如在本地运行请根据前端地址调整。"
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

echo "[STEP] Building images (this may take a while on first run)..."
(
  cd "${ROOT_DIR}"
  ${COMPOSE_CMD} build
)

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
echo "重新运行本脚本将执行 pull/build/up，可用于更新到最新镜像。"

