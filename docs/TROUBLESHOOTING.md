# Glowtype Troubleshooting Guide

Common issues and solutions for Glowtype deployment and operation.

---

## Table of Contents

1. [Admin Login Issues](#1-admin-login-issues)
2. [Two-Factor Authentication Issues](#2-two-factor-authentication-issues)
3. [Database Issues](#3-database-issues)
4. [Docker & Deployment Issues](#4-docker--deployment-issues)
5. [AI Chat Issues](#5-ai-chat-issues)
6. [Frontend Issues](#6-frontend-issues)
7. [Performance Issues](#7-performance-issues)

---

## 1. Admin Login Issues

### 1.1 Forgot Admin Password

**Symptom**: Cannot login to admin panel with any password.

**Solution**:

1. Edit `backend/.env`:
   ```env
   ADMIN_SUPER_PASSWORD=your_new_secure_password
   ADMIN_SUPER_PASSWORD_ROTATE=true
   ```

2. Restart the backend:
   ```bash
   docker compose restart backend
   ```

3. Login with the new password.

4. **Important**: Remove `ADMIN_SUPER_PASSWORD_ROTATE=true` after successful login.

### 1.2 Account Locked (Too Many Failed Attempts)

**Symptom**: Error message "Too many login attempts. Please try again later."

**Cause**: 5+ failed login attempts within 15 minutes.

**Solution A** (Wait):
- Wait 15 minutes for automatic unlock.

**Solution B** (Emergency override):

1. Edit `backend/.env`:
   ```env
   ADMIN_LOGIN_RATE_LIMIT_DISABLE=1
   ```

2. Restart backend:
   ```bash
   docker compose restart backend
   ```

3. Login successfully.

4. **Critical**: Re-enable rate limiting after login:
   ```env
   ADMIN_LOGIN_RATE_LIMIT_DISABLE=0
   ```

### 1.3 "Invalid Credentials" with Correct Password

**Possible Causes**:

1. **Password was rotated**: Check if `ADMIN_SUPER_PASSWORD_ROTATE=true` was set previously.

2. **Account deactivated**: Another admin may have deactivated the account.

3. **Username case sensitivity**: Usernames are case-sensitive.

**Solution**:
- Try the password in `backend/.env` (`ADMIN_SUPER_PASSWORD`).
- If using a non-superadmin account, ask superadmin to check account status.

### 1.4 JWT Token Errors

**Symptom**: "Unauthorized" or "Token expired" errors after login.

**Possible Causes**:

1. **Clock skew**: Server time is significantly different from client.
2. **JWT secret changed**: `ADMIN_JWT_SECRET` was modified.
3. **Token version mismatch**: Password or 2FA was changed.

**Solutions**:

1. Sync server time:
   ```bash
   sudo timedatectl set-ntp true
   ```

2. Clear browser cookies and login again.

3. If JWT secret was changed, all users must re-login.

---

## 2. Two-Factor Authentication Issues

### 2.1 Lost Authenticator Device

**Symptom**: Cannot access authenticator app with 2FA codes.

**Solution A** (Use recovery code):

1. At the 2FA verification screen, click "Use recovery code".
2. Enter one of your saved recovery codes.
3. After login, go to Settings and set up 2FA again with new device.

**Solution B** (Superadmin reset):

1. Contact your superadmin.
2. Superadmin goes to Admin Accounts.
3. Finds your account and clicks "Reset 2FA".
4. You can now login with password only and re-enable 2FA.

### 2.2 Superadmin Lost 2FA Device (No Recovery Codes)

**Symptom**: Superadmin cannot access admin panel due to lost 2FA.

**Solution** (Direct database modification):

1. Stop the backend:
   ```bash
   docker compose stop backend
   ```

2. Access the database:
   ```bash
   sqlite3 backend/data/glowtype.db
   ```

3. Disable 2FA for superadmin:
   ```sql
   UPDATE admin_users
   SET two_factor_enabled = 0,
       two_factor_secret = NULL,
       token_version = token_version + 1
   WHERE username = 'superadmin';
   ```

4. Exit and restart:
   ```bash
   .quit
   docker compose start backend
   ```

5. Login and re-enable 2FA immediately.

### 2.3 2FA Codes Not Working

**Symptom**: 6-digit codes from authenticator app are rejected.

**Possible Causes**:

1. **Time drift**: Device clock is out of sync.
2. **Wrong algorithm**: App using SHA-1 instead of SHA-256.
3. **Old secret**: 2FA was re-setup but old entry not removed from app.

**Solutions**:

1. **Sync device time**:
   - iPhone: Settings > General > Date & Time > Set Automatically
   - Android: Settings > System > Date & time > Automatic date & time

2. **Use recovery code** and re-setup 2FA:
   - Delete old entry from authenticator app.
   - Scan new QR code.
   - Ensure app shows "SHA256" in account details.

3. **Try adjacent codes**: The system accepts codes from ±1 time period (90 seconds window).

### 2.4 "Two-factor authentication required" But Not Set Up

**Symptom**: Error requiring 2FA but user hasn't enabled it.

**Cause**: Admin has `force_two_factor = true` or global `FORCE_ADMIN_2FA=true`.

**Solution**:
- Complete 2FA setup before accessing other features.
- After login, you'll be redirected to 2FA setup automatically.

### 2.5 Trusted Device Not Working

**Symptom**: Still prompted for 2FA despite trusting the device.

**Causes**:

1. Browser cookies cleared.
2. Device token expired (7-day default).
3. Using different browser/profile.

**Solution**:
- Trust the device again during next 2FA verification.

---

## 3. Database Issues

### 3.1 Database Locked

**Symptom**: "database is locked" errors in logs.

**Cause**: Multiple processes accessing SQLite simultaneously.

**Solutions**:

1. Ensure only one backend instance is running:
   ```bash
   docker compose ps
   ```

2. Restart the backend:
   ```bash
   docker compose restart backend
   ```

3. Check for zombie processes:
   ```bash
   docker compose down && docker compose up -d
   ```

### 3.2 Database Corrupted

**Symptom**: "malformed database schema" or "database disk image is malformed".

**Solution**:

1. Stop the backend:
   ```bash
   docker compose stop backend
   ```

2. Try to recover:
   ```bash
   cd backend/data
   sqlite3 glowtype.db ".recover" | sqlite3 recovered.db
   mv glowtype.db glowtype.db.corrupt
   mv recovered.db glowtype.db
   ```

3. If recovery fails, restore from backup:
   ```bash
   ls -la backup/
   cp backup/glowtype_YYYYMMDD_HHMMSS.db glowtype.db
   ```

4. Restart backend:
   ```bash
   docker compose start backend
   ```

### 3.3 Database File Not Found

**Symptom**: "no such file or directory" for database.

**Cause**: Volume mount issue or first-time setup.

**Solutions**:

1. Check volume mounts in `docker-compose.yml`:
   ```yaml
   volumes:
     - ./backend/data:/data
   ```

2. Create the data directory:
   ```bash
   mkdir -p backend/data
   chmod 755 backend/data
   ```

3. Restart with database seeding:
   ```bash
   docker compose down && docker compose up -d
   ```

### 3.4 Backup Not Running

**Symptom**: No backup files being created.

**Check configuration**:

1. Verify in `backend/.env`:
   ```env
   BACKUP_ENABLED=1
   BACKUP_INTERVAL_MINUTES=60
   BACKUP_DIR=/data/backup
   ```

2. Check available disk space:
   ```bash
   df -h
   ```

3. Check backup directory exists and is writable:
   ```bash
   ls -la backend/data/backup/
   ```

4. Check logs for backup errors:
   ```bash
   docker compose logs backend | grep -i backup
   ```

---

## 4. Docker & Deployment Issues

### 4.1 Container Won't Start

**Symptom**: Container exits immediately or keeps restarting.

**Diagnosis**:
```bash
docker compose logs backend
docker compose logs frontend
```

**Common causes and solutions**:

1. **Missing environment file**:
   ```bash
   cp backend/.env.example backend/.env
   # Edit and fill required values
   ```

2. **Port already in use**:
   ```bash
   # Find process using port
   lsof -i :18080
   # Change port in .env
   GLOWTYPE_BACKEND_PORT_HOST=18082
   ```

3. **Permission denied**:
   ```bash
   chmod 755 backend/data
   chown -R 1000:1000 backend/data
   ```

### 4.2 Watchtower Not Updating

**Symptom**: New images pushed but containers not updated.

**Check Watchtower status**:
```bash
docker compose logs watchtower
```

**Common causes**:

1. **Label missing**: Ensure containers have the label:
   ```yaml
   labels:
     - "com.centurylinklabs.watchtower.enable=true"
   ```

2. **Registry authentication**: For private registries:
   ```bash
   docker login ghcr.io
   ```

3. **Manual update**:
   ```bash
   docker compose pull && docker compose up -d
   ```

### 4.3 CORS Errors

**Symptom**: Browser console shows "blocked by CORS policy".

**Solution**:

1. Check `backend/.env`:
   ```env
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

2. For development, allow localhost:
   ```env
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:18081
   ```

3. Restart backend after changes.

### 4.4 Build Failures

**Symptom**: `docker compose build` fails.

**Common solutions**:

1. **Clear cache**:
   ```bash
   docker compose build --no-cache
   ```

2. **Prune unused resources**:
   ```bash
   docker system prune -a
   ```

3. **Check disk space**:
   ```bash
   df -h
   ```

### 4.5 Network Connection Issues Between Containers

**Symptom**: Frontend can't reach backend API.

**Solutions**:

1. Check containers are on same network:
   ```bash
   docker network inspect glowtype_default
   ```

2. Test connectivity:
   ```bash
   docker compose exec frontend ping backend
   ```

3. Check `VITE_API_BASE_URL` in root `.env`:
   ```env
   VITE_API_BASE_URL=http://backend:8080/api/v1
   ```

---

## 5. AI Chat Issues

### 5.1 AI Not Responding

**Symptom**: Chat messages return errors or no response.

**Diagnosis**:
```bash
docker compose logs backend | grep -i "ai\|chat\|openai"
```

**Common causes**:

1. **Invalid API key**:
   - Check key in Admin Panel > AI Settings.
   - Or in `backend/.env` for frontend direct calls.

2. **Wrong base URL**:
   | Provider | Base URL |
   |----------|----------|
   | OpenAI | `https://api.openai.com/v1` |
   | DeepSeek | `https://api.deepseek.com/v1` |
   | Groq | `https://api.groq.com/openai/v1` |

3. **AI disabled**:
   - Check Admin Panel > AI Settings > "Is Active".

4. **Rate limited by provider**:
   - Check provider dashboard for quota.

### 5.2 Rate Limit Errors

**Symptom**: "Rate limit exceeded" or 429 errors.

**Solutions**:

1. **Adjust internal rate limits** (Admin Panel > AI Settings):
   - Increase "Requests Per Minute".
   - Increase "Burst" allowance.

2. **Check provider rate limits**:
   - OpenAI: Check usage dashboard.
   - Consider upgrading API plan.

### 5.3 Slow AI Responses

**Possible causes**:

1. **High provider latency**: Try different provider or model.
2. **Large context**: Reduce conversation history length.
3. **Model selection**: Use faster models (e.g., `gpt-4o-mini` instead of `gpt-4`).

### 5.4 AI Returning Unexpected Content

**Solutions**:

1. Review and update prompts in Admin Panel > Prompts.
2. Check for prompt injection in user messages.
3. Ensure crisis detection prompt is properly configured.

---

## 6. Frontend Issues

### 6.1 Blank Page After Deployment

**Symptom**: Frontend shows blank white page.

**Diagnosis**:
```bash
# Check browser console for errors
# Check nginx logs
docker compose logs frontend
```

**Common causes**:

1. **Build failed silently**:
   ```bash
   docker compose build --no-cache frontend
   docker compose up -d frontend
   ```

2. **API URL misconfigured**:
   - Check `VITE_API_BASE_URL` in root `.env`.
   - Rebuild frontend after changing.

3. **SPA routing issue**:
   - Verify nginx config has fallback to index.html.

### 6.2 i18n/Translation Missing

**Symptom**: Keys like `quiz.question1` shown instead of text.

**Solutions**:

1. Check language files exist in `frontend/src/i18n/`.
2. Verify language detection (browser language or URL parameter).
3. Check for JSON syntax errors in translation files.

### 6.3 Styles Not Loading

**Symptom**: Page loads but looks unstyled.

**Solutions**:

1. Rebuild with cache clear:
   ```bash
   docker compose build --no-cache frontend
   ```

2. Check Tailwind safelist in `tailwind.config.js` if using dynamic classes.

### 6.4 Quiz Results Not Showing

**Symptom**: Quiz completes but result page is empty.

**Check**:

1. Backend API is reachable.
2. Glowtypes exist in database.
3. Scoring rules are configured correctly.
4. Check browser network tab for API errors.

---

## 7. Performance Issues

### 7.1 Slow Database Queries

**Symptom**: API responses taking >1 second.

**Solutions**:

1. Add indexes (if missing):
   ```sql
   CREATE INDEX IF NOT EXISTS idx_quiz_results_created_at ON quiz_results(created_at);
   CREATE INDEX IF NOT EXISTS idx_quiz_results_glowtype ON quiz_results(result_type_code);
   ```

2. Vacuum database:
   ```bash
   sqlite3 backend/data/glowtype.db "VACUUM;"
   ```

3. Check database size:
   ```bash
   ls -lh backend/data/glowtype.db
   ```

### 7.2 High Memory Usage

**Symptom**: Backend using excessive memory.

**Solutions**:

1. Restart containers:
   ```bash
   docker compose restart
   ```

2. Set memory limits in `docker-compose.yml`:
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             memory: 512M
   ```

### 7.3 Container Logs Too Large

**Symptom**: Disk filling up with Docker logs.

**Solution**:

Add to `docker-compose.yml`:
```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Quick Reference: Environment Variable Troubleshooting

| Issue | Variable to Check | Location |
|-------|-------------------|----------|
| Can't login | `ADMIN_SUPER_PASSWORD` | `backend/.env` |
| Account locked | `ADMIN_LOGIN_RATE_LIMIT_DISABLE` | `backend/.env` |
| 2FA issues | `TOTP_ENCRYPTION_KEY` | `backend/.env` |
| CORS errors | `ALLOWED_ORIGINS` | `backend/.env` |
| AI not working | `VITE_AI_API_KEY`, `VITE_AI_API_URL` | root `.env` |
| Wrong ports | `GLOWTYPE_*_PORT_HOST` | root `.env` |
| API unreachable | `VITE_API_BASE_URL` | root `.env` |

---

## Getting Help

If issues persist:

1. **Check logs**:
   ```bash
   docker compose logs -f
   ```

2. **Review configuration**:
   - Compare with `.env.example` files.
   - Check for typos in variable names.

3. **Restart fresh**:
   ```bash
   docker compose down
   docker compose up -d
   ```

4. **File an issue**: Include logs, environment (without secrets), and steps to reproduce.
