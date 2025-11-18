## Glowtype.me

Glowtype.me 是一个面向青年的中英双语情绪类型小测试站点。

本仓库包含：

- `frontend/`：React + TypeScript + Vite 单页应用，支持中英双语（react-i18next）。
- `backend/`：Go (Gin) REST API，提供测验题目、评分、结果文案、聊天占位接口和帮助资源。

### 快速开始

#### 后端

```bash
cd backend
go run ./cmd/glowtype-api
```

默认监听 `:8080`，主要路由前缀为 `/api/v1`。

#### 前端

```bash
cd frontend
npm install
npm run dev
```

开发环境下前端会通过 `VITE_API_BASE_URL`（默认 `http://localhost:8080/api/v1`）访问后端。

### 目录约定（目标）

- 后端：
  - `cmd/glowtype-api/` – 入口 `main.go`
  - `internal/server/` – Gin 初始化、路由和中间件
  - `internal/handlers/` – HTTP 处理函数（quiz、glowtype、chat、health、help）
  - `internal/services/` – 业务逻辑与评分、聊天 mock 等
  - `internal/models/` – 结构体定义
  - `internal/storage/` – 从 JSON 读取测验与类型配置
  - `internal/config/` – 配置与环境变量
  - `internal/middleware/` – 日志、CORS、恢复等

- 前端：
  - `src/pages/` – 各页面组件
  - `src/components/` – Navbar、页脚、通用组件
  - `src/i18n/` – 中英 JSON 文案
  - `src/api/` – 与后端交互封装

