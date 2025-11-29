# Glowtype AI Integration Guide

Complete guide for configuring and customizing AI features in Glowtype.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Supported Providers](#2-supported-providers)
3. [Configuration Methods](#3-configuration-methods)
4. [AI Features](#4-ai-features)
5. [Prompt Engineering](#5-prompt-engineering)
6. [Rate Limiting](#6-rate-limiting)
7. [Crisis Detection](#7-crisis-detection)
8. [Best Practices](#8-best-practices)

---

## 1. Overview

Glowtype uses AI for two primary features:

1. **Supportive Chat**: A conversational companion that provides emotional support tailored to the user's Glowtype.

2. **Cosmic Insights**: Short, poetic affirmations generated based on the user's Glowtype.

The system uses an OpenAI-compatible API interface, allowing integration with multiple AI providers.

---

## 2. Supported Providers

### 2.1 Provider Comparison

| Provider | Base URL | Strengths | Best For |
|----------|----------|-----------|----------|
| OpenAI | `https://api.openai.com/v1` | Quality, reliability | Production |
| DeepSeek | `https://api.deepseek.com/v1` | Cost-effective | Budget deployments |
| Groq | `https://api.groq.com/openai/v1` | Speed | Low-latency needs |
| Ollama | `http://localhost:11434/v1` | Privacy, free | Development, privacy |
| Azure OpenAI | `https://<resource>.openai.azure.com/` | Enterprise | Corporate environments |

### 2.2 Recommended Models

| Provider | Chat Model | Notes |
|----------|------------|-------|
| OpenAI | `gpt-4o-mini` | Good balance of quality and cost |
| OpenAI | `gpt-4o` | Highest quality, more expensive |
| DeepSeek | `deepseek-chat` | Good quality, very affordable |
| Groq | `llama-3.1-8b-instant` | Fast, good for simple responses |
| Groq | `mixtral-8x7b-32768` | Larger context window |
| Ollama | `llama3.2` | Local, no API costs |

### 2.3 Provider Setup

#### OpenAI

1. Get API key from [platform.openai.com](https://platform.openai.com).
2. Configure:
   ```env
   VITE_AI_API_KEY=sk-...
   VITE_AI_API_URL=https://api.openai.com/v1
   VITE_AI_MODEL=gpt-4o-mini
   ```

#### DeepSeek

1. Get API key from [platform.deepseek.com](https://platform.deepseek.com).
2. Configure:
   ```env
   VITE_AI_API_KEY=sk-...
   VITE_AI_API_URL=https://api.deepseek.com/v1
   VITE_AI_MODEL=deepseek-chat
   ```

#### Groq

1. Get API key from [console.groq.com](https://console.groq.com).
2. Configure:
   ```env
   VITE_AI_API_KEY=gsk_...
   VITE_AI_API_URL=https://api.groq.com/openai/v1
   VITE_AI_MODEL=llama-3.1-8b-instant
   ```

#### Ollama (Local)

1. Install Ollama from [ollama.com](https://ollama.com).
2. Pull a model: `ollama pull llama3.2`
3. Configure:
   ```env
   VITE_AI_API_KEY=ollama
   VITE_AI_API_URL=http://localhost:11434/v1
   VITE_AI_MODEL=llama3.2
   ```

---

## 3. Configuration Methods

### 3.1 Environment Variables (Build-time)

Configure in root `.env` before building frontend:

```env
# AI Provider Configuration
VITE_AI_API_KEY=sk-your-api-key
VITE_AI_API_URL=https://api.openai.com/v1
VITE_AI_MODEL=gpt-4o-mini
```

**Pros**: Simple, works without backend AI settings.
**Cons**: Exposes API key in frontend build, requires rebuild to change.

### 3.2 Admin Panel (Runtime)

Configure via Admin Panel > AI Settings (superadmin only):

| Field | Description |
|-------|-------------|
| Provider | Provider type identifier |
| API Key | Your API key (stored encrypted) |
| Base URL | Provider API endpoint |
| Model | Model name to use |
| Is Active | Enable/disable AI features |
| Rate Limit Enabled | Toggle rate limiting |
| Requests Per Minute | Max requests allowed |
| Burst | Burst allowance |

**Pros**: No rebuild needed, key stored securely, admin-controlled.
**Cons**: Requires backend AI proxy implementation.

### 3.3 Configuration Priority

1. Admin Panel settings (if configured)
2. Environment variables
3. Default fallbacks

---

## 4. AI Features

### 4.1 Supportive Chat

**Purpose**: Provide empathetic, non-judgmental emotional support.

**API Endpoint**: `POST /api/v1/chat/message`

**Flow**:
```
User Message → Crisis Detection → AI Processing → Response
                    ↓
              (If crisis detected)
                    ↓
              Show Help Resources
```

**Request Format**:
```json
{
  "sessionId": "uuid",
  "message": "I'm feeling overwhelmed today",
  "history": [
    {"role": "user", "content": "Hi"},
    {"role": "assistant", "content": "Hello! I'm here for you..."}
  ]
}
```

**Response Format**:
```json
{
  "message": "I hear you. Feeling overwhelmed is really tough...",
  "sessionId": "uuid"
}
```

### 4.2 Cosmic Insights

**Purpose**: Generate short, personalized affirmations.

**API Endpoint**: `POST /api/v1/chat/insight`

**Request Format**:
```json
{
  "glowtypeCode": "nebula",
  "language": "en"
}
```

**Response Format**:
```json
{
  "insight": "Like a nebula painting the cosmos with light..."
}
```

### 4.3 Chat Sessions

Sessions maintain conversation context:

**Create Session**: `POST /api/v1/chat/session`
```json
{
  "glowtypeCode": "nebula",
  "language": "en"
}
```

Sessions are anonymous and temporary.

---

## 5. Prompt Engineering

### 5.1 Available Prompts

| Key | Purpose | Location |
|-----|---------|----------|
| `chat_system` | Main chat system prompt | Admin Panel > Prompts |
| `insight_system` | Insight generation prompt | Admin Panel > Prompts |
| `crisis_detection` | Crisis keyword rules | Admin Panel > Prompts |

### 5.2 System Prompt Guidelines

#### Chat System Prompt

The chat system prompt should:
- Establish the AI's supportive persona
- Reference the user's Glowtype with `{glowtype}` placeholder
- Set boundaries (not a therapist, not for emergencies)
- Guide tone (warm, non-judgmental, empathetic)

**Example Structure**:
```
You are a supportive companion helping someone with the {glowtype} personality type.

Your role:
- Listen with empathy and without judgment
- Offer gentle perspectives and coping strategies
- Validate emotions while encouraging self-care

Important boundaries:
- You are not a therapist or medical professional
- For emergencies, guide users to professional help
- Keep responses concise (2-3 paragraphs max)

Communication style:
- Warm and understanding
- Use "I" statements to show empathy
- Avoid giving direct advice; ask reflective questions
```

#### Insight System Prompt

The insight prompt should:
- Describe the desired output format
- Reference Glowtype characteristics
- Guide the poetic/cosmic tone

**Example Structure**:
```
Generate a short, poetic cosmic insight for someone with the {glowtype} personality type.

Requirements:
- 1-2 sentences only
- Use cosmic/celestial imagery
- Be uplifting and affirming
- Relate to {glowtype} characteristics

Tone: Ethereal, hopeful, personal
```

### 5.3 Editing Prompts

1. Go to Admin Panel > Prompts
2. Click "Edit" on the prompt
3. Modify the content
4. Click "Save"

**To reset to default**:
1. Click "Reset" on the prompt
2. Confirm reset

### 5.4 Testing Prompts

Before deploying prompt changes:

1. Test with multiple user scenarios
2. Check for appropriate crisis responses
3. Verify Glowtype personalization works
4. Test in both English and Chinese

---

## 6. Rate Limiting

### 6.1 Purpose

Rate limiting prevents:
- API cost overruns
- Abuse and spam
- Service disruption

### 6.2 Configuration

In Admin Panel > AI Settings:

| Setting | Description | Recommended |
|---------|-------------|-------------|
| Rate Limit Enabled | Toggle rate limiting | `true` |
| Requests Per Minute | Max sustained rate | 60 |
| Burst | Allowed burst above limit | 10 |

### 6.3 Behavior

With `rpm=60, burst=10`:
- Normal: 60 requests per minute allowed
- Burst: Up to 70 requests briefly allowed
- Exceeded: Returns 429 Too Many Requests

### 6.4 Per-User vs Global

Current implementation uses global rate limiting. For per-user limiting, consider:
- Session-based tracking
- IP-based limiting (privacy concerns)
- Anonymous user identification

---

## 7. Crisis Detection

### 7.1 Purpose

Detect when users may be in distress and show help resources instead of AI-only responses.

### 7.2 How It Works

1. User message is scanned for crisis keywords
2. If detected, help resources are prominently displayed
3. AI response still generated but with crisis-aware prompt

### 7.3 Configuring Keywords

Edit the `crisis_detection` prompt in Admin Panel > Prompts:

```
Keywords indicating crisis (one per line):
suicide
kill myself
want to die
self-harm
cutting
end my life
no reason to live
...
```

### 7.4 Help Resources

Configure help resources via Admin Panel or database:

```json
{
  "hotlines": [
    {
      "name": "National Suicide Prevention Lifeline",
      "number": "988",
      "description": "24/7 crisis support",
      "region": "US"
    },
    {
      "name": "Crisis Text Line",
      "number": "Text HOME to 741741",
      "description": "Text-based support",
      "region": "US"
    }
  ]
}
```

### 7.5 Best Practices

- Include keywords in multiple languages
- Update keywords based on observed patterns
- Test crisis detection regularly
- Ensure help resources are current and accurate

---

## 8. Best Practices

### 8.1 Cost Management

1. **Choose appropriate models**: `gpt-4o-mini` is 10-20x cheaper than `gpt-4o`.
2. **Limit conversation length**: Cap history at 10-20 messages.
3. **Set rate limits**: Prevent runaway costs.
4. **Monitor usage**: Check provider dashboards regularly.

### 8.2 Quality Assurance

1. **Test prompts thoroughly** before deployment.
2. **Review AI responses** periodically for quality.
3. **Collect feedback** through analytics.
4. **Iterate on prompts** based on user interactions.

### 8.3 Privacy Considerations

1. **No PII in prompts**: Don't include user data in system prompts.
2. **Anonymous sessions**: Don't track users across sessions.
3. **Local options**: Consider Ollama for maximum privacy.
4. **Data retention**: Most providers retain data temporarily.

### 8.4 Reliability

1. **Handle API errors gracefully**: Show friendly messages.
2. **Implement timeouts**: 30-60 seconds max.
3. **Have fallbacks**: Cache common responses if needed.
4. **Monitor uptime**: Alert on high error rates.

### 8.5 Safety

1. **Never promise professional help**: The AI is not a therapist.
2. **Always show crisis resources**: When distress is detected.
3. **Set clear expectations**: Disclaimer about limitations.
4. **Regular audits**: Review conversations for safety issues.

---

## Appendix: Prompt Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{glowtype}` | User's Glowtype name | "Nebula" |
| `{language}` | User's language | "en" or "zh" |

---

## Appendix: Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Invalid API key | Check key in settings |
| 429 | Rate limited | Wait or increase limits |
| 500 | Provider error | Check provider status |
| 503 | Service unavailable | Retry later |

---

## Appendix: Testing AI Integration

### Manual Testing

```bash
# Test chat endpoint
curl -X POST http://localhost:18080/api/v1/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "message": "Hello, I am feeling sad today",
    "history": []
  }'

# Test insight endpoint
curl -X POST http://localhost:18080/api/v1/chat/insight \
  -H "Content-Type: application/json" \
  -d '{
    "glowtypeCode": "nebula",
    "language": "en"
  }'
```

### Provider Health Check

```bash
# Check if AI provider is reachable
curl -X GET http://localhost:18080/api/v1/health
```
