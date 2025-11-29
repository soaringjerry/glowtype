# Glowtype.me Deployment Guide

This guide covers deployment and automated operations.

**Architecture**:
- Docker + docker-compose for frontend/backend services
- GitHub Actions + GHCR for CI/CD
- Watchtower for automatic image updates

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Docker Architecture](#2-docker-architecture)
3. [CI/CD Pipeline](#3-cicd-pipeline)
4. [Environment Variables](#4-environment-variables)
5. [Backup & Recovery](#5-backup--recovery)
6. [Security Configuration](#6-security-configuration)
7. [AI Provider Setup](#7-ai-provider-setup)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Quick Start

### 1.1 One-Line Remote Setup (Recommended)

On a fresh Linux server with Docker available:

```bash
AI_API_KEY=your_key curl -fsSL https://raw.githubusercontent.com/soaringjerry/glowtype/main/scripts/remote_setup.sh | bash
```

The script will:
1. Clone the repository to `~/glowtype`
2. Create `.env` and `backend/.env` files
3. Auto-generate security secrets:
   - `ADMIN_JWT_SECRET` (JWT signing key)
   - `ADMIN_SUPER_PASSWORD` (initial superadmin password)
   - `TOTP_ENCRYPTION_KEY` (2FA secret encryption)
4. Pull/build and start Docker containers
5. Start Watchtower for automatic updates

**After first start**:
1. Check `backend/.env` for the generated `ADMIN_SUPER_PASSWORD`
2. Login to admin panel at `http://your-server:18081/admin`
3. Change the superadmin password immediately
4. Enable 2FA for the superadmin account

### 1.2 Manual Setup

```bash
git clone https://github.com/soaringjerry/glowtype.git
cd glowtype
chmod +x scripts/setup_and_run.sh
./scripts/setup_and_run.sh
```

### 1.3 Default Ports

| Service | Host Port | Container Port |
|---------|-----------|----------------|
| Backend | 18080 | 8080 |
| Frontend | 18081 | 80 |
| Share Render | 19080 | 3000 |

Change ports in root `.env`:
```env
GLOWTYPE_BACKEND_PORT_HOST=18080
GLOWTYPE_FRONTEND_PORT_HOST=18081
GLOWTYPE_RENDER_PORT_HOST=19080
```

---

## 2. Docker Architecture

### 2.1 Directory Structure

```
glowtype/
├── Dockerfile.backend        # Go backend (multi-stage, distroless)
├── Dockerfile.frontend       # React frontend (Node build + Nginx)
├── Dockerfile.frontend.prod  # Production frontend (smaller)
├── docker-compose.yml        # Service orchestration
├── .env                      # Root environment variables
├── .env.example              # Root env template
├── backend/
│   ├── .env                  # Backend environment variables
│   └── .env.example          # Backend env template
├── frontend/
│   └── nginx.conf            # Nginx config (SPA fallback)
└── scripts/
    ├── setup_and_run.sh      # One-click setup
    └── remote_setup.sh       # Remote installation
```

### 2.2 Backend Image (Dockerfile.backend)

- Build stage: `golang:1.24`
- Runtime stage: `alpine:3.20` (non-root user)
- Exposes port 8080
- Includes `backend/config` directory

### 2.3 Frontend Image (Dockerfile.frontend)

- Build stage: `node:22-alpine`
  - Runs `npm ci && npm run build`
  - Uses `VITE_API_BASE_URL` build argument
- Runtime stage: `nginx:1.27-alpine`
  - SPA routing (all paths → index.html)
  - Privacy-friendly logging (no client IP)

### 2.4 Services (docker-compose.yml)

| Service | Description |
|---------|-------------|
| `backend` | Go API server |
| `frontend` | Nginx serving React app |
| `watchtower` | Auto-updates from GHCR |

Watchtower configuration:
- `--label-enable`: Only monitors labeled containers
- `--interval=300`: Checks every 5 minutes
- `--cleanup`: Removes old images after update

---

## 3. CI/CD Pipeline

### 3.1 Workflow: `.github/workflows/deploy.yml`

**Trigger**: Push to `main` branch

### 3.2 Job 1: test-and-build

- Backend: Go 1.24, runs `go test ./...`
- Frontend: Node 22, runs `npm ci && npm run build`

### 3.3 Job 2: docker-build-and-push

- Uses Docker Buildx
- Pushes to GHCR:
  - `ghcr.io/<owner>/glowtype-backend:latest`
  - `ghcr.io/<owner>/glowtype-frontend:latest`

### 3.4 Automatic Updates

With Watchtower running:
1. CI pushes new images to GHCR
2. Watchtower detects updates
3. Watchtower pulls and restarts containers

Manual update:
```bash
docker compose pull && docker compose up -d
```

---

## 4. Environment Variables

### 4.1 Root `.env`

```env
# Port configuration
GLOWTYPE_BACKEND_PORT_HOST=18080
GLOWTYPE_FRONTEND_PORT_HOST=18081
GLOWTYPE_RENDER_PORT_HOST=19080

# API URL for frontend build
VITE_API_BASE_URL=http://backend:8080/api/v1
VITE_SHARE_RENDER_URL=http://localhost:19080

# AI configuration (client-side)
VITE_AI_API_KEY=sk-xxx
VITE_AI_API_URL=https://api.openai.com/v1
VITE_AI_MODEL=gpt-4o-mini
```

### 4.2 Backend `backend/.env`

```env
# Server
PORT=8080
ENV=production
ALLOWED_ORIGINS=https://glowtype.me
LOG_LEVEL=info

# Database
DB_PATH=/data/glowtype.db
SEED_DB=true

# Admin authentication
ADMIN_JWT_SECRET=your_strong_secret_here
ADMIN_SUPER_USERNAME=superadmin
ADMIN_SUPER_PASSWORD=your_secure_password

# Two-factor authentication
TOTP_ENCRYPTION_KEY=your_32_char_key_here
FORCE_ADMIN_2FA=false

# Proxy configuration (for real IP detection)
TRUSTED_PROXIES=auto,cloudflare

# Database backup
BACKUP_ENABLED=1
BACKUP_INTERVAL_MINUTES=60
BACKUP_MAX_TOTAL_BYTES=5368709120
BACKUP_MIN_FREE_BYTES=1073741824
BACKUP_DIR=/data/backup
```

### 4.3 Production Checklist

| Variable | Requirement |
|----------|-------------|
| `ADMIN_JWT_SECRET` | Strong random string (32+ chars) |
| `ADMIN_SUPER_PASSWORD` | Strong password, change after first login |
| `TOTP_ENCRYPTION_KEY` | Exactly 32 characters |
| `ALLOWED_ORIGINS` | Your actual domain(s) |
| `FORCE_ADMIN_2FA` | Set to `true` for security |

---

## 5. Backup & Recovery

### 5.1 Automatic Backups

Enabled by default:
```env
BACKUP_ENABLED=1
BACKUP_INTERVAL_MINUTES=60
BACKUP_DIR=/data/backup
```

Backup files: `glowtype_<timestamp>.db`

### 5.2 Manual Backup

```bash
# Stop backend for consistency
docker compose stop backend

# Copy database
cp backend/data/glowtype.db backup/glowtype_$(date +%Y%m%d_%H%M%S).db

# Restart
docker compose start backend
```

### 5.3 Recovery

```bash
# Stop backend
docker compose stop backend

# Replace database
cp backup/glowtype_YYYYMMDD_HHMMSS.db backend/data/glowtype.db

# Restart
docker compose start backend
```

### 5.4 Backup Retention

- `BACKUP_MAX_TOTAL_BYTES`: Maximum total backup size (default 5GB)
- `BACKUP_MIN_FREE_BYTES`: Minimum free space required (default 1GB)
- Older backups are automatically cleaned up

---

## 6. Security Configuration

### 6.1 Two-Factor Authentication

**Enable globally** (recommended for production):
```env
FORCE_ADMIN_2FA=true
```

**TOTP encryption key** (auto-generated on first start):
```env
TOTP_ENCRYPTION_KEY=your_32_character_key_here
```

### 6.2 Password Reset

If locked out of superadmin:

```env
# Set new password
ADMIN_SUPER_PASSWORD=new_secure_password
ADMIN_SUPER_PASSWORD_ROTATE=true
```

Then restart the backend. The password will be updated.

### 6.3 Disable Rate Limiting (Emergency)

If account is locked:
```env
ADMIN_LOGIN_RATE_LIMIT_DISABLE=1
```

**Important**: Re-enable after resolving the issue.

### 6.4 HTTPS Configuration

Always deploy behind HTTPS. Options:

1. **Cloudflare** (recommended): Free SSL, DDoS protection
2. **nginx reverse proxy**: Use Let's Encrypt for certificates
3. **Traefik**: Automatic certificate management

Example nginx config:
```nginx
server {
    listen 443 ssl;
    server_name glowtype.me;

    ssl_certificate /etc/letsencrypt/live/glowtype.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/glowtype.me/privkey.pem;

    location / {
        proxy_pass http://localhost:18081;
    }

    location /api/ {
        proxy_pass http://localhost:18080;
    }
}
```

---

## 7. AI Provider Setup

### 7.1 Supported Providers

| Provider | Base URL | Notes |
|----------|----------|-------|
| OpenAI | `https://api.openai.com/v1` | Default |
| DeepSeek | `https://api.deepseek.com/v1` | Cost-effective |
| Groq | `https://api.groq.com/openai/v1` | Fast |
| Local LLM | `http://localhost:11434/v1` | Ollama |

### 7.2 Configuration

**Option 1: Environment variables** (frontend direct call)
```env
VITE_AI_API_KEY=sk-xxx
VITE_AI_API_URL=https://api.openai.com/v1
VITE_AI_MODEL=gpt-4o-mini
```

**Option 2: Admin panel** (runtime configuration)
1. Login as superadmin
2. Go to AI Settings
3. Configure provider, API key, model, rate limits

### 7.3 Rate Limiting

Configure in admin panel:
- Enable/disable rate limiting
- Requests per minute (default: 60)
- Burst allowance (default: 10)

---

## 8. Troubleshooting

### 8.1 Container Won't Start

```bash
# Check logs
docker compose logs backend
docker compose logs frontend

# Rebuild images
docker compose build --no-cache
docker compose up -d
```

### 8.2 Database Issues

```bash
# Check database file permissions
ls -la backend/data/

# Restore from backup
docker compose stop backend
cp backup/latest.db backend/data/glowtype.db
docker compose start backend
```

### 8.3 Can't Login to Admin

1. Check `ADMIN_SUPER_PASSWORD` in `backend/.env`
2. If locked out, set `ADMIN_LOGIN_RATE_LIMIT_DISABLE=1` and restart
3. For password reset, set `ADMIN_SUPER_PASSWORD_ROTATE=true` and restart

### 8.4 2FA Issues

If user lost 2FA device:
1. Login as superadmin
2. Go to Admin Accounts
3. Click "Reset 2FA" for the affected user

If superadmin lost 2FA:
1. Access database directly
2. Set `two_factor_enabled=0` for the superadmin user
3. Restart backend

### 8.5 AI Not Working

1. Check API key is set correctly
2. Verify base URL for your provider
3. Check rate limits in admin panel
4. Review backend logs for errors

---

## Appendix: Full Environment Variable Reference

### Root `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `GLOWTYPE_BACKEND_PORT_HOST` | 18080 | Backend host port |
| `GLOWTYPE_FRONTEND_PORT_HOST` | 18081 | Frontend host port |
| `GLOWTYPE_RENDER_PORT_HOST` | 19080 | Share render host port |
| `VITE_API_BASE_URL` | `http://backend:8080/api/v1` | API URL for frontend |
| `VITE_AI_API_KEY` | - | AI API key |
| `VITE_AI_API_URL` | `https://api.openai.com/v1` | AI API base URL |
| `VITE_AI_MODEL` | `gpt-4o-mini` | AI model name |

### Backend `backend/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server port |
| `ENV` | development | Environment mode |
| `ALLOWED_ORIGINS` | - | CORS allowed origins |
| `LOG_LEVEL` | info | Logging level |
| `DB_PATH` | `/data/glowtype.db` | Database file path |
| `SEED_DB` | true | Seed database on start |
| `ADMIN_JWT_SECRET` | - | JWT signing secret |
| `ADMIN_SUPER_USERNAME` | superadmin | Initial admin username |
| `ADMIN_SUPER_PASSWORD` | - | Initial admin password |
| `ADMIN_SUPER_PASSWORD_ROTATE` | false | Force password update |
| `ADMIN_LOGIN_RATE_LIMIT_DISABLE` | false | Disable login rate limiting |
| `TOTP_ENCRYPTION_KEY` | - | 2FA secret encryption key |
| `FORCE_ADMIN_2FA` | false | Require 2FA for all admins |
| `TRUSTED_PROXIES` | - | Proxy config for real IP |
| `BACKUP_ENABLED` | 1 | Enable auto backups |
| `BACKUP_INTERVAL_MINUTES` | 60 | Backup frequency |
| `BACKUP_DIR` | `/data/backup` | Backup directory |
| `BACKUP_MAX_TOTAL_BYTES` | 5GB | Max backup storage |
| `BACKUP_MIN_FREE_BYTES` | 1GB | Min free space |
