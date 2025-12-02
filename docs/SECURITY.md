# Glowtype Security Guide

This document provides comprehensive information about security features, authentication mechanisms, and best practices for the Glowtype admin system.

---

## Table of Contents

1. [Authentication Overview](#1-authentication-overview)
2. [Two-Factor Authentication (2FA)](#2-two-factor-authentication-2fa)
3. [Role-Based Access Control (RBAC)](#3-role-based-access-control-rbac)
4. [Audit Logging](#4-audit-logging)
5. [Data Privacy](#5-data-privacy)
6. [Security Best Practices](#6-security-best-practices)

---

## 1. Authentication Overview

### 1.1 JWT Token Authentication

Admin users authenticate via JWT (JSON Web Token) with HMAC-SHA256 signing.

**Token Structure**:
```json
{
  "adminId": 1,
  "username": "admin",
  "role": "admin",
  "ver": 1,
  "iat": 1732876800,
  "exp": 1732963200
}
```

**Key Properties**:
- **Token Lifetime**: 24 hours
- **Signing Algorithm**: HMAC-SHA256
- **Version Control**: `ver` field enables token invalidation on password/2FA changes

**Important**: The `role` in the token is NOT trusted for authorization. The backend always fetches the actual role from the database for every request.

### 1.2 Login Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Submit    │───▶│   Verify    │───▶│   Check     │
│  Credentials│    │  Password   │    │  2FA Status │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
                          ┌──────────────────┴──────────────────┐
                          │                                     │
                          ▼                                     ▼
                   ┌─────────────┐                       ┌─────────────┐
                   │  2FA Not    │                       │  2FA        │
                   │  Required   │                       │  Required   │
                   └──────┬──────┘                       └──────┬──────┘
                          │                                     │
                          ▼                                     ▼
                   ┌─────────────┐                       ┌─────────────┐
                   │  Issue JWT  │                       │ Issue 2FA   │
                   │   Token     │                       │   Token     │
                   └─────────────┘                       └──────┬──────┘
                                                                │
                                                                ▼
                                                         ┌─────────────┐
                                                         │ Verify TOTP │
                                                         │ or Recovery │
                                                         └──────┬──────┘
                                                                │
                                                                ▼
                                                         ┌─────────────┐
                                                         │  Issue JWT  │
                                                         │   Token     │
                                                         └─────────────┘
```

### 1.3 Brute-Force Protection

The system protects against brute-force attacks with automatic account lockout:

| Parameter | Value |
|-----------|-------|
| Max Failed Attempts | 5 |
| Time Window | 15 minutes |
| Lockout Duration | 15 minutes |

**Behavior**:
- Failed attempts are tracked per username + IP combination
- After 5 failures within 15 minutes, the account is locked
- Lock expires automatically after 15 minutes
- Successful login clears the failure counter

**Emergency Override** (for debugging):
```env
ADMIN_LOGIN_RATE_LIMIT_DISABLE=true
```

---

## 2. Two-Factor Authentication (2FA)

### 2.1 Overview

Glowtype implements TOTP (Time-based One-Time Password) for two-factor authentication, compatible with standard authenticator apps.

**Technical Specifications**:
- **Algorithm**: SHA-256 (upgraded from SHA-1 in v2.0)
- **Time Period**: 30 seconds
- **Digits**: 6
- **Time Skew**: ±1 period (90 seconds total window)

### 2.2 Enabling 2FA

**Step 1: Navigate to Personal Settings**
1. Log into the admin panel
2. Click your username in the top-right corner
3. Select "Settings" from the dropdown

**Step 2: Enable 2FA**
1. In the "Two-Factor Authentication" section, click "Enable 2FA"
2. A QR code will be displayed

**Step 3: Scan QR Code**
1. Open your authenticator app (Google Authenticator, Authy, 1Password, etc. - avoid Microsoft Authenticator; it does not support SHA-256 TOTP)
2. Scan the QR code or manually enter the secret key
3. The app will start generating 6-digit codes

**Step 4: Verify Setup**
1. Enter the current 6-digit code from your authenticator app
2. Click "Verify"

**Step 5: Save Recovery Codes**
1. After verification, 10 recovery codes will be displayed
2. **IMPORTANT**: Save these codes in a secure location
3. Click the eye icon to reveal the codes
4. Copy or write down the codes
5. Check the confirmation box
6. Click "Done"

### 2.3 Recovery Codes

Recovery codes are one-time-use codes for emergency access when you lose your authenticator device.

**Properties**:
- 10 codes generated per setup
- 12-character hexadecimal format (48-bit entropy)
- Each code can only be used once
- Stored as bcrypt hashes (cannot be recovered if lost)

**Using a Recovery Code**:
1. At the 2FA verification screen, click "Use recovery code"
2. Enter one of your recovery codes
3. You will be logged in
4. The used code is invalidated

**Regenerating Recovery Codes**:
1. Go to Personal Settings
2. Click "Regenerate Recovery Codes"
3. Save the new codes
4. Old codes are invalidated

### 2.4 Trusted Devices

Skip 2FA verification for devices you trust.

**How It Works**:
1. During 2FA verification, check "Trust this device"
2. A device token is stored (valid for 7 days)
3. Next login from the same browser skips 2FA

**Managing Trusted Devices**:
1. Go to Personal Settings
2. View "Trusted Devices" list
3. Click "Revoke" to remove individual devices
4. Click "Revoke All" to clear all trusted devices

**Security Note**: Device trust is based on a cookie token. Clearing browser cookies will require 2FA again.

### 2.5 Force 2FA

Superadmins can enforce 2FA for security-sensitive environments.

**Per-User Force**:
1. Go to Admin Accounts
2. Find the user
3. Toggle "Force 2FA" on

**Global Force** (via environment variable):
```env
FORCE_ADMIN_2FA=true
```

When forced, users cannot access most admin features until 2FA is enabled.

### 2.6 Resetting User 2FA (Superadmin)

If a user is locked out:

1. Log into admin panel as superadmin
2. Go to "Admin Accounts"
3. Find the locked-out user
4. Click "Reset 2FA"
5. User can now login with password only and set up 2FA again

### 2.7 TOTP Secret Storage

TOTP secrets are stored securely:
- Encrypted with AES-256-GCM
- Encryption key from `TOTP_ENCRYPTION_KEY` environment variable
- 32-character key required (auto-generated on first start)

---

## 3. Role-Based Access Control (RBAC)

### 3.1 Available Roles

| Role | Description | Use Case |
|------|-------------|----------|
| `superadmin` | Full system access | System administrators |
| `admin` | Standard admin access | Content and data managers |
| `content_admin` | Glowpedia content only | Content creators |
| `data_admin` | Quiz data management | Data entry personnel |
| `analyst` | View-only analytics | Researchers, analysts |
| `viewer` | Read-only all areas | Auditors, stakeholders |

### 3.2 Permission Matrix

| Permission | superadmin | admin | content_admin | data_admin | analyst | viewer |
|------------|:----------:|:-----:|:-------------:|:----------:|:-------:|:------:|
| `admin.manage` | ✓ | | | | | |
| `audit.view` | ✓ | | | | ✓ | |
| `dimensions.write` | ✓ | ✓ | | ✓ | | |
| `questions.write` | ✓ | ✓ | | ✓ | | |
| `rules.write` | ✓ | ✓ | | ✓ | | |
| `glowtypes.write` | ✓ | ✓ | | ✓ | | |
| `prompts.write` | ✓ | ✓ | | ✓ | | |
| `content.write` | ✓ | ✓ | ✓ | | | |
| `stats.view` | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `results.view` | ✓ | ✓ | | ✓ | ✓ | |
| `data.reset` | ✓ | | | | | |

**Note**: `viewer` role can access all pages but backend enforces read-only (GET/HEAD/OPTIONS only).

### 3.3 Custom Permissions

Override role defaults with per-user custom permissions:

1. Go to Admin Accounts
2. Edit user
3. Toggle individual permissions
4. Custom permissions take precedence over role defaults

### 3.4 Permission Enforcement

Permissions are enforced at multiple levels:

1. **Route Middleware**: Backend checks permissions before handler execution
2. **UI Disabling**: Frontend disables unauthorized actions
3. **Database Verification**: User role fetched from database for every request (not from token)

---

## 4. Audit Logging

### 4.1 What Gets Logged

All admin operations are recorded with:

| Field | Description |
|-------|-------------|
| `adminId` | User who performed the action |
| `username` | Username for easy identification |
| `action` | Full description (e.g., "PUT /api/v1/admin/chapters/5") |
| `method` | HTTP method |
| `path` | API endpoint |
| `statusCode` | Response status |
| `ip` | Client IP address |
| `metadata` | Detailed JSON payload |

### 4.2 Metadata Content

The `metadata` JSON includes:

```json
{
  "requestedAt": "2025-11-29T10:30:00Z",
  "durationMs": 45,
  "adminRole": "admin",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "pathParams": { "id": "5" },
  "query": { "lang": "en" },
  "requestBody": { "name": "Updated Name" },
  "responseSample": "{\"success\":true}"
}
```

### 4.3 Sensitive Data Handling

- **Automatic Redaction**: Fields named `password`, `token`, `secret`, `apiKey` are replaced with `[redacted]`
- **Size Limits**: Request body truncated at 8KB, response at 4KB
- **Large Payloads**: Bodies >2MB are skipped entirely

### 4.4 Viewing Audit Logs

1. Log in as superadmin or analyst
2. Go to "Audit Logs" in sidebar
3. Filter by:
   - Date range
   - Admin user
   - Action type
   - Status code

---

## 5. Data Privacy

### 5.1 No PII Collection

Glowtype is designed with privacy-first principles:

- **No IP Storage**: IP addresses are converted to region codes then discarded
- **No User Accounts**: Quiz takers are anonymous
- **No Tracking IDs**: No persistent identifiers stored

### 5.2 Anonymization Process

```
User Request
     │
     ▼
┌─────────────────┐
│ Extract IP      │
│ from Request    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ GeoIP Lookup    │──▶ Region Code (e.g., "US", "CN")
│ CF-IPCountry or │
│ ip-api.com      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Discard IP      │
│ Store Region    │
└─────────────────┘
```

### 5.3 Data Stored

For quiz results:
- Dimension scores
- Result type code
- Language preference
- Region code (country level)
- Device type (mobile/desktop/tablet)
- Hour of day (0-23)
- Traffic attribution (optional)

**NOT stored**:
- IP address
- Name, email, or any PII
- Precise location
- High-precision timestamps (created_at is truncated to the minute; only hour-of-day is retained for analytics)

---

## 6. Security Best Practices

### 6.1 For Deployment

1. **Use Strong Secrets**:
   ```bash
   # Generate strong JWT secret
   openssl rand -base64 32

   # Generate TOTP encryption key
   openssl rand -hex 16
   ```

2. **Enable HTTPS**: Always deploy behind HTTPS (use Cloudflare, nginx, or similar)

3. **Set Allowed Origins**:
   ```env
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

4. **Enable 2FA Globally**:
   ```env
   FORCE_ADMIN_2FA=true
   ```

5. **Regular Backups**:
   ```env
   BACKUP_ENABLED=1
   BACKUP_INTERVAL_MINUTES=60
   ```

### 6.2 For Admin Users

1. **Enable 2FA** immediately after account creation
2. **Save recovery codes** in a secure password manager
3. **Use unique passwords** (not shared with other services)
4. **Log out** when using shared computers
5. **Review trusted devices** periodically

### 6.3 For Superadmins

1. **Limit superadmin accounts** to essential personnel
2. **Review audit logs** regularly
3. **Enforce 2FA** for all users with sensitive access
4. **Rotate secrets** periodically (JWT secret, TOTP encryption key)
5. **Keep backups** in a separate location

### 6.4 Environment Variable Checklist

Required for production:

| Variable | Purpose | Example |
|----------|---------|---------|
| `ADMIN_JWT_SECRET` | JWT signing | Random 32+ chars |
| `ADMIN_SUPER_PASSWORD` | Initial superadmin password | Strong password |
| `TOTP_ENCRYPTION_KEY` | 2FA secret encryption | 32 hex chars |
| `ALLOWED_ORIGINS` | CORS whitelist | `https://yourdomain.com` |
| `TRUSTED_PROXIES` | Real IP detection | `auto,cloudflare` |

Optional but recommended:

| Variable | Purpose | Default |
|----------|---------|---------|
| `FORCE_ADMIN_2FA` | Require 2FA for all | `false` |
| `BACKUP_ENABLED` | Auto backups | `1` |

---

## Appendix: Security Event Audit Metadata

2FA-related events include additional audit metadata:

| Event | Metadata Fields |
|-------|-----------------|
| 2FA Enabled | `eventType: "2fa_enabled"`, `recoveryCodesCount` |
| 2FA Disabled | `eventType: "2fa_disabled"` |
| Recovery Codes Regenerated | `eventType: "2fa_recovery_codes_regenerated"`, `recoveryCodesCount` |
| Login with Recovery Code | `eventType: "2fa_auth_recovery_code"`, `recoveryCodesLeft`, `deviceTrusted` |

This enables security monitoring and incident response.
