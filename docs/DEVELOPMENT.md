## Glowtype.me 开发文档

> 本文档描述当前已落地的架构、代码结构、部署方式以及关键设计决策。
> 最后更新：2024-11

---

## 1. 总体架构概览

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend API   │────▶│   SQLite DB     │
│   React + Vite  │     │   Go + Gin      │     │   (GORM)        │
└────────┬────────┘     └─────────────────┘     └─────────────────┘
         │
         │ (直接调用)
         ▼
┌─────────────────┐
│   OpenAI API    │
│   gpt-4o-mini   │
└─────────────────┘
```

- **前后端分离**：
  - 前端：`frontend/` – React + TypeScript + Vite SPA，负责 UI、测试流程、AI 对话
  - 后端：`backend/` – Go + Gin REST API，负责数据管理、评分逻辑、统计分析
- **数据库**：SQLite + GORM（支持多租户扩展）
- **AI 集成**：前端直接调用 OpenAI-compatible API（可配置其他兼容服务）
- **域名**：
  - `https://glowtype.me` – 前端
  - `https://api.glowtype.me` – 后端 API

---

## 2. 后端（backend/）

### 2.1 技术栈

- Go 1.23+，Gin HTTP 框架
- GORM + SQLite（数据持久化）
- JWT（管理员认证）
- 模块名：`github.com/soaringjerry/glowtype`

### 2.2 目录结构

```
backend/
├── cmd/glowtype-api/main.go    # 服务入口
├── internal/
│   ├── config/                 # 环境变量配置
│   ├── database/               # GORM 模型、数据库初始化、种子数据
│   ├── handlers/               # HTTP handlers
│   │   ├── quiz.go             # 测试题目 API
│   │   ├── glowtype.go         # 类型结果 API
│   │   ├── chat.go             # 对话 API + 分析追踪
│   │   ├── admin.go            # 管理后台 CRUD + 认证
│   │   ├── stats.go            # 统计分析 API
│   │   └── ...
│   ├── services/               # 业务逻辑
│   │   ├── scoring_service.go  # 评分引擎（规则匹配）
│   │   ├── quiz_service.go     # 测试服务
│   │   ├── admin_auth.go       # 管理员认证服务
│   │   └── ...
│   ├── models/                 # 请求/响应结构体
│   ├── middleware/             # 日志、CORS、认证
│   ├── utils/                  # 工具函数（GeoIP、匿名化等）
│   └── server/                 # Gin 初始化、路由注册
├── config/                     # 静态配置文件（旧版兼容）
└── data/                       # SQLite 数据库文件
```

### 2.3 数据模型

主要数据表（通过 GORM 自动迁移）：

| 表名 | 用途 |
|------|------|
| `trait_dimensions` | 人格维度定义（energy, expression 等） |
| `quiz_questions` | 测试题目及选项（多语言） |
| `scoring_rules` | 评分规则（维度范围 → Glowtype 映射） |
| `glowtypes` | 类型基础信息（code, 颜色等） |
| `glowtype_i18n` | 类型多语言文案 |
| `quiz_results` | 匿名测试结果记录 |
| `chat_sessions` | 匿名对话会话统计 |
| `usage_stats` | 每日使用统计 |
| `glowtype_stats` | 类型分布统计 |
| `ai_prompts` | AI 提示词配置 |
| `chapters` / `glow_sticks` | 光签内容（Glowpedia） |
| `admin_users` | 管理员账户 |
| `admin_audit_logs` | 操作审计日志 |

### 2.4 API 端点

#### 公开 API（`/api/v1`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/quiz?lang=` | 获取测试题目 |
| POST | `/quiz/score` | 提交答案、计算结果 |
| POST | `/quiz/result` | 保存详细测试结果（匿名） |
| GET | `/glowtypes/:id?lang=` | 获取类型文案 |
| POST | `/chat/session` | 创建对话会话 |
| POST | `/chat/message` | 发送对话消息 |
| POST | `/chat/analytics` | 追踪对话统计 |
| GET | `/help?lang=` | 获取帮助热线 |
| POST | `/stats/event` | 记录使用事件 |
| GET | `/prompts` | 获取公开 AI 提示词 |

