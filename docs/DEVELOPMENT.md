# Glowtype.me Development Documentation

> This document describes the current architecture, code structure, deployment methods, and key design decisions.
> Last updated: 2025-11

---

## 1. Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API   │────▶│   SQLite DB     │
│   React + Vite  │     │   Go + Gin      │     │   (GORM)        │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         │ (direct call)
         ▼
┌─────────────────┐
│   OpenAI API    │
│   gpt-4o-mini   │
└─────────────────┘
```

- **Frontend-Backend Separation**:
  - Frontend: `frontend/` – React + TypeScript + Vite SPA, handles UI, quiz flow, AI chat
  - Backend: `backend/` – Go + Gin REST API, handles data management, scoring logic, analytics
- **Database**: SQLite + GORM (supports multi-tenant expansion)
- **AI Integration**: Frontend directly calls OpenAI-compatible API (configurable for other compatible services)
- **Domains**:
  - `https://glowtype.me` – Frontend
  - `https://api.glowtype.me` – Backend API

---

## 2. Backend (`backend/`)

### 2.1 Tech Stack

- Go 1.23+, Gin HTTP framework
- GORM + SQLite (data persistence)
- JWT (admin authentication)
- TOTP (two-factor authentication)
- Module name: `github.com/soaringjerry/glowtype`

### 2.2 Directory Structure

```
backend/
├── cmd/glowtype-api/main.go    # Service entry point
├── internal/
│   ├── config/                 # Environment variable config
│   ├── database/               # GORM models, DB init, seed data
│   ├── handlers/               # HTTP handlers
│   │   ├── quiz.go             # Quiz API
│   │   ├── glowtype.go         # Result type API
│   │   ├── chat.go             # Chat API + analytics tracking
│   │   ├── admin.go            # Admin backend CRUD + auth
│   │   ├── admin_2fa.go        # Two-factor authentication handlers
│   │   ├── stats.go            # Statistics API
│   │   └── ...
│   ├── services/               # Business logic
│   │   ├── scoring_service.go  # Scoring engine (rule matching)
│   │   ├── quiz_service.go     # Quiz service
│   │   ├── admin_auth.go       # Admin authentication service
│   │   ├── totp_service.go     # 2FA TOTP service
│   │   ├── analytics_service.go # Advanced analytics
│   │   └── ...
│   ├── models/                 # Request/response structs
│   ├── middleware/             # Logging, CORS, auth
│   ├── utils/                  # Utility functions (GeoIP, anonymization)
│   └── server/                 # Gin initialization, route registration
├── config/                     # Static config files (legacy)
└── data/                       # SQLite database files
```

### 2.3 Data Models

Main data tables (auto-migrated via GORM):

| Table | Purpose |
|-------|---------|
| `trait_dimensions` | Personality dimension definitions (energy, expression, etc.) |
| `quiz_questions` | Quiz questions and options (multilingual) |
| `scoring_rules` | Scoring rules (dimension range → Glowtype mapping) |
| `glowtypes` | Type base info (code, colors, etc.) |
| `glowtype_i18n` | Type multilingual content |
| `quiz_results` | Anonymous quiz result records |
| `chat_sessions` | Anonymous chat session statistics |
| `usage_stats` | Daily usage statistics |
| `glowtype_stats` | Type distribution statistics |
| `ai_prompts` | AI prompt configurations |
| `ai_settings` | AI provider configuration (API key, model, rate limits) |
| `book_chapters` / `glow_sticks` | Glowpedia content |
| `admin_users` | Admin accounts |
| `admin_audit_logs` | Operation audit logs |
| `admin_recovery_codes` | Admin 2FA recovery codes |
| `admin_trusted_devices` | Admin 2FA trusted devices |
| `admin_login_attempts` | Login attempt tracking (brute-force protection) |

### 2.4 API Endpoints

#### Public API (`/api/v1`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/quiz?lang=` | Get quiz questions |
| POST | `/quiz/score` | Submit answers, calculate result |
| POST | `/quiz/result` | Save detailed quiz result (anonymous) |
| GET | `/glowtypes/:id?lang=` | Get type content |
| POST | `/chat/session` | Create chat session |
| POST | `/chat/message` | Send chat message |
| POST | `/chat/insight` | Generate AI insight |
| POST | `/chat/analytics` | Track chat statistics |
| GET | `/help?lang=` | Get help hotlines |
| POST | `/stats/event` | Record usage event |
| GET | `/prompts` | Get public AI prompts |
| GET | `/glowpedia` | Get Glowpedia content |

