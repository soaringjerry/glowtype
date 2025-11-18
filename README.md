## Glowtype.me

Glowtype.me is a bilingual (English / Simplified Chinese) emotional type quiz site designed for young people.  
It offers a light, non-diagnostic way to reflect on feelings, plus optional anonymous chat and help resources.

This repository contains:

- `frontend/`: React + TypeScript + Vite SPA with react-i18next for i18n.
- `backend/`: Go (Gin) REST API providing quiz questions, scoring endpoint, glowtype content, chat placeholder APIs, and help resources.

### Quick start

#### Backend

```bash
cd backend
go run ./cmd/glowtype-api
```

The API listens on `:8080` by default with the main prefix `/api/v1`.

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

In development, the frontend uses `VITE_API_BASE_URL` (default `http://localhost:8080/api/v1`) to talk to the backend.

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

