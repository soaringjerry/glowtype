## Glowtype.me 开发文档（阶段性记录）

> 本文档描述目前已经落地的架构、代码结构、部署方式以及关键 UX 设计决策，便于后续开发与对外沟通。

---

## 1. 总体架构概览

- 前后端分离：
  - 前端：`frontend/` – React + TypeScript + Vite 单页应用，承载 Glowtype 测试、结果展示、聊天与帮助页面。
  - 后端：`backend/` – Go + Gin REST API，负责题目配置、评分接口、Glowtype 文案、聊天 mock 和帮助信息。
- 域名规划（目标）：
  - `https://glowtype.me` – 前端 Web。
  - `https://api.glowtype.me` – 后端 API（在本地/测试环境为 `http://localhost:<port>/api/v1`）。
- 数据持久化：
  - 当前阶段使用 JSON 配置文件（quiz + glowtypes），无真实数据库。
  - Chat 为内存 mock（简单 session + 文本回复），不持久化会话。

---

## 2. 后端（backend/）实现情况

### 2.1 技术栈与结构

- Go 1.23+，使用 Gin 作为 HTTP 框架。
- 模块名：`github.com/soaringjerry/glowtype`
- 目录结构：
  - `cmd/glowtype-api/main.go` – 服务入口。
  - `internal/config` – 环境变量配置（`PORT`, `ENV`, `ALLOWED_ORIGINS`, `LOG_LEVEL`, `CHAT_PROVIDER`）。
  - `internal/server` – Gin 初始化、路由注册。
  - `internal/handlers` – HTTP handler（quiz、glowtype、chat、health、help）。
  - `internal/services` – 业务逻辑（quiz 组装、评分 placeholder、glowtype 查找、chat mock、help 文案）。
  - `internal/models` – 请求/响应结构体。
  - `internal/storage` – 从 JSON 文件加载 quiz 与 glowtype 配置。
  - `internal/middleware` – 最小隐私日志中间件（不记录完整 IP）、CORS。
  - `backend/config` – `quiz.json` & `glowtypes.json` 配置。

### 2.2 API 端点（当前实现）

所有 API 均挂载在 `/api/v1`：

- 健康检查：
  - `GET /api/v1/health` → `{ "status": "ok" }`
- Quiz：
  - `GET /api/v1/quiz?lang=en|zh-CN`
    - 读取 `backend/config/quiz.json`，按语言返回题目列表。
  - `POST /api/v1/quiz/score`
    - 请求体：`{ quizId, language, answers[] }`
    - 当前逻辑：返回固定 `glowtypeId: "quiet-comet"` 作为 placeholder。
- Glowtype 结果：
  - `GET /api/v1/glowtypes/:id?lang=en|zh-CN`
    - 读取 `backend/config/glowtypes.json`，按 id + 语言返回文案（name, tagline, description[], selfCareTips[], disclaimer）。
- Chat（mock）：
  - `POST /api/v1/chat/session` – 创建内存 session，返回 `sessionId`。
  - `POST /api/v1/chat/message` – 基于简短模板返回一段中/英文本，附带简单安全提示。
- Help：
  - `GET /api/v1/help?lang=en|zh-CN`
    - 返回当前语言下的危机说明 + 热线列表（目前内置英文示例 + 中文示例）。

### 2.3 配置与运行

- 配置文件示例：
  - `backend/.env.example`：
    - `PORT`（容器内端口，当前配置 8080，Go 默认 fallback 为 18080）
    - `ENV`、`ALLOWED_ORIGINS`、`LOG_LEVEL`、`CHAT_PROVIDER`
- 本地运行（开发）：

```bash
cd backend
go run ./cmd/glowtype-api
```

---

## 3. 前端（frontend/）实现情况

### 3.1 技术栈与结构

- React + TypeScript + Vite。
- 路由：`react-router-dom`。
- i18n：`react-i18next` + JSON 资源文件（`en` / `zh-CN`）。
- 样式：Tailwind CSS v3（通过 PostCSS 插件引入），无额外 UI 框架。

主要目录：

- `src/main.tsx` – React 入口，加载 i18n 与全局样式。
- `src/App.tsx` – 应用路由 + Layout（Navbar, Footer, `<main />`）。
- `src/pages`：
  - `HomePage.tsx` – 首页（Hero + “怎么玩” + 轻量安全说明）。
  - `QuizPage.tsx` – 测试页面，从后端拉题并提交回答。
  - `ResultPage.tsx` – 结果页，从后端拉 Glowtype 文案。
  - `ChatPage.tsx` – 匿名聊天 UI，调用后端 mock chat 接口。
  - `HelpPage.tsx` – 展示后端返回的 hotline & help。
  - `SafetyPage.tsx` – 安全与隐私文案。
- `src/components`：
  - `Navbar.tsx` – 顶部导航（含语言切换）。
  - `Footer.tsx` – 底部危机提示 + Help 链接。
- `src/i18n` – 中英文文案：
  - `en/` 与 `zh-CN/` 下分 `common.json`, `home.json`, `quiz.json`, `result.json`, `help.json`。
- `src/api/client.ts` – 简单 `apiGet` / `apiPost` 封装。

### 3.2 首页（HomePage）当前状态

Hero 区：

- 左侧：
  - `heroBadge`：简短标签，例如“给年轻人的趣味情绪小测试”。
  - `heroTitle`：`你的 Glowtype 是什么？ ✨ / What’s your Glowtype? ✨`
  - `heroSubtitle`：一句话说明“2 分钟小测试 → Glowtype 星卡”，避免长段说明。
  - 唯一主 CTA：`开始测试 / Start the quiz`，蓝色圆角按钮，轻微 Glow + 点击缩放。
