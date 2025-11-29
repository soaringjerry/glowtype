# Glowtype API Reference

Complete REST API documentation for Glowtype backend.

**Base URL**: `https://api.glowtype.me/api/v1`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Public API](#2-public-api)
3. [Admin API](#3-admin-api)
4. [Error Handling](#4-error-handling)

---

## 1. Authentication

### 1.1 Admin Authentication

Admin endpoints require JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### 1.2 Login

**Endpoint**: `POST /admin/login`

**Request**:
```json
{
  "username": "admin",
  "password": "your_password"
}
```

**Response (No 2FA)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2025-11-30T10:30:00Z",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "twoFactorEnabled": false
  }
}
```

**Response (2FA Required)**:
```json
{
  "requiresTwoFA": true,
  "twoFAToken": "temp_token_for_2fa_verification",
  "twoFATokenExpiresAt": "2025-11-29T10:35:00Z"
}
```

### 1.3 2FA Verification

**Endpoint**: `POST /admin/2fa/authenticate`

**Request**:
```json
{
  "twoFAToken": "temp_token_from_login",
  "code": "123456",
  "trustDevice": true,
  "deviceName": "Chrome on MacBook"
}
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2025-11-30T10:30:00Z",
  "deviceToken": "optional_device_trust_token"
}
```

---

## 2. Public API

Public endpoints do not require authentication.

### 2.1 Health Check

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-29T10:30:00Z"
}
```

### 2.2 Get Quiz Questions

**Endpoint**: `GET /quiz`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code (en, zh) |

**Response**:
```json
{
  "questions": [
    {
      "id": "q1",
      "order": 1,
      "question": {
        "en": "How do you recharge after a long day?",
        "zh": "漫长一天后你如何恢复精力？"
      },
      "options": [
        {
          "text": {
            "en": "Spending time with friends",
            "zh": "和朋友在一起"
          },
          "value": "extrovert"
        }
      ]
    }
  ],
  "totalQuestions": 12
}
```

### 2.3 Score Quiz

**Endpoint**: `POST /quiz/score`

**Request**:
```json
{
  "answers": [
    { "questionId": "q1", "optionIndex": 0 },
    { "questionId": "q2", "optionIndex": 2 }
  ]
}
```

**Response**:
```json
{
  "glowtype": "nebula",
  "dimensionScores": {
    "energy": -2,
    "expression": 3,
    "style": 1
  }
}
```

### 2.4 Submit Quiz Result

**Endpoint**: `POST /quiz/result`

**Request**:
```json
{
  "sessionId": "uuid-v4",
  "answers": [
    { "questionId": "q1", "optionIndex": 0, "optionValue": "extrovert" }
  ],
  "dimensionScores": { "energy": -2 },
  "resultTypeCode": "nebula",
  "language": "en",
  "source": "web"
}
```

**Response**:
```json
{
  "success": true,
  "resultId": 123
}
```

### 2.5 Get Glowtype

**Endpoint**: `GET /glowtypes/:id`

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Glowtype code (e.g., "nebula") |

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code (en, zh) |

**Response**:
```json
{
  "id": 1,
  "typeCode": "nebula",
  "name": "Nebula",
  "tagline": "Dreamers who paint the cosmos",
  "description": "Full description...",
  "selfCareTips": ["Tip 1", "Tip 2"],
  "disclaimer": "This is for entertainment...",
  "auraGradient": "from-purple-500 to-blue-500",
  "cardAccent": "from-purple-50 to-violet-100",
  "textColor": "text-purple-900",
  "iconName": "nebula"
}
```

### 2.6 Chat Session

**Endpoint**: `POST /chat/session`

**Request**:
```json
{
  "glowtypeCode": "nebula",
  "language": "en"
}
```

**Response**:
```json
{
  "sessionId": "chat-session-uuid"
}
```

### 2.7 Send Chat Message

**Endpoint**: `POST /chat/message`

**Request**:
```json
{
  "sessionId": "chat-session-uuid",
  "message": "Hello, I want to talk about...",
  "history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ]
}
```

**Response**:
```json
{
  "message": "AI response content...",
  "sessionId": "chat-session-uuid"
}
```

### 2.8 Generate Insight

**Endpoint**: `POST /chat/insight`

**Request**:
```json
{
  "glowtypeCode": "nebula",
  "language": "en"
}
```

**Response**:
```json
{
  "insight": "A poetic cosmic insight..."
}
```

