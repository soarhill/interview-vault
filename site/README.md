# 静态版（interview-vault gh-pages 分支源码）

「面个 Offer」静态阅读版的源码目录。设计、样式与组件自完整版
`frontend/`（Next.js）移植：列表 / 详情 / 关于三个页面，HashRouter，
数据来自 `public/data/interviews.json` 公开快照。

分支与发布说明见仓库根 README。完整版工程见 `main` 分支。

## 与完整版的主要差异

- 路由：Next.js App Router → react-router HashRouter（GitHub Pages 无服务端重写，
  hash 路由保证深链接与刷新不 404）。
- 数据：API + PostgreSQL → 一次性加载的公开快照 JSON；搜索、筛选、分页全部在浏览器完成。
- 锚点：详情页深链定位由 `#question-N` 片段改为 `?questionId=` 查询参数（`#` 已被路由占用）。
- 移除：登录 / 投稿 / 审核 / 我的投稿（完整版功能）、依赖服务端的「加油」互动条、
  赞赏码区块；头部新增 GitHub 入口，页脚提供源码与关于链接。
- 新增：页脚「累计访问 N 次」计数（不蒜子公共服务，与常见静态站同款；
  每次页面加载 +1，无访客 cookie；加载失败自动隐藏）。
