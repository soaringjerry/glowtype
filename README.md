# Glowtype.me

Glowtype.me is a bilingual (English / Simplified Chinese) emotional type quiz site designed for young people. It offers a light, non-diagnostic way to reflect on feelings, plus optional anonymous chat and help resources.

## Repository Structure

- `frontend/`: React + TypeScript + Vite SPA with react-i18next for i18n
- `backend/`: Go (Gin) REST API providing quiz, scoring, glowtype content, AI chat, and admin panel
- `docs/`: Comprehensive documentation

## Documentation

**[📚 Full Documentation Index →](./docs/README.md)**

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment guide, Docker setup, CI/CD |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Architecture, data models, API overview |
| [docs/SECURITY.md](./docs/SECURITY.md) | Authentication, 2FA, RBAC, audit logging |
| [docs/ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) | Admin panel user guide |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | Complete REST API reference |
| [docs/AI_INTEGRATION.md](./docs/AI_INTEGRATION.md) | AI provider setup and configuration |
| [docs/SCORING_RULES.md](./docs/SCORING_RULES.md) | Quiz scoring system guide |
| [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Common issues and solutions |

## Quick Start

### One-liner Remote Setup (Recommended)

On a fresh Linux server with Docker available:

```bash
AI_API_KEY=your_key curl -fsSL https://raw.githubusercontent.com/soaringjerry/glowtype/main/scripts/remote_setup.sh | bash
```

The script will:
- Clone the repository to `~/glowtype`
- Create and configure environment files
- Auto-generate admin credentials and security keys
- Start Docker containers with Watchtower for auto-updates

**After first start**:
1. Check `backend/.env` for the generated `ADMIN_SUPER_PASSWORD`
2. Login at `http://your-server:18081/admin`
3. Change password and enable 2FA immediately

### Environment Variables

Override defaults with environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_API_KEY` | OpenAI-compatible API key | - |
| `AI_API_URL` | AI provider base URL | `https://api.openai.com/v1` |
| `AI_MODEL` | AI model name | `gpt-4o-mini` |
| `GLOWTYPE_INSTALL_DIR` | Installation directory | `~/glowtype` |
| `GLOWTYPE_BRANCH` | Git branch | `main` |

## Ports

| Service | Host Port | Container Port |
|---------|-----------|----------------|
| Backend | 18080 | 8080 |
| Frontend | 18081 | 80 |

Change in root `.env`:
```env
GLOWTYPE_BACKEND_PORT_HOST=18080
GLOWTYPE_FRONTEND_PORT_HOST=18081
```

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
go run ./cmd/glowtype-api
```

Default: `http://localhost:18080/api/v1`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Default: `http://localhost:5173`

Configure `VITE_API_BASE_URL` in `.env.local` to point to the backend.

## Admin Panel Features

- **Dashboard**: Usage statistics, trends, geographic distribution
- **Content Management**: Quiz questions, glowtypes, scoring rules, AI prompts
- **Glowpedia**: Manage supportive content library
- **User Management**: Multiple admin roles with RBAC permissions
- **Security**: Two-factor authentication, audit logging
- **AI Settings**: Configure AI provider and rate limits (superadmin)

## Database Backups

Automatic hourly backups are enabled by default:

```env
BACKUP_ENABLED=1
BACKUP_INTERVAL_MINUTES=60
BACKUP_MAX_TOTAL_BYTES=5368709120  # 5GB
BACKUP_DIR=/data/backup
```

Files are named `glowtype_<timestamp>.db`. Restore by stopping the backend and replacing the database file.

## Security

- **Two-Factor Authentication**: TOTP with SHA-256, recovery codes, trusted devices
- **RBAC**: 6 roles with granular permissions
- **Audit Logging**: All admin operations recorded
- **Privacy First**: No PII collected, IP anonymized to region codes

See [docs/SECURITY.md](./docs/SECURITY.md) for details.

## Troubleshooting

### Forgot Admin Password

Set in `backend/.env`:
```env
ADMIN_SUPER_PASSWORD=new_password
ADMIN_SUPER_PASSWORD_ROTATE=true
```
Then restart the backend.

### Account Locked

Set in `backend/.env`:
```env
ADMIN_LOGIN_RATE_LIMIT_DISABLE=1
```
Restart, login, then re-enable rate limiting.

### Lost 2FA Device

Superadmin can reset user 2FA in Admin Accounts page. If superadmin lost 2FA, directly update the database.

See [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for more.

## License

MIT
