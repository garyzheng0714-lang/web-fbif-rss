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
- 2026-02-16（本地数据库恢复）
  - 本机已启动 `postgresql@16`（Homebrew），并创建本地库 `fbif_rss`。
  - `.env` 当前本地联调使用 `DATABASE_URL=postgresql://macmini_gary@127.0.0.1:5432/fbif_rss?schema=public`。
  - 已执行 `npx prisma migrate deploy`，本地健康检查恢复为 `database: up`。
- 2026-02-16（信源抓取排障 + 状态文案修复）
  - 复现并定位 `https://sspai.com/feed` 未抓取：根因是信源处于 `enabled=false`，轮询任务会直接跳过，表现为 `run-poll totalSources=0`。
  - 在本地将该信源恢复为启用后，手工触发轮询成功抓取 10 条并入库。
  - 修复信源页状态按钮文案歧义：拆分为“状态（已启用/已停用）”与“开关（停用/启用）”，避免误操作导致停用。
- 2026-02-16（Bitable 去重增强，支撑迁移场景）
  - 在 `bitable-client` 增加 `records/search` 调用能力，用于按条件检索记录。
  - `syncUnsyncedItemsToBitable` 改为“先查重后写入”：按 `去重哈希` 在 Bitable 中检索，已存在则回写本地 `bitableRecordId/syncedToBitableAt`，不存在才新增。
  - 该改动可降低服务器迁移/重建本地库后重复写入多维表格的风险，更贴近“Bitable 作为主数据”的目标。
- 2026-02-16（飞书/Bitable 实网联调完成）
  - 已在本地 `.env` 完成飞书应用与目标 Base 配置，并通过 `tenant_access_token` 联通验证。
  - 自动识别并绑定表：信源表 `tblJLzo6h5Hzx6UO`（订阅源表）、文章表 `tblMmJ8GucoUrg3O`（数据表）。
  - 自动补齐字段：文章表新增 `摘要/链接/来源/发布时间/去重哈希`；信源表新增 `分类/启用/轮询分钟`。
  - 已启用双向信源同步（`SOURCE_SYNC_ENABLED=true`），并完成一次全链路执行：
    - `sync-sources` 成功（pulled=6, pushed=1）
    - `run-poll` 成功（attempted=4, createdItems=60, bitable synced=70）
  - 当前系统状态：`sourceTotal=4`、`itemTotal=70`、`unsyncedItems=0`，Bitable 同步配置全部生效。
- 2026-02-16（交互样式与刷新策略调整）
  - 资讯流卡片“打开原网站”按钮样式强化为白色文字+白色图标，避免在蓝底下出现可读性不一致。
  - 信源列表新增“上次刷新”列，展示每条信源的 `lastCheckedAt`，无记录时显示 `-`。
  - 抓取策略调整为 10 分钟节奏：`RSS_SCHEDULER_CRON` 默认改为 `*/10 * * * *`，信源默认 `pollIntervalMinutes` 改为 `10`。
  - 已将现有本地信源轮询间隔批量更新为 `10`，并同步更新到 Bitable 信源表。
- 2026-02-16（RSSHub 镜像容错与自动切换）
  - 新增 `RSSHUB_MIRRORS` 配置（支持逗号分隔），默认内置 9 个可用镜像，主镜像默认 `https://rsshub.umzzz.com`；当信源是 RSSHub 路由时，抓取会按候选镜像自动重试。
  - 官方 `rsshub.app` 被标记为离线域名：创建/更新信源及 Bitable 拉取信源时会自动改写到首个镜像，避免录入后立即失败。
  - 抓取成功后若使用了备用镜像，会把 `FeedSource.url` 回写为实际可用镜像地址，减少后续失败重试成本。
  - 增加单元测试 `rsshub-mirror.test.ts` 覆盖镜像解析、官方域名重写、候选生成与非 RSSHub URL 保持不变场景。
- 2026-02-16（信源管理：RSSHub 一键切换服务器）
  - 新增接口 `GET /api/sources/rsshub/servers`：实时探测镜像在线状态、状态码、延迟。
  - 新增接口 `POST /api/sources/rsshub/switch`：支持 `auto` 自动选择最快在线服务器，或 `manual` 指定服务器，批量切换所有 RSSHub 信源。
  - 信源管理页新增“RSSHub 服务器切换”区块：展示服务器列表、在线状态和一键切换按钮（自动/手动）。
  - 切换后会刷新信源列表；若启用 Bitable 双向同步配置，接口会自动触发一次信源同步，确保数据一致。
