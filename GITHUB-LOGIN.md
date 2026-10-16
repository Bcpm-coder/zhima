# GitHub 登录配置

现有 ChatGPT 登录保留。只有同时配置 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 后，页面才显示 GitHub 登录入口。

在 https://github.com/settings/developers 创建 OAuth App：
- Application name: 知码社区
- Homepage URL: https://devnote-community-1015.surecabin2.chatgpt.site
- Authorization callback URL: https://devnote-community-1015.surecabin2.chatgpt.site/auth/github/callback

把 Client ID 和 Client Secret 配置为 Sites 运行时环境变量（Secret），重新部署使其生效。不得将 Client Secret 放入源代码、浏览器脚本或聊天。

GitHub 只读取公开用户资料，不请求仓库权限。使用 state + PKCE，7 天 HttpOnly/Secure/SameSite=Lax 会话，数据库只保存会话令牌摘要，不保存 GitHub access token。GitHub 账号与已有 ChatGPT 账号独立，当前不自动关联、合并数据。

真实 OAuth App 尚未配置，因此尚未完成真实 GitHub 账号端到端测试。已完成本地协议、会话、数据隔离与兼容性测试。

回滚基线：Sites version 2，源码 86a7743c9156c2622ac87acc3c4cd7ca2fb983c3。新增的数据库迁移仅创建两张独立表，不改动已有业务数据；如新版发布失败，重新部署 version 2。GitHub 登录启用后需要在独立浏览器中完成授权、写入及刷新后登录状态验证；若失败，关闭这两个环境变量并回滚。