### 2.9 Get Help Resources

**Endpoint**: `GET /help`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code |

**Response**:
```json
{
  "hotlines": [
    {
      "name": "National Suicide Prevention",
      "number": "988",
      "description": "24/7 crisis support"
    }
  ]
}
```

### 2.10 Get Glowpedia Content

**Endpoint**: `GET /glowpedia`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `lang` | string | Language code |
| `glowtype` | string | Optional filter by Glowtype |

**Response**:
```json
{
  "chapters": [
    {
      "id": "calm",
      "name": "Finding Calm",
      "description": "...",
      "icon": "🌊",
      "color": "blue",
      "sticks": [
        {
          "title": "Breathe",
          "message": "Take a deep breath..."
        }
      ]
    }
  ]
}
```

### 2.11 Record Event

**Endpoint**: `POST /stats/event`

**Request**:
```json
{
  "event": "quiz_complete",
  "data": {
    "glowtype": "nebula"
  }
}
```

**Response**:
```json
{
  "success": true
}
```

### 2.12 Get Public Prompts

**Endpoint**: `GET /prompts`

**Response**:
```json
{
  "prompts": {
    "chat_system": "You are a supportive...",
    "insight_system": "Generate a cosmic..."
  }
}
```

---

## 3. Admin API

All admin endpoints require JWT authentication.

### 3.1 Profile

#### Get Current User

**Endpoint**: `GET /admin/me`

**Response**:
```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "permissions": ["stats.view", "content.write"],
  "twoFactorEnabled": true,
  "lastLoginAt": "2025-11-29T10:00:00Z"
}
```

#### Change Password

**Endpoint**: `PUT /admin/me/password`

