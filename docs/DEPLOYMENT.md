# 部署说明（阿里云 + Docker + GitHub Actions）

## 1. 服务器准备
- 安装 Docker 与 Docker Compose 插件。
- 开放 80/443（或 3000 端口用于测试）。
- 创建部署目录（默认）：`/opt/web-fbif-rss`

## 2. GitHub Secrets
在仓库 `Settings -> Secrets and variables -> Actions` 配置：
- `ALIYUN_HOST`
- `ALIYUN_USER`
- `ALIYUN_SSH_KEY`（推荐）或 `ALIYUN_SSH_KEY_B64`
- `APP_DIR`（可选，默认 `/opt/web-fbif-rss`）
- `APP_ENV_B64`（可选，建议放 base64 编码后的 `.env`）

## 3. 首次部署建议
1. 本地先验证：
   - `npm run lint`
   - `npm run test`
   - `npm run build`
2. 推送到 `main` 分支，触发 `deploy-aliyun.yml`。
3. 部署后访问：
   - `http://<服务器IP>:3000/api/health`

## 4. 公网域名
生产环境建议绑定域名并通过 Nginx/Caddy 反向代理到 `3000`，同时配置 HTTPS。

## 5. 回滚
工作流在服务器保留最近 5 个 `releases/<sha>` 目录。若需回滚：
1. 登录服务器
2. 将 `current` 软链接指向旧 release
3. 在 release 目录执行 `docker compose up -d --build`
