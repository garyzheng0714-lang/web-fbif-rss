# 飞书配置清单（OAuth + Bitable + 告警）

## 1. OAuth 登录
1. 在飞书开发者后台打开应用（自建应用）。
2. 在「开发配置 -> 安全设置」添加重定向地址：
   - `https://你的域名/api/auth/feishu/callback`
3. 配置环境变量：
   - `FEISHU_APP_ID`
   - `FEISHU_APP_SECRET`
   - `APP_BASE_URL`
   - `FEISHU_OAUTH_REDIRECT_URI`
4. 启动后检查：
   - `GET /api/auth/feishu/debug`
   - `GET /api/auth/feishu/check`

## 2. Bitable 同步
1. 准备多维表格 `app_token` 与 `table_id`。
2. 配置：
   - `BITABLE_APP_TOKEN`
   - `BITABLE_ITEM_TABLE_ID`
   - （可选）`BITABLE_SOURCE_TABLE_ID` + `SOURCE_SYNC_ENABLED=true`
3. 确保应用有目标表格编辑权限（高级权限/文档应用授权）。

## 3. 飞书告警
支持两种模式：
- `FEISHU_ALERT_MODE=webhook`：走群机器人 webhook
- `FEISHU_ALERT_MODE=app`：走应用消息 API

`app` 模式还需：
- `FEISHU_ALERT_RECEIVE_ID`
- `FEISHU_ALERT_RECEIVE_ID_TYPE`（`open_id` / `user_id` / `chat_id`）

## 4. 常见故障
- `redirect_uri 请求不合法`：回调地址在飞书后台与服务端必须逐字符一致。
- `Permission denied`（Bitable）：应用未被授予目标表可管理权限。
- 消息发送 230013：接收用户不在应用可用范围。