- 2026-02-16（RSSHub 自动巡检与自愈）
  - 新增 worker 管道 `runRsshubMirrorMaintenancePipeline`：定时探测镜像健康，默认仅在“当前主用镜像离线”时自动切换到最快在线镜像，避免频繁抖动。
  - 新增环境变量：`RSSHUB_MIRROR_AUTO_SWITCH_ENABLED`（默认 true）与 `RSSHUB_MIRROR_CHECK_CRON`（默认 `*/30 * * * *`）。
  - 新增接口 `POST /api/system/run-mirror-maintenance`，支持手工触发一次镜像巡检与自愈。
  - 系统页面新增“执行 RSSHub 巡检”按钮，并展示自动巡检开关及 cron 配置状态。
  - 新增单测 `pipeline.test.ts`，覆盖自动巡检的决策逻辑（无可用镜像、当前镜像在线、当前镜像离线切换）。
- 2026-02-16（轮询时间判定修复）
  - 复现问题：`RSS_SCHEDULER_CRON=*/10` 时，若 `lastCheckedAt` 含毫秒（如 `xx:20:00.042`），`xx:30:00` 会被判定为未到期，从而错过一轮。
  - 修复：`isSourceDue` 增加 60 秒容差窗口，避免“整点触发 vs 毫秒时间戳”造成的误跳过。
  - 新增单测覆盖：临界容差内应触发、明显未到期不触发。
  - 调度优化：将 `RSS_SCHEDULER_CRON` 默认改为每分钟运行（`* * * * *`），由 `pollIntervalMinutes` 决定是否真正抓取，避免 10 分钟粒度调度导致的错窗/漂移。
- 2026-02-16（状态颜色一致性修复）
  - 系统页“Bitable 文章同步配置 / 信源双向同步配置 / RSSHub 自动巡检”状态由纯文本改为状态标签：正常态绿色、非正常态灰色。
  - 信源管理页“开关”按钮状态色统一：已启用时展示红色“停用”按钮，已停用时展示绿色“启用”按钮，和状态语义一致。
- 2026-02-16（资讯流动态刷新 + 链接交互调整）
  - 资讯流页面新增实时刷新组件：每 10 秒调用轻量 marker 接口检查最新文章，发现新内容自动 `router.refresh()`，无需手动刷新页面。
  - `GET /api/items` 新增 `mode=marker`，仅返回 `latestItemId/latestAt/total`，用于低开销前端轮询。
  - 文章标题改为超链接（新窗口打开原网站）；移除卡片内“打开原网站”按钮，减少重复交互。
- 2026-02-16（信源优先级与分级轮询）
  - `FeedSource` 新增 `priority` 字段（`HIGH|MEDIUM|LOW`，默认 `MEDIUM`），支持按优先级管理信源。
  - 新增优先级刷新策略接口：`GET/PATCH /api/sources/priority-settings`，支持配置高/中/低优先级轮询分钟。
  - 策略更新后会批量更新全部信源的 `pollIntervalMinutes`，并重置启用信源的 `lastCheckedAt`，同时立即触发一轮抓取。
  - 信源管理页新增“优先级刷新策略”配置面板、信源优先级字段（可逐条调整）。
  - Bitable 信源双向同步新增优先级字段支持：`BITABLE_SOURCE_FIELD_PRIORITY`（默认“优先级”）。
- 2026-02-17（RSSHub 重复信源治理）
  - 新增 RSSHub 路由键提取能力（忽略镜像域名、规范化 query 顺序），用于识别“同一路由不同服务器”的重复信源。
  - 新增去重服务 `deduplicateRsshubSources`：按路由分组合并重复信源，迁移文章并按 `sourceId+guid` 去重后删除冗余信源。
  - 新增接口 `POST /api/sources/deduplicate`，支持一键清理已有重复 RSSHub 信源。
  - 信源创建/更新时新增路由级重复校验，阻止同一路由被不同镜像重复录入。
  - Bitable 双向同步拉取信源时新增路由级匹配，优先更新已有信源，避免继续产生镜像重复项。
