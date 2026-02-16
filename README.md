# web-fbif-rss

一个可生产部署的 RSS 行业情报系统，支持：
- 飞书 OAuth 登录
- 信源管理（RSS + 微信公众号占位）
- RSS 抓取、去重、失败阈值告警
- 资讯流浏览与原文溯源
- 同步到飞书多维表格（Bitable）
- Docker 化部署（Web + Worker）

## 技术栈
- Next.js 16（App Router）
- TypeScript
- Prisma + PostgreSQL
- Node worker（`node-cron`）
- Feishu OpenAPI（OAuth / Bitable / 消息）

## 目录结构
```txt
src/
  app/                    页面与 API 路由
  modules/
    auth/                 飞书登录 + session
    feeds/                RSS 抓取与去重
    bitable/              Bitable 同步
    notifications/        飞书告警
    worker/               调度编排
  worker/main.ts          Worker 入口
prisma/schema.prisma      数据模型
docs/PROJECT_CONTEXT.md   持续上下文文档
```

## 本地开发
1. 安装依赖
```bash
npm ci
```

2. 配置环境变量
```bash
cp .env.example .env
```

3. 初始化数据库
```bash
npm run db:migrate
```

4. 启动 Web
```bash
npm run dev:web
```

5. 启动 Worker（新终端）
```bash
npm run dev:worker
```

## 核心接口
- 认证
  - `GET /api/auth/feishu/start`
  - `GET /api/auth/feishu/callback`
  - `GET /api/auth/feishu/debug`
  - `GET /api/auth/feishu/check`
- 业务
  - `GET|POST /api/sources`
  - `PATCH|DELETE /api/sources/:id`
  - `GET /api/items`
  - `GET /api/system/status`
  - `POST /api/system/run-poll`
  - `POST /api/system/sync-sources`

## Docker 运行
```bash
docker compose up -d --build
```

默认服务：
- Web: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

## 阿里云部署（GitHub Actions）
已提供 `.github/workflows/deploy-aliyun.yml`。

需要在 GitHub 仓库配置 Secrets：
- `ALIYUN_HOST`
- `ALIYUN_USER`
- `ALIYUN_SSH_KEY`（或 `ALIYUN_SSH_KEY_B64`）
- `APP_DIR`（可选，默认 `/opt/web-fbif-rss`）
- `APP_ENV_B64`（可选，base64 编码后的 `.env`）

## 注意事项
- 不要将真实 `FEISHU_APP_SECRET` 提交到仓库。
- 飞书后台重定向地址必须与 `FEISHU_OAUTH_REDIRECT_URI` 完全一致（协议/域名/端口/路径）。
- Bitable 字段名需要与实际表结构对齐。

## 进度文档
每次改动请同步更新：
- `docs/PROJECT_CONTEXT.md`
