## Glowtype.me – 部署与自动化运维说明

本说明基于以下约定实现：

- 使用 Docker + docker-compose 管理前后端服务；
- 使用 GitHub Actions + GHCR 完成 CI/CD；
- 通过 SSH 从 GitHub Actions 触发服务器上的更新（方案 B）。

### 目录结构新增内容

- `Dockerfile.backend` – Go 后端镜像构建（多阶段，最终 distroless 非 root）。
- `Dockerfile.frontend` – 前端构建（Node 构建 + Nginx 提供静态资源）。
- `docker-compose.yml` – 定义 `backend` 与 `frontend` 两个服务。
- `.env.example` – 根目录环境变量示例（端口 + Vite API base）。
- `scripts/setup_and_run.sh` – 一键安装与启动脚本。
- `frontend/nginx.conf` – 前端容器内 Nginx 配置（SPA fallback，隐私友好的日志格式）。
- `.github/workflows/deploy.yml` – CI & 部署工作流。

---

## 一键安装 / 启动脚本

### 使用步骤

在目标服务器上（以 Ubuntu 为例）：

```bash
git clone https://github.com/soaringjerry/glowtype.git
cd glowtype
chmod +x scripts/setup_and_run.sh
./scripts/setup_and_run.sh
```

脚本会执行：

1. 检查 `docker` 与 `docker compose` / `docker-compose` 是否可用；
2. 确认根目录 `.env` 是否存在，不存在则从 `.env.example` 复制或创建默认值；
3. 确认 `backend/.env` 是否存在，不存在则从 `.env.example` 复制或创建默认值；
4. 执行 `docker compose pull`（如有远端镜像则拉取）；
5. 执行 `docker compose build` 构建本地镜像（首次会稍慢）；
6. 执行 `docker compose up -d` 后台启动服务。

完成后脚本会打印访问地址，例如：

- Frontend: `http://localhost:${GLOWTYPE_FRONTEND_PORT_HOST}`
- Backend API: `http://localhost:${GLOWTYPE_BACKEND_PORT_HOST}/api/v1`

重复运行脚本会再次执行 pull/build/up，可用于更新到最新配置或镜像。

### 关键环境变量

根目录 `.env`（示例见 `.env.example`）：

- `GLOWTYPE_BACKEND_PORT_HOST` – 宿主机暴露的后端端口（默认 8080）。
- `GLOWTYPE_FRONTEND_PORT_HOST` – 宿主机暴露的前端端口（默认 5173）。
- `VITE_API_BASE_URL` – 前端构建时使用的 API 地址（docker-compose 下默认 `http://backend:8080/api/v1`）。

后端 `backend/.env`（示例见 `backend/.env.example`）：

- `PORT` – 容器内后端监听端口（默认 8080；本地直接运行时默认使用 18080）。
- `ENV` – `development` / `production`。
- `ALLOWED_ORIGINS` – CORS 允许的前端来源（生产环境请设置为你的前端域名）。
- `LOG_LEVEL` – 日志级别。
- `CHAT_PROVIDER` – 当前为 `mock`。

docker-compose 使用根目录 `.env` 做变量替换；后端容器使用 `backend/.env`。

---

## Docker 与 docker-compose 架构

### 后端镜像（Dockerfile.backend）

- 基于 `golang:1.24` 构建阶段，编译 `glowtype-api` 二进制；
- 使用轻量的 `alpine:3.20` 作为运行阶段镜像，并创建非 root 用户；
- 将 `backend/config` 一并复制到容器中；
- 默认暴露 `8080` 端口。

### 前端镜像（Dockerfile.frontend）

- 基于 `node:22-alpine` 构建阶段：
  - `npm ci`；
  - 使用构建参数 `VITE_API_BASE_URL`（默认 `http://backend:8080/api/v1`）；
  - `npm run build` 生成静态资源。
- 基于 `nginx:1.27-alpine` 运行阶段：
  - 使用 `frontend/nginx.conf` 作为默认站点配置；
  - SPA 模式下所有路径回退到 `index.html`；
  - 使用精简日志格式，不记录客户端 IP。

### docker-compose.yml

两项服务：

- `backend`：
  - 构建自 `Dockerfile.backend`；
  - 使用 `backend/.env` 作为环境变量；
  - 暴露 `${GLOWTYPE_BACKEND_PORT_HOST:-18080}:8080`；
  - 重启策略 `unless-stopped`。

- `frontend`：
  - 构建自 `Dockerfile.frontend`；
  - 构建参数 `VITE_API_BASE_URL` 默认 `http://backend:8080/api/v1`，可通过根 `.env` 覆盖；
  - 依赖 `backend`；
  - 暴露 `${GLOWTYPE_FRONTEND_PORT_HOST:-18081}:80`；
  - 重启策略 `unless-stopped`。

说明：在生产部署场景下，推荐依赖 GHCR 中由 CI/CD 构建好的镜像，`scripts/setup_and_run.sh` 默认只执行 `docker compose pull` + `docker compose up -d`。如需在本机从源码构建镜像，可设置环境变量 `GLOWTYPE_LOCAL_BUILD=1` 再运行脚本。

---

## CI/CD（GitHub Actions）

工作流：`.github/workflows/deploy.yml`

触发条件：

```yaml
on:
  push:
    branches:
      - main
```

### Job 1：test-and-build

- 后端：
  - 使用 Go 1.24；
  - 执行 `cd backend && go test ./...`。
- 前端：
  - 使用 Node 22；
  - 执行 `cd frontend && npm ci && npm run build`。

### Job 2：docker-build-and-push（仅构建 & 推送镜像）

- 使用 Docker Buildx；
- 登录 GHCR（`ghcr.io`），镜像命名：
  - 后端：`ghcr.io/<owner>/glowtype-backend:latest`
  - 前端：`ghcr.io/<owner>/glowtype-frontend:latest`
- 构建并推送镜像：
  - `Dockerfile.backend`
  - `Dockerfile.frontend`（传入 `VITE_API_BASE_URL` 构建参数，默认 `https://api.glowtype.me/api/v1`，可在 workflow 中修改）。

> CI/CD 只负责把最新镜像推送到 GHCR，不再通过 SSH 直接登录服务器做部署。  
> 服务器端可以通过以下方式自动更新：
>
> - 使用 watchtower 等工具监测 GHCR 镜像更新并自动 `pull + restart`；
> - 或由运维周期性执行 `docker compose pull && docker compose up -d`。

---

## 全新 Ubuntu 服务器部署步骤（概览）

1. 安装 Docker（含 docker compose 插件）：
   - 参考官方文档或 `apt` 仓库；
   - 确保 `docker --version` 与 `docker compose version` 可用。
2. 创建部署用户并配置 SSH 公钥（与 GitHub Secrets 中私钥对应）。
3. 登录服务器，克隆仓库：
   ```bash
   git clone https://github.com/soaringjerry/glowtype.git /opt/glowtype
   cd /opt/glowtype
   ```
4. 根据需要调整：
   - 根目录 `.env`（端口、`VITE_API_BASE_URL`）；
   - `backend/.env`（`ALLOWED_ORIGINS` 设置为前端域名）。
5. 运行一键脚本：
   ```bash
   chmod +x scripts/setup_and_run.sh
   ./scripts/setup_and_run.sh
   ```
6. 之后每次 push 到 `main`：
   - 自动跑测试与构建；
   - 自动构建并推送 Docker 镜像到 GHCR；
   - 服务器可由 watchtower 或人工执行 `docker compose pull && docker compose up -d` 完成更新。
