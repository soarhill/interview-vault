# 面个 Offer · V1 前端

基于原有列表、详情增量实现投稿、审核和内容治理。使用 Next.js App Router、TypeScript strict、Tailwind CSS 与现有 shadcn/Radix 组件。产品行为遵循 [PRD](../docs/product/prd.md)；HTTP 请求及 DTO 唯一依据为 `docs/api/api-design.md`。

## 运行与切换

Node.js ≥ 20（`package.json` engines）。默认全站输出 `X-Robots-Tag: noindex, nofollow`；
站点准备好被搜索引擎收录时，构建/运行环境设 `NEXT_PUBLIC_ALLOW_INDEXING=true` 移除。

```powershell
npm ci
npm run dev
```

前端独立开发时在 `.env.local` 配置：

```dotenv
NEXT_PUBLIC_API_MOCK=true
NEXT_PUBLIC_API_BASE_URL=
```

真实后端联调改为：

```dotenv
NEXT_PUBLIC_API_MOCK=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

空 Base URL 使用同源 `/api/v1`。配置切换后重启开发服务，生产发布前关闭 Mock 并重新构建。独立 Origin 由后端配置明确 CORS Origin 和 credentials；所有请求携带 Cookie，写请求从 XSRF-TOKEN Cookie 获取 CSRF Header。GitHub OAuth 由后端发起。

## 页面与职责

- `/` 与 `/interview/[id]` 保留原有搜索、阅读、复制和返回恢复组件。
- `/me/interviews`、`new`、`[id]/edit`、`[id]/change` 负责投稿与本人内容管理。
- `/admin/reviews`、`[id]` 负责候选治理、快照对照和发布／拒绝。
- `/admin/change-requests`、`[id]` 负责修改／删除审批。
- `/admin/interviews/[id]/edit` 负责已发布内容直改，保留多个来源和历史事实。

API 按 interviews/catalog/auth/reviews 分模块，client 只负责传输和 Result 解包。游客可阅读；登录态 Context 仅服务导航和体验，权限、可用 actions、状态转换、搜索和去重始终由后端决定。

公共列表 URL 使用 companyId、positionCategory、recruitType、q、page；筛选变化重置分页，默认值省略。详情使用 `#question-{id}` 与 `followUpId` 定位，不再使用 follow=1。日期读取相应精度，MONTH/YEAR 不展示占位日。

聚合表单支持草稿／提交两档校验、候选目录、稳定子项 ID、算法信息、问题和追问重排。保存用 canonical 响应建立新基线。冲突后保留输入，读取最新版本并明确核对后才能继续。未保存输入有链接、浏览器后退、刷新和退出登录保护。

关于／反馈页连接作者 GitHub、仓库和 Issues；赞赏二维码位于 `public/support/`，是维护者私有资产（被根 `.gitignore` 忽略，部署时独立注入，缺图时页面自动降级），仅静态展示，不涉及支付接口或权益。

## 本地 Mock

Mock 只在显式配置启用时加载，不增加线上接口。点击 GitHub 登录后可选择本地投稿人／管理员身份。身份由各标签页的 sessionStorage 隔离；数据通过 localStorage 共享，支持两标签并发版本冲突。写操作通过浏览器短锁完成。

演示数据不是正式历史数据迁移结果；多张公开卡片复用示例详情。预置：

- 1001：纯草稿，可删除。
- 1002：待审核，含岗位和标签候选。
- 1003：未通过，可编辑、保存回草稿再重提。
- 1004：本人已发布，可发起变更申请。
- 123–148：公开历史演示记录，含算法、多来源、月份精度和空 HR 轮次。

`/?q=__error__` 模拟失败；不存在的详情显示不存在，批准删除后的稳定 ID 显示已下架。清除当前站点 localStorage 即可重置演示数据；退出仅清除当前身份。

## 检查

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

单测覆盖传输、CSRF、权限、状态转换、canonical ID、版本冲突、候选版本传递、变更审批、历史字段保真、表单校验及复制／URL。

Mock 服务启动后，在本目录运行浏览器验收：

```powershell
npx --yes --package @playwright/cli playwright-cli -s=offer open http://localhost:3000
npx --yes --package @playwright/cli playwright-cli -s=offer run-code --filename=tests/browser-acceptance.pw
npx --yes --package @playwright/cli playwright-cli -s=offer run-code --filename=tests/browser-edge-cases.pw
npx --yes --package @playwright/cli playwright-cli -s=offer close
```

截图写入 `frontend/output/playwright/`（已忽略）。浏览器脚本会重置本地演示数据；不用于真实后端。

真实 GitHub OAuth、Spring Boot 会话/CORS/CSRF 和真实搜索结果仍需后端就绪后的集成验收。桌面浏览器手机尺寸测试不能替代 Safari／Android 真机与跨应用剪贴板验收。
