# 生产部署 Runbook

本文档是生产部署的唯一权威入口：环境变量、Profile、网络边界、TLS / Cookie、数据库与备份、种子导入。
基础设施的具体 Docker / Nginx / HTTPS 配置文件可参考 `chore/deploy-v1` 分支的历史做法，
但数据迁移与配置基线以本文档为准。

## 1. 环境变量（全部必填）

后端以 `SPRING_PROFILES_ACTIVE=prod` 启动时，`ProductionConfigGuard` 会拒绝任何
开发默认值 / 占位符 / localhost 配置——启动失败即配置不全，不要绕过：

| 变量 | 说明 |
| --- | --- |
| `IV_DB_URL` | `jdbc:postgresql://<私网地址>:5432/interviewvault` |
| `IV_DB_USER` / `IV_DB_PASSWORD` | 数据库账号；密码不得为 `dev` 或空 |
| `IV_GITHUB_CLIENT_ID` / `IV_GITHUB_CLIENT_SECRET` | GitHub OAuth App 凭据（callback 为 `https://<域名>/api/v1/auth/github/callback`） |
| `IV_CORS_ORIGINS` | 前端 Origin 白名单（逗号分隔），不得含 localhost |
| `IV_LOGIN_SUCCESS_REDIRECT` | 登录成功回跳地址，不得指向 localhost |
| `IV_ADMIN_GITHUB_IDS` | 管理员 GitHub 数字 ID 白名单（逗号分隔），必填 |
| `IV_SERVER_PORT` | 后端监听端口（默认 8080） |

前端构建期变量：`NEXT_PUBLIC_API_MOCK=false`、`NEXT_PUBLIC_API_BASE_URL=https://<域名>`；
需要搜索引擎收录时设 `NEXT_PUBLIC_ALLOW_INDEXING=true`（默认 noindex/nofollow）；
访问统计为可选项——`NEXT_PUBLIC_UMAMI_SCRIPT_URL` 与 `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
同时非空才启用，部署清单见 [analytics.md](./analytics.md)。

**私有静态资产（赞赏码）**：`frontend/public/support/` 下的两张收款二维码是维护者私有资产，
不进开源仓库（根 `.gitignore` 忽略）。生产交付方式：部署时从仓库外私有存储把图片复制进该目录，
在图片就位后执行 `next build`；`next start` 以运行时读取 `public/` 的方式提供静态文件，
已启动实例也可在不停机的前提下补入图片。缺图时关于页赞赏区自动降级为一行提示，不影响其他功能。
上线检查单（§6）含赞赏码可访问性核对项。

## 2. prod profile 的行为

`application-prod.yml` 相对开发默认值的变化：

- `server.forward-headers-strategy: native` —— 信任反向代理的 `X-Forwarded-*`，
  OAuth `redirect_uri` 与客户端 IP（加油限流）取值才正确；
- Session Cookie `Secure=true; SameSite=Lax; HttpOnly` —— 只经 HTTPS 传输；
- Swagger / OpenAPI 文档关闭（`springdoc.*.enabled=false`）；
- 会话空闲 7 天（存 PostgreSQL `spring_session` 表）。

## 3. 网络与 TLS 边界

- 后端与 PostgreSQL 只监听私网 / localhost，安全组不放行 8080 与 5432/5433 到公网；
- TLS 在 Nginx 终止：`proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Forwarded-For $remote_addr;`；
  请求体上限（`client_max_body_size`）设 1m，与应用层 `PAYLOAD_TOO_LARGE`（1 MB）对齐；
- 单层 Nginx 入口必须覆盖客户端自带的 X-Forwarded-For，不能使用追加链并信任首段。
  应用只读取容器解析后的 remoteAddr；prod 的 native 转发头解析只应信任实际反向代理。
  后端绝不能直接暴露公网。多层代理须另行配置可信代理网段/地址解析规则，并实际验证伪造头不改变限流键。

## 4. 数据库

- PostgreSQL 18（Flyway 依赖 ≥ 11.14 的 PG18 支持，pom 已固定 `flyway.version`）；
- 迁移与数据初始化的分链说明见 §5。

## 5. 数据初始化（两条链，严格区分）

**开源仓库链（任何人可用）**：仓库包含 V1 完整 schema（含申请修订号 request_version）与岗位方向字典。空库启动后端即自动建表，得到一个可正常运行的空数据系统——
这是开源贡献者本地起服务的全部所需，不依赖任何外部数据文件。

**维护者生产链（仅项目所有者）**：真实面经数据不在仓库内。生产初始化
使用仓库外的私有备份（pg_dump 基线）在目标库恢复；备份的存放位置与恢复命令由
维护者私存，不进入本仓库，也不出现在任何文档中。恢复后按 §6 上线检查单对账
（列表 total、筛选计数、详情抽查）。

- 开源仓库不包含生产面经数据；普通贡献者不需要、也不应获得任何数据文件。
- V1 基线只在空库执行，已有库追加执行后续迁移；后续 schema 变更按 Flyway 惯例**新增**版本文件，
  永不修改已发布的历史迁移；
- 备份：至少每日 `pg_dump`，恢复演练一次再上线。

## 6. 上线检查单

- [ ] prod profile 启动通过（fail-fast 未拦截）
- [ ] HTTPS 打开首页，登录回跳正常，Cookie 带 `Secure` 属性
- [ ] 公网无法直连后端 8080 与数据库端口
- [ ] `/swagger-ui/index.html` 与 `/swagger-ui.html` 均返回 404（文档已关）
- [ ] 从 `IV_ADMIN_GITHUB_IDS` 移除一个测试管理员并重启，其旧会话访问管理接口立即 403
- [ ] 匿名连点 6 次「接受祝福」，第 6 次返回 429
- [ ] 关于页展开「查看赞赏码」，两张二维码正常显示（私有资产已按 §1 注入）
- [ ] 备份任务与恢复演练通过
- [ ] Umami 已收到访问数据（若启用，见 [analytics.md](./analytics.md)）

## 7. 已知边界

- 限流（匿名加油）是单实例内存实现：扩展到多实例时需上移到入口（Nginx limit_req 或网关）；
- Session 没有绝对生命周期上限（仅 7 天空闲过期）；要求强过期时清空 `spring_session` 表强制重登；
- Maven 侧 CVE 扫描（OWASP dependency-check）尚未纳入 CI。