#### 管理 API（`/api/v1/admin`）

需要 JWT 认证。

| 分类 | 端点 |
|------|------|
| 认证 | `POST /login`, `GET /me` |
| 账户管理 | `GET /users`, `POST /users` |
| 审计日志 | `GET /audit` |
| 维度 CRUD | `/dimensions` |
| 题目 CRUD | `/questions` |
| 类型 CRUD | `/glowtypes`, `/glowtypes/i18n` |
| 规则 CRUD | `/rules`, `/rules/debug`, `/rules/validate` |
| 提示词 | `/prompts` |
| 统计 | `/stats/overview`, `/stats/daily`, `/stats/glowtypes`, `/stats/enhanced` |
| 结果查询 | `/results` |
| 光签 | `/chapters`, `/glowsticks` |

### 2.5 评分引擎

评分流程：
1. 用户提交答案 → 根据选项的 `scores` 字段累加各维度分数
2. 按规则优先级（高→低）匹配，第一个满足条件的规则胜出
3. 无匹配则使用 fallback 规则
4. 返回 Glowtype code + 维度分数

规则条件示例：
```json
{
  "dimensions": {
    "energy": { "min": 0, "max": null },
    "expression": { "min": 0, "max": null }
  }
}
```

### 2.6 匿名化与隐私

- **不存储 IP 地址**：仅转换为地区代码后丢弃
- **GeoIP 查询**：优先使用 Cloudflare `CF-IPCountry` 头，备用 ip-api.com
- **设备识别**：从 User-Agent 提取设备类型（mobile/desktop/tablet）
- **时间粒度**：仅记录小时级别（0-23）

---

## 3. 前端（frontend/）

### 3.1 技术栈

- React 18 + TypeScript + Vite
- react-router-dom（路由）
- react-i18next（国际化）
- Tailwind CSS（样式）
- Lucide React（图标）

### 3.2 目录结构

```
frontend/src/
├── main.tsx                # 入口
├── App.tsx                 # 路由配置
├── api/                    # API 客户端
├── utils/
│   └── ai.ts               # OpenAI 调用封装
├── i18n/                   # 多语言资源
│   ├── en/
│   └── zh-CN/
├── pages/                  # 页面组件（旧）
├── views/                  # 视图组件（新）
├── components/             # 通用组件
└── admin/                  # 管理后台
    ├── AdminLayout.tsx
    ├── AdminLogin.tsx
    ├── hooks/useAdmin.ts   # API hooks
    └── pages/              # 各管理页面
```

### 3.3 Tailwind CSS 动态类名问题

⚠️ **重要：Glowtype 样式配置的坑**

Tailwind CSS 会在构建时 purge 掉未在源代码中静态出现的 class。这意味着如果你在数据库中配置了动态的 Tailwind class（如 `from-purple-50`），但代码里没有静态引用这个 class，它会被删除，导致样式不生效。

**症状**：
- 某些 Glowtype 卡片样式正常，其他的样式异常（背景色、文字颜色不对）
- 新建的 Glowtype 样式不生效

**解决方案**：
在 `frontend/tailwind.config.js` 中配置了 safelist，预先保留所有可能用到的动态 class：

```javascript
safelist: [
  // cardAccent: from-{color}-{50,100,200}, to-{color}-{50,100,200}
  { pattern: /^from-(slate|gray|...|rose)-(50|100|200)$/ },
  { pattern: /^to-(slate|gray|...|rose)-(50|100|200)$/ },
  // textColor: text-{color}-{700,800,900,950}
  { pattern: /^text-(slate|gray|...|rose)-(700|800|900|950)$/ },
]
```

**新建 Glowtype 时可用的样式值**：

