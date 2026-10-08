# 网站访问统计（Umami）

面个 Offer 负责业务，Umami 负责网站访问分析。不自建统计后台、不自研埋点，
只在根 Layout 注入一次官方 tracker，覆盖 Visitors / Page Views / 访问趋势 /
页面排行 / Referrer / 设备 / 浏览器 / 地区。

## 1. 应用侧接入（已完成，默认关闭）

- 注入位置：`frontend/src/app/layout.tsx`。全站只加载一次；
  Umami tracker 默认 auto-track 且已挂接 history API，App Router 的
  客户端路由切换自动统计，**无需也不应**再写 `router.afterEach` 之类的手动上报。
- 开关：`NEXT_PUBLIC_UMAMI_SCRIPT_URL` 与 `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
  （`frontend/.env.example`）**同时非空**才注入；任一为空则完全不注入，站点正常运行。
- 两者都是公开的客户端配置，不是 Secret，可进仓库；但受 `NEXT_PUBLIC_*`
  构建期语义影响，**改值必须重新构建前端**才生效。

## 2. 正式部署 Umami 时的操作清单

1. 在服务器上部署 Umami（官方 Docker Compose：umami + 独立 PostgreSQL，
   建议独立子域 + HTTPS，后台入口加访问控制）；
2. 登录 Umami 后台，立即修改默认 admin 密码；
3. 添加 Website（域名填生产域名），获得 Website ID；
4. 在前端构建环境配置 `NEXT_PUBLIC_UMAMI_SCRIPT_URL` / `NEXT_PUBLIC_UMAMI_WEBSITE_ID`，
   重新构建并部署前端（构建流程见 [production-deployment.md](./production-deployment.md)）；
5. 打开生产站点并浏览几个页面，查看页面源码确认 script 已注入；
6. 回到 Umami 后台确认 Visitors / Page Views 有数据。

Umami 侧的数据库密码、管理员密码等 Secret 只放服务器环境变量，永不入库
（根 `.gitignore` 已拦截 `.env.*`，仅放行 `.env.example`）。

## 3. 边界

- 当前阶段只做基础访问统计，不做业务事件埋点（search / 投稿 / 登录等），
  等产品有真实用户后再按需启用 Umami events；
- Umami 的数据保留与去重（visitor 识别、会话归因）由 Umami 自身完成，
  应用侧不建任何统计相关的表或接口。
