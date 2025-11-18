## Glowtype.me

Glowtype.me is a bilingual (English / Simplified Chinese) emotional type quiz site designed for young people.  
It offers a light, non-diagnostic way to reflect on feelings, plus optional anonymous chat and help resources.

This repository contains:

- `frontend/`: React + TypeScript + Vite SPA with react-i18next for i18n.
- `backend/`: Go (Gin) REST API providing quiz questions, scoring endpoint, glowtype content, chat placeholder APIs, and help resources.

### Quick start

#### One‑liner remote setup (recommended)

On a fresh Linux server with Docker + docker-compose available:

```bash
curl -fsSL https://raw.githubusercontent.com/soaringjerry/glowtype/main/scripts/remote_setup.sh | bash
```

The script will:

- clone (or update) this repository to `~/glowtype` by default;
- ensure `.env` and `backend/.env` exist;
- pull/build and start the Dockerized backend + frontend via `docker-compose`.

You can override defaults with environment variables:

- `GLOWTYPE_INSTALL_DIR` – installation directory (default `~/glowtype`);
- `GLOWTYPE_BRANCH` – git branch to use (default `main`);
- `GLOWTYPE_REPO_URL` – repository URL (default GitHub repo).

#### Ports and how to change them

For the Docker setup, the default host ports are:

- Backend: `18080` (host) → `8080` (inside container)
- Frontend: `18081` (host) → `80` (inside container)

You can change these by editing the root `.env`:

```env
GLOWTYPE_BACKEND_PORT_HOST=18080
GLOWTYPE_FRONTEND_PORT_HOST=18081
```

For local development (running without Docker), you can change the backend port by setting `PORT`:

```bash
cd backend
PORT=19080 go run ./cmd/glowtype-api
```

And update the frontend API base URL accordingly:

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:19080/api/v1 npm run dev
```

#### Manual backend start (development)

```bash
cd backend
go run ./cmd/glowtype-api
```

If `PORT` is not set, the backend listens on `:18080` by default with the main prefix `/api/v1`.

#### Manual frontend start (development)

```bash
cd frontend
npm install
npm run dev
```

In development, the frontend uses `VITE_API_BASE_URL` (default `http://localhost:18080/api/v1`) to talk to the backend.

### Directory overview (goal structure)

- Backend:
  - `cmd/glowtype-api/` – entrypoint `main.go`
  - `internal/server/` – Gin bootstrap, routing and middleware
  - `internal/handlers/` – HTTP handlers (quiz, glowtype, chat, health, help)
  - `internal/services/` – business logic (scoring, chat mock, help)
  - `internal/models/` – data structures
  - `internal/storage/` – quiz + glowtype config loading from JSON
  - `internal/config/` – configuration and environment variables
  - `internal/middleware/` – logging, CORS, recovery

- Frontend:
  - `src/pages/` – page-level components (`/`, `/quiz`, `/result/:typeId`, `/chat`, `/help`, `/safety`)
  - `src/components/` – Navbar, Footer and shared UI pieces
  - `src/i18n/` – English / Chinese JSON translation files
  - `src/api/` – small fetch helpers for the backend API
