# Interview Vault · 静态版（gh-pages）

「面个 Offer」的静态阅读版：纯前端实现的面经浏览、搜索、筛选与复制，部署于
GitHub Pages：<https://soarhill.github.io/interview-vault/>。

完整版（Spring Boot + Next.js + PostgreSQL，含投稿 / GitHub 登录 / 审核治理）
在同一仓库的 [`main` 分支](https://github.com/soarhill/interview-vault)。
本分支只服务静态站，不继承 main 的文件树。

## 目录结构

```text
site/     静态版源码（Vite + React + TypeScript）
  src/        页面与组件（自完整版 frontend 移植，HashRouter）
  public/     品牌资源 + 404.html + .nojekyll + data/interviews.json（公开快照）
  scripts/    build-snapshot.mjs：原始导出 → 公开快照
docs/     构建产物（cd site && npm run build 生成），GitHub Pages 发布 /docs
```

## 本地开发

```bash
cd site
npm ci
npm run dev        # 开发服务器
npm run build      # 类型检查 + 构建到 ../docs
npm run test       # vitest 单元测试（搜索 / 筛选 / URL 状态）
npm run lint       # eslint
npm run snapshot   # 重新生成公开数据快照（需要私有原始导出）
```

预览构建产物（模拟 GitHub Pages 的 `/interview-vault/` 前缀）：

```bash
npm run build
# 任意静态服务器以「仓库根目录」为站点根，使 docs 以 /interview-vault/ 路径可访问
```

## 数据管线（本地私有数据 → 公开快照 → 构建 → 发布）

1. **私有导出**（仓库外）：本地库只读导出全部 PUBLISHED 面经到
   `iv-private-export/interviews-raw.json`（含内部字段，绝不提交）。
2. **公开快照**：`npm run snapshot` 按白名单裁剪字段、计算轮次展示名、
   校验（id 唯一 / 无隐私字段 / 仅 http(s) 外链），生成 `site/public/data/interviews.json`。
3. **构建**：`npm run build`。
4. **发布**：人工审核快照 diff 后，随 gh-pages 分支提交并推送，
   GitHub Pages（gh-pages /docs）自动生效。

快照只包含展示必需字段：公司 / 岗位 / 方向 / 招聘类型 / 时间与精度 / 轮次 /
问题 / 追问 / 算法题信息 / 标签 / 原始来源链接。不含任何用户、会话、审核数据。

## 数据来源与边界

- 所有面经整理自牛客（nowcoder.com）等公开渠道，详情页保留原始来源链接。
- 只发布确认为公开、可引用的内容；来源或授权不明确的数据不会进入快照。
- 静态站的公开内容不改变原始内容的著作权；仓库的 Apache-2.0 许可证针对代码。