| 字段 | 格式 | 示例 |
|------|------|------|
| cardAccent | `from-{颜色}-{深度} to-{颜色}-{深度}` | `from-purple-50 to-violet-100` |
| textColor | `text-{颜色}-{深度}` | `text-purple-900` |

- 颜色：slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose
- cardAccent 深度：50, 100, 200
- textColor 深度：700, 800, 900, 950

**如需使用其他深度**，需在 `tailwind.config.js` 的 pattern 中添加。

---

### 3.4 AI 集成

前端直接调用 OpenAI-compatible API：

```typescript
// utils/ai.ts
const config = {
  apiKey: window.ENV.AI_API_KEY || import.meta.env.VITE_AI_API_KEY,
  baseUrl: window.ENV.AI_API_URL || 'https://api.openai.com/v1',
  model: window.ENV.AI_MODEL || 'gpt-4o-mini',
};
```

功能：
- **宇宙洞察**：根据 Glowtype 生成诗意短句
- **AI 对话**：支持多轮对话，带上下文

提示词可通过管理后台配置，存储在数据库中。

### 3.5 管理后台

路径：`/admin`

功能模块：
- **仪表盘**：使用统计、每日趋势、类型分布、地区/设备/时段分析
- **维度管理**：定义人格维度（两极标签、阈值）
- **题目管理**：CRUD 测试题目和选项
- **类型管理**：CRUD Glowtype 及多语言文案
- **评分规则**：配置规则条件、优先级、调试工具
- **AI 提示词**：配置系统提示词
- **光签管理**：Glowpedia 章节和内容
- **结果记录**：查看匿名测试结果
- **管理员账户**：多账户管理（仅超级管理员）
- **操作审计**：查看所有管理操作日志

---

## 4. 部署

### 4.1 Docker 部署（推荐）

```bash
# 一键部署
GEMINI_API_KEY=your_key curl -fsSL https://raw.githubusercontent.com/soaringjerry/glowtype/main/scripts/remote_setup.sh | bash
```

端口配置（`.env`）：
```env
GLOWTYPE_BACKEND_PORT_HOST=18080
GLOWTYPE_FRONTEND_PORT_HOST=18081
```

### 4.2 本地开发

后端：
```bash
cd backend
cp .env.example .env
go run ./cmd/glowtype-api
```

前端：
```bash
cd frontend
npm install
cp .env.example .env.local  # 配置 VITE_AI_API_KEY
npm run dev
```

### 4.3 环境变量

后端（`backend/.env`）：
```env
PORT=8080
ENV=development
ALLOWED_ORIGINS=http://localhost:5173
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
# 获取真实 IP：Cloudflare 前置时设置为 auto,cloudflare（同时信任容器内网与 CF 边缘）
TRUSTED_PROXIES=auto,cloudflare
```

前端（`frontend/.env.local`）：
```env
VITE_API_BASE_URL=http://localhost:18080/api/v1
VITE_AI_API_KEY=sk-xxx
VITE_AI_API_URL=https://api.openai.com/v1
VITE_AI_MODEL=gpt-4o-mini
```

---

## 5. CLI 工具

### 数据导出

```bash
cd backend
go run ./cmd/export-data/main.go -format json -output export.json
go run ./cmd/export-data/main.go -format csv -output export.csv
```

导出内容（全部匿名）：
- 测试结果：维度分数、类型、语言、地区、设备、时段
- 对话统计：消息数、时长、地区、设备

---

## 6. 安全设计

- **隐私优先**：不收集 PII，IP 仅用于地区推断后立即丢弃
- **JWT 认证**：管理 API 需要有效 token
- **多管理员**：支持 superadmin / admin 角色区分
- **审计日志**：所有管理操作记录 IP、时间、操作内容
- **登录保护**：失败次数限制 + 账户锁定

---

## 7. 扩展计划

- [ ] 多租户完整支持
- [ ] 更多 AI 模型选项
- [ ] 导出报告 PDF
- [ ] 数据可视化增强
