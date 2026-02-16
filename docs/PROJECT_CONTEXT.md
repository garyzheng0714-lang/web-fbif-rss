# FBIF RSS 项目上下文压缩文档

> 规则：每次开发前先阅读本文件；每次改动后在“变更记录”追加一条，确保任何接手人可快速恢复上下文。

## 1. 项目目标
- 构建生产级 RSS 订阅平台，支持飞书登录、信源管理、文章抓取与浏览、原文溯源、Bitable 同步（去重）与飞书异常告警。
- 部署目标是阿里云服务器，采用 Docker 方式，便于从个人服务器迁移到公司服务器。
- 功能模块需高度解耦，后续可单独替换（例如微信公众号模块）。

## 2. 当前架构（2026-02-16）
- 技术栈：Next.js 16 + TypeScript + Prisma + PostgreSQL + Node worker + Tailwind v4。
- Web/API：`src/app`（App Router + Route Handlers）。
- 后端模块：
  - 认证：`src/modules/auth/*`（飞书 OAuth、session）
  - 抓取：`src/modules/feeds/*`（RSS 抓取、去重、失败计数）
  - 同步：`src/modules/bitable/*`（文章同步 + 信源双向同步）
  - 告警：`src/modules/notifications/*`（飞书 webhook/app 消息）
  - 调度：`src/modules/worker/*` + `src/worker/main.ts`
- 数据层：`prisma/schema.prisma`
  - `User`, `Session`, `FeedSource`, `FeedItem`, `NotificationEvent`, `SyncCursor`, `SystemSetting`

## 3. 核心能力现状
- 已完成
  - 飞书 OAuth 登录基础流程：`/api/auth/feishu/start`、`/api/auth/feishu/callback`
  - 登录调试与健康检查：`/api/auth/feishu/debug`、`/api/auth/feishu/check`
  - 信源 CRUD API：`/api/sources`、`/api/sources/[id]`
  - 资讯流 API：`/api/items`
  - 系统 API：`/api/system/status`、`/api/system/run-poll`、`/api/system/sync-sources`
  - RSS 抓取 + DB 去重 + 故障阈值告警 + 恢复告警
  - Bitable 文章同步（按本地未同步数据写入）
  - Bitable 信源双向同步框架
  - 前端页面：登录、资讯流、信源管理、系统监控
  - 微信公众号信源占位类型：`WECHAT_PLACEHOLDER`

- 待完善
  - 与真实 Bitable 字段结构对齐（table_id + 字段名最终确认）
  - 飞书告警接收人 ID 与权限确认
  - 部署到阿里云并联调公网 OAuth 回调
  - 增加更多自动化测试

## 4. 环境变量策略
- 使用 `.env.example` 作为唯一公开模板。
- 敏感信息（如 `FEISHU_APP_SECRET`）仅允许通过服务器环境变量或 GitHub Secrets 注入，不入库。

## 5. 部署与运维策略（目标）
- 本地/服务器统一采用 Docker 运行。
- GitHub Actions 通过 SSH + 远端部署（后续在 `.github/workflows/deploy-aliyun.yml` 固化）。
- Worker 独立进程负责调度抓取与同步，Web 进程只承载页面/API。

## 6. 变更记录
- 2026-02-16（初始化）
  - 从空仓搭建 Next.js 全栈工程。
  - 建立模块化目录结构与 Prisma 数据模型。
  - 完成飞书登录、RSS 抓取、告警、Bitable 同步基础能力。
  - 完成三大业务页面及对应 API。
- 2026-02-16（第一版可运行）
  - 增加 Dockerfile、`docker-compose.yml`、`docker-compose.prod.yml` 与容器启动脚本。
  - 增加阿里云自动部署工作流 `.github/workflows/deploy-aliyun.yml`（SSH + 远端滚动发布）。
  - 增加单元测试（`feed-utils`、`feishu oauth url`）并通过 `lint/test/build`。
  - 生成首个数据库迁移：`prisma/migrations/202602161126_init/migration.sql`。
- 2026-02-16（部署链路稳定性修复）
  - 定位 GitHub Actions 第 3 次部署失败点为 `Validate SSH Key`（`ConnectTimeout=10` 导致超时）。
  - 将工作流中 SSH/SCP 的连接超时统一提升为 `60` 秒，并增加 `ConnectionAttempts=3`。
  - 目标是降低阿里云偶发握手慢导致的假失败，不改变发布流程与业务逻辑。
- 2026-02-16（部署链路二次加固）
  - GitHub Actions 第 4 次部署在 `Validate SSH Key` 仍失败，表现为 SSH 握手超过 60 秒。
  - 将工作流 SSH/SCP `ConnectTimeout` 进一步提升到 `180` 秒，继续保留 `ConnectionAttempts=3`。
  - 第 5 次部署仍在 `Validate SSH Key` 失败（约 9 分钟后退出，符合 3 次 * 180 秒超时），确认阻塞点是 SSH 连通/认证链路而非应用构建步骤。
- 2026-02-16（部署链路三次修复）
  - 第 6 次部署已通过 `Validate SSH Key` 和 `Build And Test`，失败点移动到 `Package Release`。
  - 将发布包输出路径改为 `/tmp/web-fbif-rss-release.tgz`，避免在仓库目录内写归档导致打包异常。
- 2026-02-16（部署链路四次修复）
  - 第 7 次部署再次出现 `exit code 255`，表现为 SSH 握手存在随机失败。
  - 为 `Validate SSH Key`、`Upload Release`、`Deploy On Server` 增加显式 3 次重试（每次失败后等待 10 秒），提升弱网络场景稳定性。
- 2026-02-16（手工部署兜底成功）
  - 通过密码 SSH 验证 ECS 可连通，随后公钥登录恢复可用。
  - 手工执行了与工作流等价的发布流程（打包、上传、远端解包、`docker compose up -d --build`）。
  - 部署时发现宿主机 `3000` 端口被 `docxtemplater-docx-template-service-1` 占用，导致 `fbif-rss-web` 无法启动；停止该容器后服务成功启动。
  - 公网健康检查 `http://112.124.103.65:3000/api/health` 返回 `ok: true`，数据库状态 `up`。
- 2026-02-16（飞书登录 invalid_state 修复）
  - 根因：HTTP 部署下仍按 `production` 强制写 `secure cookie`，浏览器不会保存 `fbif_feishu_state`，回调校验时触发 `invalid_state`。
  - 修复：在 `feishu/start` 与 `feishu/callback` 中改为按请求协议/`APP_BASE_URL` 判断是否启用 `secure cookie`，HTTP 环境可正常保存 state/session。
  - 同步将 `docker-compose.yml` 的 web 端口映射改为 `${WEB_PORT:-3000}:3000`，避免端口变更（如 3002）在重建后失效。
- 2026-02-16（本地联调兜底能力）
  - 增加 `DEV_AUTH_BYPASS_ENABLED` 开关与 `/api/auth/dev-login` 路由，用于本地环境在飞书回调未配置时快速进入系统联调其它模块。
  - 登录页在开关开启时显示“本地开发登录”入口；默认关闭，不影响生产飞书登录流程。
  - 本地已验证链路：`npm run dev -- --port 3002` 后，`/login`、`/api/health` 与 `/api/auth/dev-login -> /api/auth/me` 均可用。
