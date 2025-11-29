# Glowtype Admin Panel Guide

A comprehensive guide for using the Glowtype administration panel.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard](#2-dashboard)
3. [Content Management](#3-content-management)
4. [Quiz Configuration](#4-quiz-configuration)
5. [AI Configuration](#5-ai-configuration)
6. [User Management](#6-user-management)
7. [Analytics & Reports](#7-analytics--reports)
8. [Personal Settings](#8-personal-settings)

---

## 1. Getting Started

### 1.1 Accessing the Admin Panel

Navigate to: `https://your-domain.com/admin`

### 1.2 Logging In

1. Enter your username
2. Enter your password
3. Click "Login"

If 2FA is enabled:
4. Enter the 6-digit code from your authenticator app
5. (Optional) Check "Trust this device" to skip 2FA for 7 days
6. Click "Verify"

### 1.3 Navigation

The admin panel has a sidebar with the following sections:

| Section | Description | Permission Required |
|---------|-------------|---------------------|
| Dashboard | Overview statistics | `stats.view` |
| Dimensions | Personality dimensions | `dimensions.write` |
| Questions | Quiz questions | `questions.write` |
| Glowtypes | Result types | `glowtypes.write` |
| Rules | Scoring rules | `rules.write` |
| Prompts | AI prompts | `prompts.write` |
| AI Settings | AI provider config | superadmin only |
| Glowpedia | Content management | `content.write` |
| Results | Quiz results | `results.view` |
| Analytics | Advanced analytics | `stats.view` |
| Accounts | Admin users | `admin.manage` |
| Audit Logs | Operation logs | `audit.view` |

---

## 2. Dashboard

The Dashboard provides an overview of system usage and trends.

### 2.1 Overview Cards

- **Total Quizzes**: Total completed quizzes
- **Today's Quizzes**: Quizzes completed today
- **AI Chats**: Total AI chat sessions
- **Shares**: Total share card generations

### 2.2 Daily Trends

A line chart showing daily quiz completions over the selected time period.

**Time Range Options**:
- Last 7 days
- Last 30 days
- Last 90 days
- Custom range

### 2.3 Glowtype Distribution

A pie/bar chart showing the distribution of quiz results by Glowtype.

### 2.4 Geographic Distribution

Shows quiz completions by region (based on anonymous GeoIP lookup).

### 2.5 Device Distribution

Breakdown of quiz completions by device type:
- Mobile
- Desktop
- Tablet

### 2.6 Time Distribution

Shows quiz completions by hour of day (0-23), useful for understanding user activity patterns.

---

## 3. Content Management

### 3.1 Glowpedia (Light Sticks)

Glowpedia is the in-app content library with supportive messages organized by chapters.

#### Managing Chapters

1. Go to **Glowpedia** in sidebar
2. Click **Chapters** tab

**Create a Chapter**:
1. Click "Add Chapter"
2. Fill in:
   - Chapter ID (e.g., "calm", "anxiety")
   - Chinese name / English name
   - Chinese description / English description
   - Icon (emoji)
   - Color (Tailwind gradient class)
   - Display order
3. Click "Save"

**Edit a Chapter**:
1. Click the edit icon on any chapter
2. Modify fields
3. Click "Save"

**Delete a Chapter**:
1. Click the delete icon
2. Confirm deletion
3. Note: All glow sticks in this chapter will also be deleted

#### Managing Glow Sticks

1. Go to **Glowpedia** in sidebar
2. Click **Glow Sticks** tab

**Create a Glow Stick**:
1. Click "Add Glow Stick"
2. Fill in:
   - Title (Chinese / English)
   - Message (Chinese / English)
   - Chapter (select from dropdown)
   - Color (Tailwind gradient)
   - For Types (optional, comma-separated Glowtype codes)
   - Display order
3. Click "Save"

**Personalization with "For Types"**:
- Leave empty to show to all users
- Enter Glowtype codes (e.g., "nebula,comet") to show only to those types
- Useful for type-specific advice

---

## 4. Quiz Configuration

### 4.1 Dimensions

Personality dimensions are the scoring axes (like MBTI's E-I, S-N, etc.)

**Fields**:
| Field | Description |
|-------|-------------|
| Key | Unique identifier (e.g., "energy") |
| Name (ZH/EN) | Display names |
| Positive Pole | Label for positive scores (e.g., "Extrovert") |
| Negative Pole | Label for negative scores (e.g., "Introvert") |
| Strong Threshold | Score threshold for "Strong" intensity |
| Mild Threshold | Score threshold for "Mild" intensity |
| Display Order | Order in results display |

**Best Practices**:
- Keep dimension keys short and lowercase
- Use 3-5 dimensions for balanced results
- Set thresholds based on expected score ranges

### 4.2 Questions

Quiz questions with multilingual options and scoring.

**Question Fields**:
| Field | Description |
|-------|-------------|
| Question ID | Unique identifier (e.g., "q1", "q2") |
| Order | Display order in quiz |
| Question Text | The question (Chinese and English) |
| Options | Array of answer options |
| Primary Dimension | Main dimension for admin grouping |

**Option Structure**:
```json
{
  "text": {
    "en": "I prefer quiet evenings at home",
    "zh": "我更喜欢安静地待在家里"
  },
  "value": "introvert",
  "scores": {
    "energy": -2,
    "style": 1
  }
}
```

**Import/Export**:
- Export questions as JSON for backup
- Import questions from JSON to bulk update

### 4.3 Glowtypes

Result types with styling and multilingual content.

**Base Fields** (language-independent):
| Field | Description |
|-------|-------------|
| Type Code | Unique identifier (e.g., "nebula") |
| Aura Gradient | Background gradient class |
| Card Accent | Card gradient (e.g., "from-purple-50 to-violet-100") |
| Text Color | Text color class (e.g., "text-purple-900") |
| Primary Color | Main theme color |
| Icon Name | Icon identifier |

**I18N Fields** (per-language):
| Field | Description |
|-------|-------------|
| Name | Display name |
| Tagline | Short description |
| Description | Full description |
| Self-Care Tips | JSON array of tips |
| Disclaimer | Legal disclaimer text |
| Match Summary | Human-readable rule description |

**Styling Tips**:
- Use color combinations from the safelist (see DEVELOPMENT.md)
- Test styles on both light and dark backgrounds
- Keep gradients subtle for readability

### 4.4 Scoring Rules

Rules that map dimension scores to Glowtypes.

**Rule Fields**:
| Field | Description |
|-------|-------------|
| Name | Rule identifier |
| Description | Human-readable explanation |
| Conditions | JSON conditions object |
| Result Type Code | Target Glowtype |
| Priority | Higher = checked first |
| Is Fallback | Matches when no other rule matches |

**Condition Format**:
```json
{
  "dimensions": {
    "energy": { "min": 0, "max": null },
    "style": { "min": -2, "max": 2 }
  }
}
```

- `min`: Score must be >= this value (null = no lower bound)
- `max`: Score must be <= this value (null = no upper bound)
- Omit a dimension to ignore it

**Rule Matching**:
1. Rules sorted by priority (descending)
2. First matching rule wins
3. Fallback rule used if no match

**Debugging**:
1. Go to **Rules** > **Debug** tab
2. Enter test dimension scores
3. Click "Test"
4. See which rule would match

---

## 5. AI Configuration

### 5.1 AI Prompts

System prompts control AI behavior in chat and insights.

**Available Prompt Keys**:
| Key | Purpose |
|-----|---------|
| `chat_system` | Main chat system prompt |
| `insight_system` | Cosmic insight generation prompt |
| `crisis_detection` | Crisis keyword detection rules |

**Editing Prompts**:
1. Go to **Prompts**
2. Click "Edit" on any prompt
3. Modify the content
4. Click "Save"

**Reset to Default**:
1. Click "Reset" on any prompt
2. Confirm reset
3. Original default content is restored

**Best Practices**:
- Include Glowtype context in prompts using `{glowtype}` placeholder
- Keep crisis detection prompt sensitive but not overly broad
- Test prompts thoroughly before deploying

### 5.2 AI Settings (Superadmin Only)

Configure the AI provider and rate limits.

**Provider Settings**:
| Field | Description |
|-------|-------------|
| Provider | AI service (openai, mock) |
| API Key | Your API key (never displayed) |
| Base URL | API endpoint |
| Model | Model name (e.g., gpt-4o-mini) |
| Is Active | Enable/disable AI features |

**Rate Limiting**:
| Field | Description |
|-------|-------------|
| Rate Limit Enabled | Toggle rate limiting |
| Requests Per Minute | Max requests per minute |
| Burst | Allowed burst requests |

**Supported Providers**:
- OpenAI: `https://api.openai.com/v1`
- DeepSeek: `https://api.deepseek.com/v1`
- Groq: `https://api.groq.com/openai/v1`
- Local: `http://localhost:11434/v1` (Ollama)

---

## 6. User Management

### 6.1 Admin Accounts (Superadmin Only)

Manage administrator accounts.

**Create Account**:
1. Go to **Accounts**
2. Click "Add Admin"
3. Fill in:
   - Username (unique)
   - Password (min 8 characters)
   - Role (select from dropdown)
   - Custom permissions (optional)
4. Click "Create"

**Edit Account**:
1. Click edit icon on any user
2. Modify fields
3. Click "Save"

**Reset Password**:
1. Edit the user
2. Enter new password
3. Save

**Deactivate Account**:
1. Edit the user
2. Toggle "Is Active" off
3. Save
4. User can no longer login

### 6.2 Managing User 2FA

**Force 2FA**:
1. Edit user
2. Toggle "Force 2FA" on
3. Save
4. User must enable 2FA to access admin panel

**Reset 2FA** (for locked-out users):
1. Find user in list
2. Click "Reset 2FA"
3. Confirm
4. User can login with password only and re-setup 2FA

### 6.3 Custom Permissions

Override role defaults with custom permissions:

1. Edit user
2. Expand "Custom Permissions" section
3. Toggle individual permissions on/off
4. Save

When custom permissions are set, they take precedence over role defaults.

---

## 7. Analytics & Reports

### 7.1 Quiz Results

View individual quiz submissions (anonymous).

**Available Filters**:
- Date range
- Glowtype
- Region
- Device type
- Language

**Displayed Fields**:
- Session ID (anonymous)
- Result type
- Dimension scores
- Language
- Region
- Device
- Timestamp

### 7.2 Advanced Analytics

**Date Range Selection**:
1. Go to **Analytics**
2. Select start and end dates
3. Click "Apply"

**Available Metrics**:
- Quiz completion trends
- Glowtype distribution over time
- Regional breakdown
- Device breakdown
- Hourly patterns
- Dimension score distributions

**Export**:
- Export data as CSV for external analysis
- All data is anonymized

---

## 8. Personal Settings

Access via your username dropdown > "Settings"

### 8.1 Change Password

1. Enter current password
2. Enter new password
3. Confirm new password
4. Click "Change Password"

**Requirements**:
- Minimum 8 characters
- Different from current password

### 8.2 Two-Factor Authentication

See [SECURITY.md](./SECURITY.md) for detailed 2FA instructions.

**Quick Actions**:
- **Enable 2FA**: Scan QR code, verify, save recovery codes
- **Disable 2FA**: Enter current code to confirm
- **Regenerate Recovery Codes**: Invalidates old codes

### 8.3 Trusted Devices

View and manage devices that skip 2FA:

- Device name (browser/OS)
- IP address when trusted
- Last used time
- Expiration date

**Actions**:
- "Revoke" individual devices
- "Revoke All" to clear all trusted devices

---

## Appendix: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save current form |
| `Esc` | Close modal/dialog |
| `/` | Focus search (where available) |

---

## Appendix: Common Tasks Quick Reference

| Task | Navigation |
|------|------------|
| Add new quiz question | Questions > Add Question |
| Create new Glowtype | Glowtypes > Add Type |
| View today's results | Results > Filter by today |
| Check audit trail | Audit Logs |
| Configure AI provider | AI Settings (superadmin) |
| Force user 2FA | Accounts > Edit User > Force 2FA |
| Export questions | Questions > Export |
| Debug scoring rules | Rules > Debug tab |