- 右侧：
  - 一张小型漂浮 Glow 卡片（使用 `glow-orbit` 动画和简单光效），仅作为“结果卡片”的示意，不再充当主视觉。

“怎么玩”区：

- 标题：`怎么玩 / How it works`。
- 三步内容（中英双语绑定 i18n）：
  - 1️⃣ 选几个最像你的情况 / Tap through a few mini questions
  - 2️⃣ 系统拼出你的情绪轨迹 / We trace your emotional orbit
  - 3️⃣ 看到属于你的 Glowtype 星卡 / You get a Glowtype star card
- 样式：
  - 使用 `.how-wave` 绘制一条轻微倾斜的彩色渐变线作为时间线；
  - 每个步骤是一个“蜡笔风贴纸”风格的 chip：
    - 背后有淡彩涂抹（渐变 + blur）；
    - 外圈虚线描边 + 手写风字体（通过 Google Fonts `Gloria Hallelujah`，class `.crayon-text`）。

“它很轻，不是诊断”区：

- 用一个浅色 rounded pill 包裹：
  - `🪐 它很轻，不是诊断` + 一句轻松解释；
  - `🔐 关于隐私和安全感` 链接指向 `/safety` 页面。
- 整体也应用 `.crayon-text`，呈现更友好的手写语气。

### 3.3 Quiz 页面

- 从后端 `GET /api/v1/quiz?lang=` 拉题，题目结构由后端 JSON 控制。
- 一次只展示一道题：
  - 顶部显示进度（`Question x of y / 第 x / y 题`）；
  - 有一条简洁 progress bar；
  - 题目和选项封装在一个浅色卡片内。
- 选项交互：
  - 单选，点击即高亮当前选项；
  - 选中态与 Hover 使用轻量发光阴影，强化“可点击”感。
- 导航：
  - 上一题 / 下一题 / 最后一题为“查看结果”。

### 3.4 Result 页面

- 从 URL 参数 `:typeId` + `GET /api/v1/glowtypes/:id?lang=` 获取当前 Glowtype 文案。
- 展示内容：
  - 顶部标题：`Your Glowtype / 你的 Glowtype`；
  - Glowtype 名称 + tagline；
  - 描述段落（`description[]`）；
  - 自我照顾建议（`selfCareTips[]`）；
  - 免责声明（使用 i18n 的简化版本，避免临床词汇，强调“不是诊断，遇到严重情况应找大人或热线”）。
- CTA：
  - `Chat about this / 想聊聊这个结果` → `/chat`
  - `Help & hotlines / 帮助与热线` → `/help`

### 3.5 Chat 页面

- 结构：
  - 顶部说明条：匿名、非紧急、遇到明显危险请优先联系本地热线。
  - 中间是聊天窗口，左右气泡，支持多轮对话。
  - 底部输入框 + 发送按钮。
- 功能：
  - 初次访问创建 sessionId；
  - 每条消息调用 `POST /api/v1/chat/message`，返回一段文本和可选安全提示；
  - 当前为 mock 文案，将来可替换为真实 LLM 接入。

---

## 4. 部署与运维（已落地部分简述）

> 详细见根目录 `DEPLOYMENT.md` 与 CI 配置 `.github/workflows/deploy.yml`。

概要：

- Docker：
  - `Dockerfile.backend` – 后端 Go 多阶段构建，最终 Alpine 镜像，非 root 运行。
  - `Dockerfile.frontend` – 前端 Node 构建 + Nginx 运行静态文件。
  - `docker-compose.yml`：
    - `backend` + `frontend` 两个服务；
    - 使用 `backend/.env` 和根 `.env` 控制端口与 API base；
    - 支持通过 `GLOWTYPE_BACKEND_PORT_HOST` / `GLOWTYPE_FRONTEND_PORT_HOST` 自定义宿主机端口。
- 一键脚本：
  - `scripts/setup_and_run.sh`：
    - 检查 Docker / compose；
    - 初始化 `.env` 和 `backend/.env`（如不存在则从示例复制）；
    - `docker compose pull` + 可选本地 `build`（通过 `GLOWTYPE_LOCAL_BUILD` 控制）；
    - `docker compose up -d` 启动服务。
- CI/CD（GitHub Actions）：
  - 工作流：`.github/workflows/deploy.yml`：
    - `test-and-build`：Go 测试 + 前端 build；
    - `docker-build-and-push`：构建并推送 backend & frontend 镜像到 GHCR；
    - 不再进行 SSH 部署，由服务器端通过 watchtower 或人工 `docker compose pull && docker compose up -d` 更新。

---

## 5. 后续待办 / 方向建议（给未来开发看）

- 评分逻辑：
  - 将 `/quiz/score` 从固定 `quiet-comet` 升级为基于题目配置的可调分数模型。
- Glowtype 星卡视觉：
  - 按照 `UX-VISUAL-GUIDE` 中的 Starfield × Emotional Spectrum 方向，逐步把结果页的主视觉改成“情绪星球 + 星卡”的组合；
  - 当前代码已经有部分 glow / orbit 尝试，后续需配合设计统一。
- 分享卡（viral）：
  - 提供结果页一键导出分享图（1080×1920 / 1:1），整合 Glowtype 名称、星球插图、星云背景和 Logo。
- 真正的蜡笔字体资源：
  - 当前使用 Google Fonts 的 `Gloria Hallelujah` 作为轻量替代；
  - 如有预算，可采购更适配品牌的手写 / crayon 字体，并通过 self-host 的方式接入。

