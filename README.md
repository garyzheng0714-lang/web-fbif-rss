# web-fbif-rss

`web-fbif-rss` 是一个面向行业资讯的 RSS 情报系统，包含 Web 管理界面、RSS 抓取 Worker、PostgreSQL 数据库、飞书 OAuth 登录、飞书告警和多维表格同步能力。项目基于 Next.js 16、TypeScript、Prisma 和 Docker 构建。

## 功能概览

- 飞书 OAuth 登录，并提供开发环境快捷登录开关。
- RSS 信源管理，包含分类、启用状态、优先级和轮询间隔。
- RSS 抓取、去重、失败阈值告警和恢复告警。
- 按高/中/低优先级配置不同轮询策略。
- RSSHub 多镜像探测、自动切换和手动切换。
- 资讯流浏览，支持自动刷新和原文链接跳转。
- 将文章和信源同步到飞书多维表格。
- 支持飞书 webhook 或应用消息告警。
- Web 与 Worker 分进程运行，支持 Docker Compose 部署。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma 6
- PostgreSQL 16
- Tailwind CSS 4
- `rss-parser`
- `node-cron`
- `jose`
- Vitest
- Docker / Docker Compose

## 项目结构

```text
src/
  app/                    页面与 API 路由
    (app)/dashboard       资讯流页面
    (app)/sources         信源管理页面
    (app)/system          系统状态页面
    api/                  认证、信源、资讯、系统和健康检查接口
  components/             应用外壳、信源管理、系统面板等组件
  lib/                    环境变量、数据库、HTTP 和工具函数
  modules/
    auth/                 飞书 OAuth、session 和时间工具
    feeds/                RSS 抓取、信源、去重、优先级和 RSSHub 镜像
    bitable/              多维表格客户端与同步服务
    notifications/        飞书告警
    worker/               Worker 调度管道
  worker/main.ts          Worker 入口
prisma/
  schema.prisma           数据模型
  migrations/             数据库迁移
docs/                     部署、飞书配置和项目上下文文档
scripts/                  Docker 入口脚本
```

## 快速开始

环境要求：

- Node.js `>= 20.12.0`
- npm
- PostgreSQL

安装依赖：

```bash
npm ci
```

创建本地环境变量：

```bash
cp .env.example .env
```

初始化数据库：

```bash
npm run db:migrate
```

启动 Web：

```bash
npm run dev:web
```

启动 Worker：

```bash
npm run dev:worker
```

默认 Web 地址为 `http://localhost:3000`。

## 可用命令

```bash
npm run dev           # 启动 Next.js 开发服务
npm run dev:web       # 启动 Web 开发服务
npm run dev:worker    # 启动 Worker 开发进程
npm run build         # prisma generate 后构建 Next.js
npm run start         # 启动生产 Web 服务
npm run worker        # 启动生产 Worker 入口
npm run lint          # 运行 ESLint
npm run test          # 运行 Vitest
npm run test:watch    # 监听模式运行 Vitest
npm run db:generate   # 生成 Prisma Client
npm run db:migrate    # 本地开发迁移
npm run db:deploy     # 部署环境迁移
npm run db:studio     # 打开 Prisma Studio
```

## 配置

`.env.example` 提供了完整配置模板。核心配置包括：

| 变量 | 说明 |
| --- | --- |
| `APP_BASE_URL` | Web 应用对外访问地址 |
| `WEB_PORT` | Docker Compose 暴露的 Web 端口 |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `SESSION_SECRET` | 登录 session 密钥 |
| `DEV_AUTH_BYPASS_ENABLED` | 是否启用开发环境快捷登录 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书应用凭据 |
| `FEISHU_OAUTH_REDIRECT_URI` | 飞书 OAuth 回调地址 |
| `FEISHU_ALERT_MODE` | 告警方式：`none`、`webhook` 或 `app` |
| `BITABLE_APP_TOKEN` | 目标多维表格 app token |
| `BITABLE_ITEM_TABLE_ID` | 文章表 ID |
| `BITABLE_SOURCE_TABLE_ID` | 信源表 ID |
| `SOURCE_SYNC_ENABLED` | 是否启用信源同步 |
| `RSS_SCHEDULER_CRON` | RSS 调度 cron |
| `RSSHUB_MIRRORS` | RSSHub 镜像列表 |
| `RSS_FETCH_CONCURRENCY` | RSS 抓取并发数 |

敏感配置应通过服务器环境变量或 GitHub Secrets 注入，不要提交真实密钥。

## API 摘要

- `GET /api/health`
- `GET /api/items`
- `GET|POST /api/sources`
- `PATCH|DELETE /api/sources/:id`
- `POST /api/sources/deduplicate`
- `GET|PATCH /api/sources/priority-settings`
- `GET /api/sources/rsshub/servers`
- `POST /api/sources/rsshub/switch`
- `GET /api/auth/feishu/start`
- `GET /api/auth/feishu/callback`
- `GET /api/auth/dev-login`
- `POST /api/auth/logout`
- `GET /api/system/status`
- `POST /api/system/run-poll`
- `POST /api/system/sync-sources`
- `POST /api/system/run-mirror-maintenance`

## Docker 运行

```bash
docker compose up -d --build
```

默认服务：

- Web: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Worker: 独立容器进程

生产环境可参考 `docker-compose.prod.yml` 和 `docs/DEPLOYMENT.md`。

## 飞书配置

飞书 OAuth、多维表格字段映射和告警配置请参考：

- `docs/FEISHU_SETUP.md`
- `.env.example`

OAuth 回调地址必须与飞书开放平台后台配置完全一致，包括协议、域名、端口和路径。

## 部署

仓库包含 `.github/workflows/deploy-aliyun.yml`，用于通过 SSH 将构建产物发布到阿里云服务器。需要在 GitHub 仓库中配置部署 Secrets，例如：

- `ALIYUN_HOST`
- `ALIYUN_USER`
- `ALIYUN_SSH_KEY` 或 `ALIYUN_SSH_KEY_B64`
- `APP_DIR`
- `APP_ENV_B64`

## 注意事项

- 不要提交真实 `FEISHU_APP_SECRET`、`SESSION_SECRET`、数据库密码或 webhook 地址。
- Bitable 字段名需要与真实表结构一致，否则同步会失败或写入错误字段。
- Worker 负责抓取、同步和镜像巡检；Web 进程只承载页面与 API。
- 更多上下文和变更记录见 `docs/PROJECT_CONTEXT.md`。
