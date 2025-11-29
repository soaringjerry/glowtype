# Glowtype Quiz Scoring System

Complete guide to understanding and configuring the Glowtype quiz scoring system.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Dimensions](#2-dimensions)
3. [Questions & Options](#3-questions--options)
4. [Scoring Rules](#4-scoring-rules)
5. [Glowtypes](#5-glowtypes)
6. [Scoring Algorithm](#6-scoring-algorithm)
7. [Configuration Guide](#7-configuration-guide)
8. [Debugging & Testing](#8-debugging--testing)

---

## 1. Overview

### 1.1 Scoring Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Answer    │───▶│  Calculate  │───▶│   Match     │───▶│   Return    │
│  Questions  │    │  Dimension  │    │   Scoring   │    │  Glowtype   │
│             │    │   Scores    │    │   Rules     │    │   Result    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 1.2 Key Concepts

| Concept | Description |
|---------|-------------|
| **Dimension** | A personality axis (e.g., Energy: Introvert ↔ Extrovert) |
| **Question** | A quiz question with multiple options |
| **Option** | An answer choice that adds/subtracts from dimension scores |
| **Scoring Rule** | A condition set that maps scores to a Glowtype |
| **Glowtype** | The final result type (e.g., Nebula, Comet) |

---

## 2. Dimensions

### 2.1 What is a Dimension?

A dimension is a spectrum between two opposite personality traits. Users score somewhere on this spectrum based on their answers.

### 2.2 Dimension Structure

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Unique identifier (e.g., "energy") |
| `name_zh` / `name_en` | string | Display names |
| `positive_pole_zh` / `en` | string | Label for positive scores |
| `negative_pole_zh` / `en` | string | Label for negative scores |
| `strong_threshold` | int | Score for "Strong" intensity |
| `mild_threshold` | int | Score for "Mild" intensity |
| `display_order` | int | Order in results display |

### 2.3 Example Dimensions

```
Energy Dimension (key: "energy")
├── Positive Pole (+): "Extrovert" (外向)
├── Negative Pole (-): "Introvert" (内向)
├── Strong Threshold: 3
└── Mild Threshold: 1

Score Interpretation:
  +4, +3  = Strong Extrovert
  +2, +1  = Mild Extrovert
   0      = Balanced
  -1, -2  = Mild Introvert
  -3, -4  = Strong Introvert
```

### 2.4 Recommended Dimensions

For a Glowtype-style quiz, consider 3-4 dimensions:

1. **Energy**: How you recharge (Introvert ↔ Extrovert)
2. **Expression**: How you communicate emotions (Reserved ↔ Expressive)
3. **Processing**: How you handle feelings (Analytical ↔ Intuitive)
4. **Coping**: How you manage stress (Active ↔ Reflective)

---

## 3. Questions & Options

### 3.1 Question Structure

| Field | Type | Description |
|-------|------|-------------|
| `question_id` | string | Unique identifier (e.g., "q1") |
| `order` | int | Display order in quiz |
| `question_zh` / `en` | string | Question text |
| `options` | JSON | Array of answer options |
| `primary_dimension` | string | Main dimension for grouping |

### 3.2 Option Structure

Each option in the `options` array:

```json
{
  "text": {
    "en": "Option text in English",
    "zh": "选项中文文本"
  },
  "value": "option_identifier",
  "scores": {
    "energy": -2,
    "expression": 1
  }
}
```

| Field | Description |
|-------|-------------|
| `text` | Multilingual display text |
| `value` | Identifier for analytics |
| `scores` | Dimension score adjustments |

### 3.3 Example Question

```json
{
  "question_id": "q1",
  "order": 1,
  "question_en": "After a long day, how do you prefer to recharge?",
  "question_zh": "忙碌一天后，你更喜欢怎样恢复精力？",
  "primary_dimension": "energy",
  "options": [
    {
      "text": {
        "en": "Spending time with friends",
        "zh": "和朋友们一起"
      },
      "value": "social",
      "scores": { "energy": 2 }
    },
    {
      "text": {
        "en": "Quiet time alone",
        "zh": "独处安静一下"
      },
      "value": "alone",
      "scores": { "energy": -2 }
    },
    {
      "text": {
        "en": "A small gathering with close friends",
        "zh": "和几个亲密朋友小聚"
      },
      "value": "small_group",
      "scores": { "energy": 1 }
    },
    {
      "text": {
        "en": "Depends on my mood",
        "zh": "看心情"
      },
      "value": "depends",
      "scores": { "energy": 0 }
    }
  ]
}
```

### 3.4 Scoring Best Practices

1. **Balance options**: Include positive, negative, and neutral choices.
2. **Use consistent scales**: If one option is +2, have a corresponding -2.
3. **Multi-dimension scoring**: Options can affect multiple dimensions.
4. **Neutral options**: Include "it depends" type options with 0 scores.

---

## 4. Scoring Rules

### 4.1 What is a Scoring Rule?

A scoring rule defines conditions that, when met, result in a specific Glowtype.

### 4.2 Rule Structure

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Rule identifier |
| `description` | string | Human-readable explanation |
| `conditions` | JSON | Dimension score conditions |
| `result_type_code` | string | Target Glowtype code |
| `priority` | int | Evaluation order (higher = first) |
| `is_fallback` | bool | Use when no other rules match |

### 4.3 Condition Format

```json
{
  "dimensions": {
    "energy": {
      "min": 0,
      "max": null
    },
    "expression": {
      "min": -2,
      "max": 2
    }
  }
}
```

| Condition | Meaning |
|-----------|---------|
| `"min": 0, "max": null` | Score >= 0 (positive) |
| `"min": null, "max": 0` | Score <= 0 (negative) |
| `"min": -2, "max": 2` | Score between -2 and 2 |
| `"min": 3, "max": null` | Score >= 3 (strong positive) |
| Dimension omitted | No constraint on that dimension |

### 4.4 Example Rules

#### Rule 1: Nebula (Dreamy Introvert)
```json
{
  "name": "nebula_rule",
  "description": "Introverted, intuitive, reflective",
  "conditions": {
    "dimensions": {
      "energy": { "min": null, "max": -1 },
      "expression": { "min": null, "max": 0 },
      "processing": { "min": 1, "max": null }
    }
  },
  "result_type_code": "nebula",
  "priority": 100,
  "is_fallback": false
}
```

#### Rule 2: Comet (Energetic Extrovert)
```json
{
  "name": "comet_rule",
  "description": "Extroverted, expressive, active",
  "conditions": {
    "dimensions": {
      "energy": { "min": 1, "max": null },
      "expression": { "min": 1, "max": null }
    }
  },
  "result_type_code": "comet",
  "priority": 100,
  "is_fallback": false
}
```

#### Fallback Rule
```json
{
  "name": "default_rule",
  "description": "Balanced or unmatched profiles",
  "conditions": {},
  "result_type_code": "aurora",
  "priority": 1,
  "is_fallback": true
}
```

### 4.5 Rule Matching Algorithm

1. Sort rules by priority (descending)
2. For each rule:
   - Check all dimension conditions
   - If ALL conditions match → return this Glowtype
3. If no rules match → use fallback rule
4. If no fallback → return error

---

## 5. Glowtypes

### 5.1 Glowtype Structure

**Base Fields** (language-independent):

| Field | Description |
|-------|-------------|
| `type_code` | Unique identifier (e.g., "nebula") |
| `aura_gradient` | Background gradient CSS class |
| `card_accent` | Card gradient class |
| `text_color` | Text color class |
| `primary_color` | Main theme color |
| `icon_name` | Icon identifier |

**I18N Fields** (per-language):

| Field | Description |
|-------|-------------|
| `name` | Display name |
| `tagline` | Short description |
| `description` | Full description |
| `self_care_tips` | JSON array of tips |
| `disclaimer` | Legal disclaimer |
| `match_summary` | Human-readable rule description |

### 5.2 Example Glowtype

```json
{
  "type_code": "nebula",
  "aura_gradient": "from-purple-600 via-indigo-500 to-blue-500",
  "card_accent": "from-purple-50 to-violet-100",
  "text_color": "text-purple-900",
  "primary_color": "#8B5CF6",
  "icon_name": "nebula",
  "i18n": {
    "en": {
      "name": "Nebula",
      "tagline": "Dreamers who paint the cosmos",
      "description": "You are a Nebula - a gentle soul with a rich inner world...",
      "self_care_tips": [
        "Allow yourself time to daydream",
        "Express your thoughts through creative outlets",
        "Connect deeply with one or two close friends"
      ],
      "disclaimer": "This is for entertainment and self-reflection only.",
      "match_summary": "Introverted energy, reserved expression, intuitive processing"
    },
    "zh": {
      "name": "星云",
      "tagline": "描绘宇宙的梦想家",
      "description": "你是星云型——一个拥有丰富内心世界的温柔灵魂...",
      "self_care_tips": [
        "给自己做白日梦的时间",
        "通过创意方式表达想法",
        "与一两个亲密朋友深度交流"
      ]
    }
  }
}
```

---

## 6. Scoring Algorithm

### 6.1 Step-by-Step Process

```python
# Pseudocode for scoring algorithm

def calculate_glowtype(answers):
    # Step 1: Initialize dimension scores
    dimension_scores = {dim.key: 0 for dim in dimensions}

    # Step 2: Sum scores from each answer
    for answer in answers:
        question = get_question(answer.question_id)
        option = question.options[answer.option_index]
        for dim_key, score in option.scores.items():
            dimension_scores[dim_key] += score

    # Step 3: Match against rules (sorted by priority)
    rules = get_rules_sorted_by_priority()
    for rule in rules:
        if matches_conditions(dimension_scores, rule.conditions):
            return rule.result_type_code

    # Step 4: Use fallback if no match
    fallback = get_fallback_rule()
    return fallback.result_type_code

def matches_conditions(scores, conditions):
    for dim_key, bounds in conditions.dimensions.items():
        score = scores.get(dim_key, 0)
        if bounds.min is not None and score < bounds.min:
            return False
        if bounds.max is not None and score > bounds.max:
            return False
    return True
```

### 6.2 Example Calculation

**User Answers**:
- Q1: Option 2 (scores: energy: -2)
- Q2: Option 1 (scores: energy: -1, expression: -1)
- Q3: Option 3 (scores: expression: 0, processing: 2)
- Q4: Option 1 (scores: processing: 1)

**Dimension Totals**:
- energy: -2 + (-1) = -3
- expression: -1 + 0 = -1
- processing: 2 + 1 = 3

**Rule Matching**:
1. Check "nebula_rule" (priority 100):
   - energy: -3 (needs <= -1) ✓
   - expression: -1 (needs <= 0) ✓
   - processing: 3 (needs >= 1) ✓
   - **MATCH** → Return "nebula"

---

## 7. Configuration Guide

### 7.1 Adding a New Dimension

1. Go to Admin Panel > Dimensions
2. Click "Add Dimension"
3. Fill in:
   - Key: lowercase, no spaces (e.g., "coping")
   - Names: Chinese and English
   - Poles: Labels for positive/negative
   - Thresholds: When to show "Strong" vs "Mild"
4. Save

### 7.2 Adding Questions

1. Go to Admin Panel > Questions
2. Click "Add Question"
3. Fill in question text (both languages)
4. Add 3-5 options with scores
5. Set display order
6. Save

**Or bulk import**:
1. Click "Export" to get current format
2. Modify JSON
3. Click "Import"

### 7.3 Creating Scoring Rules

1. Go to Admin Panel > Rules
2. Click "Add Rule"
3. Configure conditions for each dimension
4. Select target Glowtype
5. Set priority (100 = normal, 1 = fallback)
6. Save

### 7.4 Ensuring Complete Coverage

Every possible score combination should match a rule:

1. **Create rules for primary types**: Cover the most distinct profiles.
2. **Add overlapping rules**: For borderline cases.
3. **Always have a fallback**: Catch-all for unmatched profiles.

Use the Debug tool to test coverage:
1. Go to Rules > Debug tab
2. Enter various score combinations
3. Verify expected Glowtypes are returned

---

## 8. Debugging & Testing

### 8.1 Rule Debugger

In Admin Panel > Rules > Debug:

1. Enter dimension scores manually
2. Click "Test"
3. See which rule matches and why

### 8.2 Validating Rules

In Admin Panel > Rules > Validate:

- Checks for orphaned rules (Glowtypes that don't exist)
- Identifies conflicting rules (same conditions, different results)
- Warns about unreachable rules (lower priority, same conditions)

### 8.3 Common Issues

#### No Rule Matches

**Symptom**: Error or unexpected result.

**Solution**:
1. Add a fallback rule with `is_fallback: true`.
2. Ensure conditions don't have gaps.

#### Wrong Glowtype Returned

**Symptom**: User gets unexpected result.

**Debug Steps**:
1. Check user's dimension scores in Results.
2. Use Debug tool with those scores.
3. Review rule priorities.
4. Check for overlapping conditions.

#### Dimension Scores All Zero

**Symptom**: Every user gets fallback Glowtype.

**Causes**:
1. Options have no scores defined.
2. Scores sum to zero (balanced positive/negative).

**Solution**: Review option scores in Questions.

### 8.4 Testing Scenarios

Test these scenarios before deployment:

| Scenario | Expected |
|----------|----------|
| All positive scores | Specific extrovert type |
| All negative scores | Specific introvert type |
| Mixed scores | Appropriate balanced type |
| Extreme scores | Corresponding extreme type |
| All zeros | Fallback type |
| Random answers | Valid result (no errors) |

---

## Appendix: Data Model Reference

### Questions Table
```sql
CREATE TABLE quiz_questions (
  id INTEGER PRIMARY KEY,
  question_id TEXT UNIQUE,
  order INTEGER,
  question_zh TEXT,
  question_en TEXT,
  options TEXT,  -- JSON
  primary_dimension TEXT
);
```

### Dimensions Table
```sql
CREATE TABLE dimensions (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE,
  name_zh TEXT,
  name_en TEXT,
  positive_pole_zh TEXT,
  positive_pole_en TEXT,
  negative_pole_zh TEXT,
  negative_pole_en TEXT,
  strong_threshold INTEGER,
  mild_threshold INTEGER,
  display_order INTEGER
);
```

### Scoring Rules Table
```sql
CREATE TABLE scoring_rules (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE,
  description TEXT,
  conditions TEXT,  -- JSON
  result_type_code TEXT,
  priority INTEGER,
  is_fallback BOOLEAN
);
```

### Glowtypes Table
```sql
CREATE TABLE glowtypes (
  id INTEGER PRIMARY KEY,
  type_code TEXT UNIQUE,
  aura_gradient TEXT,
  card_accent TEXT,
  text_color TEXT,
  primary_color TEXT,
  icon_name TEXT
);

CREATE TABLE glowtype_i18n (
  id INTEGER PRIMARY KEY,
  glowtype_id INTEGER,
  language TEXT,
  name TEXT,
  tagline TEXT,
  description TEXT,
  self_care_tips TEXT,  -- JSON
  disclaimer TEXT,
  match_summary TEXT,
  FOREIGN KEY (glowtype_id) REFERENCES glowtypes(id)
);
```

---

## Appendix: Import/Export Formats

### Questions Export Format
```json
{
  "questions": [
    {
      "question_id": "q1",
      "order": 1,
      "question_zh": "...",
      "question_en": "...",
      "options": [...],
      "primary_dimension": "energy"
    }
  ]
}
```

### Rules Export Format
```json
{
  "rules": [
    {
      "name": "nebula_rule",
      "description": "...",
      "conditions": {...},
      "result_type_code": "nebula",
      "priority": 100,
      "is_fallback": false
    }
  ]
}
```
