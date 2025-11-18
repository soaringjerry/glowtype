#!/usr/bin/env bash
set -euo pipefail

echo "=== Glowtype.me – remote setup ==="

if ! command -v git >/dev/null 2>&1; then
  echo "[ERROR] git is not installed or not in PATH."
  echo "Please install git first, then re-run this script."
  exit 1
fi

REPO_URL="${GLOWTYPE_REPO_URL:-https://github.com/soaringjerry/glowtype.git}"
BRANCH="${GLOWTYPE_BRANCH:-main}"
INSTALL_DIR="${GLOWTYPE_INSTALL_DIR:-$HOME/glowtype}"

echo "[INFO] Repository URL: ${REPO_URL}"
echo "[INFO] Target branch:  ${BRANCH}"
echo "[INFO] Install path:   ${INSTALL_DIR}"

if [ -d "${INSTALL_DIR}/.git" ]; then
  echo "[STEP] Repository already exists, pulling latest..."
  git -C "${INSTALL_DIR}" fetch origin "${BRANCH}"
  git -C "${INSTALL_DIR}" checkout "${BRANCH}"
  git -C "${INSTALL_DIR}" pull origin "${BRANCH}"
else
  echo "[STEP] Cloning repository..."
  git clone --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
fi

cd "${INSTALL_DIR}"

if [ ! -x "./scripts/setup_and_run.sh" ]; then
  chmod +x ./scripts/setup_and_run.sh
fi

echo "[STEP] Running local setup_and_run.sh ..."
./scripts/setup_and_run.sh

echo "=== Glowtype.me – remote setup finished ==="