#### Admin API (`/api/v1/admin`)

Requires JWT authentication (except 2FA verification endpoint).

| Category | Endpoints |
|----------|-----------|
| Auth | `POST /login`, `GET /me`, `PUT /me/password` |
| 2FA | `POST /2fa/authenticate` (no auth), `GET /2fa/status`, `POST /2fa/setup`, `POST /2fa/verify`, `DELETE /2fa`, `POST /2fa/recovery/regenerate` |
| 2FA Devices | `GET /2fa/devices`, `DELETE /2fa/devices/:id`, `DELETE /2fa/devices` |
| Permissions | `GET /permissions/templates` |
| Account Mgmt | `GET /users`, `POST /users`, `PUT /users/:id`, `PUT /users/:id/2fa` |
| Audit | `GET /audit` |
| Dimensions | `GET /dimensions`, `POST /dimensions`, `PUT /dimensions/:id`, `DELETE /dimensions/:id`, `POST /dimensions/import`, `GET /dimensions/export` |
| Questions | `GET /questions`, `POST /questions`, `PUT /questions/:id`, `DELETE /questions/:id`, `POST /questions/import` |
| Glowtypes | `GET /glowtypes`, `GET /glowtypes/:id`, `POST /glowtypes`, `PUT /glowtypes/:id`, `DELETE /glowtypes/:id`, `POST /glowtypes/i18n`, `PUT /glowtypes/i18n/:id` |
| Rules | `GET /rules`, `POST /rules`, `PUT /rules/:id`, `DELETE /rules/:id`, `POST /rules/import`, `GET /rules/export`, `POST /rules/debug`, `GET /rules/validate` |
| Prompts | `GET /prompts`, `PUT /prompts/:id`, `POST /prompts/:key/reset` |
| AI Settings | `GET /ai/settings`, `PUT /ai/settings` (superadmin only) |
| Statistics | `GET /stats/overview`, `GET /stats/daily`, `GET /stats/glowtypes`, `GET /stats/enhanced`, `GET /stats/analytics` |
| Results | `GET /results` |
| Glowpedia | `GET /chapters`, `POST /chapters`, `PUT /chapters/:id`, `DELETE /chapters/:id`, `GET /glowsticks`, `POST /glowsticks`, `PUT /glowsticks/:id`, `DELETE /glowsticks/:id` |
| Reset | `POST /dimensions/reset`, `POST /questions/reset`, `POST /glowtypes/reset`, `POST /rules/reset`, `POST /prompts/reset-all`, `POST /glowpedia/reset` |

### 2.5 Scoring Engine

Scoring flow:
1. User submits answers → Accumulate dimension scores based on option `scores` fields
2. Match rules by priority (highest first), first matching rule wins
3. If no match, use fallback rule
4. Return Glowtype code + dimension scores

Rule condition example:
```json
{
  "dimensions": {
    "energy": { "min": 0, "max": null },
    "expression": { "min": 0, "max": null }
  }
}
```

### 2.6 Anonymization & Privacy

- **No IP storage**: IP is only converted to region code then discarded
- **GeoIP lookup**: Prefers Cloudflare `CF-IPCountry` header, fallback to ip-api.com
- **Device identification**: Extracts device type (mobile/desktop/tablet) from User-Agent
- **Time granularity**: Timestamps are truncated to the minute; analytics also store derived hour-of-day (0–23) only

### 2.7 Admin Audit & RBAC

#### Audit Logs (`admin_audit_logs`)