**Request**:
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password",
  "confirmPassword": "new_password"
}
```

### 3.2 Two-Factor Authentication

#### Get 2FA Status

**Endpoint**: `GET /admin/2fa/status`

**Response**:
```json
{
  "enabled": true,
  "required": false,
  "verifiedAt": "2025-11-28T15:00:00Z",
  "recoveryCodesRemaining": 8,
  "trustedDevicesCount": 2
}
```

#### Setup 2FA

**Endpoint**: `POST /admin/2fa/setup`

**Response**:
```json
{
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

#### Verify 2FA Setup

**Endpoint**: `POST /admin/2fa/verify`

**Request**:
```json
{
  "code": "123456"
}
```

**Response**:
```json
{
  "success": true,
  "recoveryCodes": [
    "ABC123DEF456",
    "GHI789JKL012"
  ]
}
```

#### Disable 2FA

**Endpoint**: `DELETE /admin/2fa`

**Request**:
```json
{
  "code": "123456"
}
```

#### Regenerate Recovery Codes

**Endpoint**: `POST /admin/2fa/recovery/regenerate`

**Request**:
```json
{
  "code": "123456"
}
```

**Response**:
```json
{
  "recoveryCodes": ["NEW123...", "NEW456..."]
}
```

#### List Trusted Devices

**Endpoint**: `GET /admin/2fa/devices`

**Response**:
```json
{
  "devices": [
    {
      "id": 1,
      "deviceName": "Chrome on MacBook",
      "ip": "192.168.1.100",
      "lastUsedAt": "2025-11-29T10:00:00Z",
      "expiresAt": "2025-12-06T10:00:00Z"
    }
  ]
}
```

#### Revoke Trusted Device

**Endpoint**: `DELETE /admin/2fa/devices/:id`

#### Revoke All Trusted Devices

**Endpoint**: `DELETE /admin/2fa/devices`

### 3.3 Admin Users

**Permission Required**: `admin.manage`

#### List Users

**Endpoint**: `GET /admin/users`

#### Create User

**Endpoint**: `POST /admin/users`

**Request**:
```json
{
  "username": "newadmin",
  "password": "secure_password",
  "role": "admin",
  "permissions": ["stats.view"]
}
```

#### Update User

**Endpoint**: `PUT /admin/users/:id`

#### Manage User 2FA

**Endpoint**: `PUT /admin/users/:id/2fa`

**Request**:
```json
{
  "forceEnabled": true,
  "reset": false
}
```

### 3.4 Content Management

#### Dimensions

**Permission**: `dimensions.write`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dimensions` | List all |
| POST | `/admin/dimensions` | Create |
| PUT | `/admin/dimensions/:id` | Update |
| DELETE | `/admin/dimensions/:id` | Delete |
| POST | `/admin/dimensions/import` | Bulk import |
| GET | `/admin/dimensions/export` | Export as JSON |

#### Questions

**Permission**: `questions.write`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/questions` | List all |
| POST | `/admin/questions` | Create |
| PUT | `/admin/questions/:id` | Update |
| DELETE | `/admin/questions/:id` | Delete |
| POST | `/admin/questions/import` | Bulk import |

#### Glowtypes

**Permission**: `glowtypes.write`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/glowtypes` | List all |
| GET | `/admin/glowtypes/:id` | Get with i18n |
| POST | `/admin/glowtypes` | Create |
| PUT | `/admin/glowtypes/:id` | Update |
| DELETE | `/admin/glowtypes/:id` | Delete |
| POST | `/admin/glowtypes/i18n` | Create i18n |
| PUT | `/admin/glowtypes/i18n/:id` | Update i18n |

#### Scoring Rules

**Permission**: `rules.write`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/rules` | List all |
| POST | `/admin/rules` | Create |
| PUT | `/admin/rules/:id` | Update |
| DELETE | `/admin/rules/:id` | Delete |
| POST | `/admin/rules/import` | Bulk import |
| GET | `/admin/rules/export` | Export as JSON |
| POST | `/admin/rules/debug` | Test rules |
| GET | `/admin/rules/validate` | Validate rules |

#### AI Prompts

**Permission**: `prompts.write`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/prompts` | List all |
| PUT | `/admin/prompts/:id` | Update |
| POST | `/admin/prompts/:key/reset` | Reset to default |

#### AI Settings

**Permission**: superadmin only

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/ai/settings` | Get settings |
| PUT | `/admin/ai/settings` | Update settings |

#### Glowpedia

**Permission**: `content.write`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/chapters` | List chapters |
| POST | `/admin/chapters` | Create chapter |
| PUT | `/admin/chapters/:id` | Update chapter |
| DELETE | `/admin/chapters/:id` | Delete chapter |
| GET | `/admin/glowsticks` | List glow sticks |
| POST | `/admin/glowsticks` | Create glow stick |
| PUT | `/admin/glowsticks/:id` | Update glow stick |
| DELETE | `/admin/glowsticks/:id` | Delete glow stick |

### 3.5 Statistics & Analytics

**Permission**: `stats.view`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats/overview` | Summary stats |
| GET | `/admin/stats/daily` | Daily trends |
| GET | `/admin/stats/glowtypes` | Type distribution |
| GET | `/admin/stats/enhanced` | Enhanced stats |
| GET | `/admin/stats/analytics` | Advanced analytics |

**Query Parameters for `/stats/analytics`**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Start date (YYYY-MM-DD) |
| `endDate` | string | End date (YYYY-MM-DD) |
| `groupBy` | string | Grouping (day, week, month) |

### 3.6 Quiz Results

**Permission**: `results.view`

**Endpoint**: `GET /admin/results`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number |
| `limit` | int | Items per page |
| `glowtype` | string | Filter by type |
| `region` | string | Filter by region |
| `startDate` | string | Start date |
| `endDate` | string | End date |

### 3.7 Audit Logs

**Permission**: `audit.view`

**Endpoint**: `GET /admin/audit`

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Page number |
| `limit` | int | Items per page |
| `adminId` | int | Filter by admin |
| `method` | string | Filter by HTTP method |
| `startDate` | string | Start date |
| `endDate` | string | End date |

### 3.8 Reset to Defaults

**Permission**: `data.reset` (superadmin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/dimensions/reset` | Reset dimensions |
| POST | `/admin/questions/reset` | Reset questions |
| POST | `/admin/glowtypes/reset` | Reset glowtypes |
| POST | `/admin/rules/reset` | Reset rules |
| POST | `/admin/prompts/reset-all` | Reset all prompts |
| POST | `/admin/glowpedia/reset` | Reset glowpedia |

---

## 4. Error Handling

### 4.1 Error Response Format

```json
{
  "error": "Error message description"
}
```

### 4.2 HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

### 4.3 Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Unauthorized" | Missing/expired token | Login again |
| "Insufficient permissions" | Missing required permission | Contact admin |
| "Too many attempts" | Login rate limit | Wait 15 minutes |
| "Two-factor authentication required" | 2FA not completed | Complete 2FA setup |
| "Invalid credentials" | Wrong username/password | Check credentials |
