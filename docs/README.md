# Glowtype Documentation

Welcome to the Glowtype documentation. This guide covers all aspects of deploying, configuring, and operating Glowtype.

---

## Quick Links

| I want to... | Go to... |
|--------------|----------|
| Deploy Glowtype | [DEPLOYMENT.md](../DEPLOYMENT.md) |
| Understand the architecture | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| Configure the admin panel | [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) |
| Set up AI chat | [AI_INTEGRATION.md](./AI_INTEGRATION.md) |
| Configure quiz scoring | [SCORING_RULES.md](./SCORING_RULES.md) |
| Implement security features | [SECURITY.md](./SECURITY.md) |
| Integrate with the API | [API_REFERENCE.md](./API_REFERENCE.md) |
| Fix a problem | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |

---

## Documentation Overview

### Core Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [README.md](../README.md) | Project overview and quick start | Everyone |
| [DEPLOYMENT.md](../DEPLOYMENT.md) | Installation, Docker, CI/CD | DevOps, Admins |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Architecture, data models, tech stack | Developers |

### Feature Guides

| Document | Description | Audience |
|----------|-------------|----------|
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) | Admin panel user guide | Administrators |
| [AI_INTEGRATION.md](./AI_INTEGRATION.md) | AI provider setup, prompts, rate limiting | Admins, Developers |
| [SCORING_RULES.md](./SCORING_RULES.md) | Quiz dimensions, questions, rules | Content Managers |
| [SECURITY.md](./SECURITY.md) | Authentication, 2FA, RBAC, audit logging | Admins, Security |

### Reference

| Document | Description | Audience |
|----------|-------------|----------|
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete REST API documentation | Developers |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions | Everyone |

---

## Getting Started

### For Deployment

1. Read [DEPLOYMENT.md](../DEPLOYMENT.md) for setup instructions
2. Configure environment variables
3. Start Docker containers
4. Access admin panel and change default password

### For Development

1. Read [DEVELOPMENT.md](./DEVELOPMENT.md) for architecture overview
2. Set up local development environment
3. Review [API_REFERENCE.md](./API_REFERENCE.md) for endpoints

### For Administration

1. Read [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for panel usage
2. Enable 2FA following [SECURITY.md](./SECURITY.md)
3. Configure AI via [AI_INTEGRATION.md](./AI_INTEGRATION.md)
4. Set up quiz content via [SCORING_RULES.md](./SCORING_RULES.md)

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                            │
│              React + TypeScript + Vite                   │
│         react-i18next (EN/ZH) + TailwindCSS             │
└────────────────────────┬────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────┐
│                      Backend                             │
│                   Go + Gin Framework                     │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │   Quiz   │  │   Chat   │  │  Admin   │  │  Stats   ││
│  │ Service  │  │ Service  │  │ Service  │  │ Service  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │              SQLite + GORM                        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Key Features

### Quiz System
- Multilingual questions (English/Chinese)
- Configurable personality dimensions
- Flexible scoring rules
- 8 Glowtype result types

### AI Integration
- OpenAI-compatible API support
- Supportive chat companion
- Cosmic insight generation
- Crisis detection and help resources

### Admin Panel
- Dashboard with usage statistics
- Content management (questions, rules, glowtypes)
- User management with RBAC
- AI configuration
- Audit logging

### Security
- JWT authentication
- Two-factor authentication (TOTP)
- Role-based access control (6 roles)
- Brute-force protection
- Comprehensive audit logging
- Privacy-first design (no PII)

---

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite build tool
- TailwindCSS for styling
- react-i18next for internationalization
- Zustand for state management

### Backend
- Go 1.24
- Gin web framework
- GORM ORM
- SQLite database
- JWT authentication

### Infrastructure
- Docker + docker-compose
- GitHub Actions CI/CD
- Watchtower for auto-updates
- Nginx for frontend serving

---

## Support

### Troubleshooting
See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues.

### Logs
```bash
# View all logs
docker compose logs -f

# View specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Getting Help
1. Check the documentation
2. Review logs for error messages
3. Search existing issues
4. File a new issue with:
   - Error messages
   - Steps to reproduce
   - Environment details

---

## Document Changelog

| Version | Date | Changes |
|---------|------|---------|
| v2.0 | 2025-11-29 | **Major documentation overhaul**: Complete rewrite in English, added 6 new guides (AI_INTEGRATION, SCORING_RULES, TROUBLESHOOTING, SECURITY, API_REFERENCE, ADMIN_GUIDE), updated DEPLOYMENT.md and DEVELOPMENT.md with all new features (2FA, RBAC, AI settings, backups) |
| v1.0 | 2025-11-01 | Initial documentation |