- Fields: `adminId`, `username`, `action` (e.g., `PUT /api/v1/admin/chapters/:id`), `method`, `path`, `statusCode`, `ip`, `metadata` (JSON), `createdAt`
- `metadata` includes:
  - `requestedAt`, `durationMs`, `adminRole`, `ip`, `userAgent`
  - `pathParams`, `query` (sensitive keys like password/token/secret are `[redacted]`)
  - `requestBody` (JSON auto-sanitized + 8KB truncation; >2MB skipped with `requestBodyTruncated` flag)
  - `responseSample` (first 4KB, `responseSampleTruncated` if exceeded)
  - Handlers can add `auditMetadata` (won't override core fields)
- Purpose: Clear accountability for "who, when, from where, on what resource, did what, with what result"

#### RBAC Permission System

Available roles and their permissions:

| Role | Permissions |
|------|-------------|
| `superadmin` | All permissions |
| `admin` | `dimensions.write`, `questions.write`, `rules.write`, `glowtypes.write`, `prompts.write`, `content.write`, `stats.view`, `results.view` |
| `content_admin` | `content.write`, `stats.view` |
| `data_admin` | `dimensions.write`, `questions.write`, `rules.write`, `glowtypes.write`, `prompts.write`, `stats.view`, `results.view` |
| `analyst` | `stats.view`, `results.view`, `audit.view` |
| `viewer` | Read-only access to all areas (backend enforces GET/HEAD/OPTIONS only) |

Permission list:
- `admin.manage` - Admin account management
- `audit.view` - View audit logs
- `dimensions.write` - Manage dimensions
- `questions.write` - Manage questions
- `rules.write` - Manage scoring rules
- `glowtypes.write` - Manage glowtypes
- `prompts.write` - Manage AI prompts
- `content.write` - Manage Glowpedia content
- `stats.view` - View statistics
- `results.view` - View quiz results
- `data.reset` - Reset data to defaults (superadmin only)

Custom permissions can be set per-user in the `permissions` JSON field to override role defaults.

---

## 3. Frontend (`frontend/`)

### 3.1 Tech Stack

- React 19 + TypeScript + Vite
- react-router-dom (routing)
- react-i18next (internationalization)
- Tailwind CSS (styling)
- Lucide React (icons)
- Framer Motion (animations)

### 3.2 Directory Structure

```
frontend/src/
├── main.tsx                # Entry point
├── App.tsx                 # Route configuration
├── api/                    # API client
├── utils/
│   └── ai.ts               # OpenAI call wrapper
├── i18n/                   # Multilingual resources
│   ├── en/
│   └── zh-CN/
├── pages/                  # Page components (legacy)
├── views/                  # View components (new)
├── components/             # Common components
└── admin/                  # Admin panel
    ├── AdminLayout.tsx
    ├── AdminLogin.tsx
    ├── hooks/useAdmin.ts   # API hooks
    ├── components/         # Admin components (TwoFactorSetup, etc.)
    └── pages/              # Admin pages
```

### 3.3 Tailwind CSS Dynamic Class Issue

⚠️ **Important: Glowtype Styling Pitfall**

Tailwind CSS purges classes not statically present in source code during build. If you configure dynamic Tailwind classes in the database (like `from-purple-50`), but the code doesn't statically reference this class, it gets deleted, causing styles to not apply.

**Symptoms**:
- Some Glowtype cards style correctly, others have wrong background/text colors
- Newly created Glowtype styles don't apply

**Solution**:
Configure `safelist` in `frontend/tailwind.config.js` to preserve all potentially used dynamic classes:

```javascript
safelist: [
  // cardAccent: from-{color}-{50,100,200}, to-{color}-{50,100,200}
  { pattern: /^from-(slate|gray|...|rose)-(50|100|200)$/ },
  { pattern: /^to-(slate|gray|...|rose)-(50|100|200)$/ },
  // textColor: text-{color}-{700,800,900,950}
  { pattern: /^text-(slate|gray|...|rose)-(700|800|900|950)$/ },
]
```

**Available style values for new Glowtypes**:

| Field | Format | Example |
|-------|--------|---------|
| cardAccent | `from-{color}-{depth} to-{color}-{depth}` | `from-purple-50 to-violet-100` |
| textColor | `text-{color}-{depth}` | `text-purple-900` |

- Colors: slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose
- cardAccent depths: 50, 100, 200
- textColor depths: 700, 800, 900, 950

### 3.4 AI Integration

Frontend directly calls OpenAI-compatible API:

```typescript
// utils/ai.ts
const config = {
  apiKey: window.ENV.AI_API_KEY || import.meta.env.VITE_AI_API_KEY,
  baseUrl: window.ENV.AI_API_URL || 'https://api.openai.com/v1',
  model: window.ENV.AI_MODEL || 'gpt-4o-mini',
};
```

Features:
- **Cosmic Insight**: Generate poetic short phrases based on Glowtype
- **AI Chat**: Multi-turn conversation with context

Prompts can be configured via admin panel and stored in database.

### 3.5 Admin Panel

Path: `/admin`

Feature modules:
- **Dashboard**: Usage stats, daily trends, type distribution, region/device/time analysis
- **Dimensions**: Define personality dimensions (bipolar labels, thresholds)
- **Questions**: CRUD quiz questions and options
- **Glowtypes**: CRUD Glowtypes and multilingual content
- **Scoring Rules**: Configure rule conditions, priorities, debugging tools
- **AI Prompts**: Configure system prompts
- **AI Settings**: Configure AI provider, API key, model, rate limits (superadmin only)
- **Glowpedia**: Manage chapters and glow stick content
- **Results**: View anonymous quiz results
- **Analytics**: Advanced data analytics with custom date ranges
- **Admin Accounts**: Multi-account management + 2FA force/reset (superadmin only)
- **Audit Logs**: View all admin operation logs
- **Personal Settings**: Change password, enable/disable 2FA, manage trusted devices

---

## 4. Deployment

### 4.1 Docker Deployment (Recommended)

```bash
# One-click deployment
AI_API_KEY=your_key curl -fsSL https://raw.githubusercontent.com/soaringjerry/glowtype/main/scripts/remote_setup.sh | bash
```

Port configuration (`.env`):
```env
GLOWTYPE_BACKEND_PORT_HOST=18080
GLOWTYPE_FRONTEND_PORT_HOST=18081
```

### 4.2 Local Development

Backend:
```bash
cd backend
cp .env.example .env
go run ./cmd/glowtype-api
```

Frontend:
```bash
cd frontend
npm install
cp .env.example .env.local  # Configure VITE_AI_API_KEY
npm run dev
```

### 4.3 Environment Variables

Backend (`backend/.env`):
```env
PORT=8080
ENV=development
ALLOWED_ORIGINS=http://localhost:5173

# Admin authentication
ADMIN_JWT_SECRET=your_jwt_secret
ADMIN_SUPER_PASSWORD=your_secure_password
ADMIN_SUPER_USERNAME=superadmin

# 2FA configuration
TOTP_ENCRYPTION_KEY=your_32_char_key  # Auto-generated on first start
FORCE_ADMIN_2FA=false

# Trusted proxies for real IP: Cloudflare setup use auto,cloudflare
TRUSTED_PROXIES=auto,cloudflare

# Database backup
BACKUP_ENABLED=1
BACKUP_INTERVAL_MINUTES=60
BACKUP_MAX_TOTAL_BYTES=5368709120
BACKUP_MIN_FREE_BYTES=1073741824
BACKUP_DIR=/data/backup
```

Frontend (`frontend/.env.local`):
```env
VITE_API_BASE_URL=http://localhost:18080/api/v1
VITE_AI_API_KEY=sk-xxx
VITE_AI_API_URL=https://api.openai.com/v1
VITE_AI_MODEL=gpt-4o-mini
```

---

## 5. CLI Tools

### Data Export

```bash
cd backend
go run ./cmd/export-data/main.go -format json -output export.json
go run ./cmd/export-data/main.go -format csv -output export.csv
```

Export content (all anonymous):
- Quiz results: dimension scores, type, language, region, device, time
- Chat statistics: message count, duration, region, device

---

## 6. Security Design

- **Privacy First**: No PII collected, IP only used for region inference then immediately discarded
- **JWT Authentication**: Admin API requires valid token
- **Multi-admin**: Supports superadmin/admin/viewer role distinction
- **Audit Logs**: All admin operations record IP, time, operation content
- **Login Protection**: Failure count limit + account lockout (5 attempts → 15 min lock)
- **Two-Factor Authentication (2FA)**:
  - TOTP verification: SHA-256 algorithm, compatible with Google Authenticator and standard apps
  - Recovery codes: 10 one-time codes (48-bit entropy), for device loss scenarios
  - Trusted devices: Optional 7-day skip verification
  - Force 2FA: Superadmin can force specific users or globally (via `FORCE_ADMIN_2FA=true`)
  - AES-256-GCM encrypted TOTP secret storage
  - Security audit: All 2FA operations logged with detailed audit metadata

### 6.1 2FA Configuration

Environment variables (`backend/.env`):
```env
# 2FA TOTP key encryption (32 characters, auto-generated on first start)
TOTP_ENCRYPTION_KEY=

# Force all admins to enable 2FA (optional, default false)
FORCE_ADMIN_2FA=false
```

2FA flow:
1. User enables 2FA in "Personal Settings", scans QR code and enters verification code
2. System generates 10 recovery codes, user must save securely (initially hidden, click to reveal)
3. Next login requires TOTP verification code after password
4. Can choose "Trust this device" to skip 2FA for 7 days
5. Superadmin can force/reset user 2FA in "Admin Accounts" page

### 6.2 2FA Upgrade Notes (v2.0+)

**⚠️ Important Upgrade Notice**

From v2.0, 2FA implementation has these breaking changes:

1. **TOTP Algorithm Upgrade**: Changed from SHA-1 to SHA-256
   - Impact: Users with 2FA enabled will fail verification
   - Solution: Users must use recovery codes to login, then re-setup 2FA

2. **Recovery Code Format Change**: Increased from 8 to 12 characters (48-bit entropy)
   - Impact: New recovery codes are longer and more secure
   - Backward compatible: Old format recovery codes still work

**Upgrade Steps** (for deployed systems):

```bash
# 1. Backup database
cp backend/data/glowtype.db backend/data/glowtype.db.backup

# 2. Pull latest code/images
git pull && ./scripts/setup_and_run.sh
# or
docker compose pull && docker compose up -d

# 3. Notify admins with 2FA enabled
#    - Use recovery code to login
#    - Re-setup 2FA in "Personal Settings"
```

**Superadmin reset user 2FA** (if user cannot login):
1. Login to admin panel
2. Go to "Admin Accounts"
3. Find target user, click "Reset 2FA"

---

## 7. AI Provider Configuration

The system supports multiple OpenAI-compatible AI providers:

### 7.1 Supported Providers

| Provider | Base URL | Notes |
|----------|----------|-------|
| OpenAI | `https://api.openai.com/v1` | Default, requires API key |
| DeepSeek | `https://api.deepseek.com/v1` | Cost-effective alternative |
| Groq | `https://api.groq.com/openai/v1` | Fast inference |
| Local LLM | `http://localhost:11434/v1` | Ollama, vLLM, etc. |

### 7.2 Configuration

Via admin panel (AI Settings page) or environment variables:

```env
# Frontend direct call (client-side)
VITE_AI_API_KEY=sk-xxx
VITE_AI_API_URL=https://api.openai.com/v1
VITE_AI_MODEL=gpt-4o-mini

# Backend AI (for future server-side features)
AI_API_KEY=sk-xxx
AI_API_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

### 7.3 Rate Limiting

Configure via admin panel to prevent abuse:
- `rateLimitEnabled`: Enable/disable rate limiting
- `rateLimitRequestsPerMin`: Max requests per minute (default: 60)
- `rateLimitBurst`: Burst allowance (default: 10)

---

## 8. Database Backup & Recovery

### 8.1 Automatic Backups

Enabled by default with these settings:
```env
BACKUP_ENABLED=1
BACKUP_INTERVAL_MINUTES=60          # Hourly snapshots
BACKUP_MAX_TOTAL_BYTES=5368709120   # 5GB max total
BACKUP_MIN_FREE_BYTES=1073741824    # 1GB min free space
BACKUP_DIR=/data/backup
```

### 8.2 Manual Backup

```bash
# Stop the backend first for consistency
docker compose stop backend

# Copy the database
cp backend/data/glowtype.db backup/glowtype_$(date +%Y%m%d_%H%M%S).db

# Restart
docker compose start backend
```

### 8.3 Recovery

```bash
# Stop the backend
docker compose stop backend

# Replace database with backup
cp backup/glowtype_YYYYMMDD_HHMMSS.db backend/data/glowtype.db

# Restart
docker compose start backend
```

---

## 9. Extension Plans

- [ ] Full multi-tenant support
- [ ] More AI model options
- [ ] PDF report export
- [ ] Enhanced data visualization
- [ ] WebSocket real-time updates
