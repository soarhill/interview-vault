# 面个 Offer（Interview Vault）前端开发规范

> **版本：V1 · Public Beta**
>
> **更新时间：2026-10-07**
>
> 本文件是「面个 Offer」前端长期开发规范；`Interview Vault` 继续作为工程名。产品行为以 [PRD](../product/prd.md) 为准，系统边界以 [系统架构](../architecture/system-architecture.md) 为准，接口以 [API 设计](../api/api-design.md) 为准。

---

# 1. 工程原则

前端继续使用：

~~~text
Next.js App Router
TypeScript
React
现有 UI / CSS 体系
~~~

核心原则：

1. **页面按业务职责组织，不为了“企业级”提前制造复杂目录。**
2. **组件不直接 fetch，所有 HTTP 调用统一经过 API 层。**
3. **URL 能表达的页面状态由 URL 持有，不复制第二份全局状态。**
4. **服务端数据不重复维护成全局 Store。**
5. **前端权限只负责用户体验，真正权限以后端为准。**
6. **TypeScript strict，运行时代码不使用 `any`。**
7. **PC / H5 共用同一套业务组件，不维护两套页面。**
8. **加载、空状态、失败、冲突、权限不足都属于正式产品状态。**
9. **不为了目录漂亮重写已经清晰、稳定的代码。**
10. **发现 PRD / API 契约冲突时先修文档，不由前端自行发明业务规则。**

---

# 2. 页面与路由

V1 目标路由：

~~~text
/                               公开面经列表 / 搜索
/interview/[id]                 公开面经详情

/me/interviews                  我的投稿
/me/interviews/new              新建投稿
/me/interviews/[id]/edit        编辑草稿 / 待审核 / 被拒投稿
/me/interviews/[id]/change      已发布面经修改 / 删除申请

/admin/reviews                  投稿审核列表
/admin/reviews/[id]             投稿审核详情
/admin/change-requests          已发布内容变更申请列表
/admin/change-requests/[id]     变更申请详情
~~~

GitHub OAuth 本身由后端 `/api/v1/auth/github` 发起，不要求为了登录单独建设复杂页面；如果未来需要登录说明页，再新增 `/login`。

## 2.1 公共列表 URL 状态

列表页筛选和搜索必须进入 URL，刷新 / 分享 / 前进后退行为一致。

推荐 Query：

~~~text
companyId
positionCategory
recruitType
q
page
~~~

规则：

- 默认值省略；
- company / positionCategory / recruitType / q 变化时，page 重置为 1；
- “重置”清除全部搜索筛选参数；
- URL 是已提交筛选状态的唯一来源；
- 输入框尚未提交的文本可以是 local state；
- 列表 → 详情 → 返回，应恢复 URL 与滚动位置。

---

# 3. 目标目录结构

现有 `src/app`、`components/list`、`components/detail` 已经清晰，不为了新规范全部重写。

Public Beta 在此基础上渐进扩展：

~~~text
frontend
├── public
│   └── support                 # 作者主动提供的赞赏二维码等静态资源
│
└── src
    ├── app
│   ├── page.tsx
│   ├── interview/[id]/page.tsx
│   ├── me/interviews/...
│   └── admin/...
│
    ├── components
    │   ├── list
    │   ├── detail
    │   ├── submission
    │   ├── review
    │   ├── auth
    │   ├── shared
    │   └── ui
    │
    ├── hooks
    │
    └── lib
        ├── api
        │   ├── client.ts
        │   ├── errors.ts
        │   ├── interviews.ts
        │   ├── catalog.ts
        │   ├── auth.ts
        │   ├── reviews.ts
        │   └── types
        ├── navigation.ts
        └── ...
~~~

这是一张方向图，不是要求立即创建所有空目录。

## 3.1 app

App Router 页面文件只承担：

- 路由参数；
- 页面级 Suspense / error boundary；
- 必要 metadata；
- 组装业务页面组件。

不要把一个完整业务页面几百行全部塞进 `page.tsx`。

## 3.2 components

按业务界面职责组织：

~~~text
list         公开列表 / 搜索
detail       公开面经详情
submission   投稿表单、轮次编辑器、问题编辑器
review       管理员审核、Candidate 处理、ChangeRequest 审核
auth         登录相关展示
shared       多个业务页面真正共用的组件，例如 AboutFeedbackDialog
ui           Button / Dialog / Input 等无业务语义基础组件
~~~

`shared` 在前端仅表示“跨页面共享 UI”，不能变成什么都往里放的垃圾桶。

## 3.3 hooks

Hook 必须表达具体行为，例如：

~~~text
useUrlState
useResource
useCopy
useListRestore
useInterviewForm
useCurrentUser
~~~

避免：

~~~text
useCommon
useHelper
useData
~~~

## 3.4 lib

放无 UI 的前端基础能力：

- API transport；
- API error；
- URL / navigation；
- 文本复制 / 高亮等纯逻辑。

不要把 React 业务组件放入 lib。

---

# 4. 命名规范

## 4.1 文件

React 组件文件继续使用 kebab-case：

~~~text
interview-card.tsx
interview-form.tsx
question-editor.tsx
candidate-resolver.tsx
~~~

组件名使用 PascalCase：

~~~text
InterviewCard
InterviewForm
QuestionEditor
CandidateResolver
~~~

Hook：

~~~text
use-interview-form.ts
useInterviewForm
~~~

普通函数使用 camelCase。

## 4.2 组件命名

优先使用业务名：

推荐：

~~~text
InterviewCard
InterviewDetailPage
InterviewForm
InterviewRoundEditor
QuestionEditor
CandidateResolver
ReviewPanel
ChangeRequestPanel
~~~

避免：

~~~text
DataBox
ContentItem
Info
Wrapper
CommonCard
CommonForm
~~~

名称本身应尽量说明“它在业务里干什么”。

## 4.3 TypeScript 类型

类型使用 PascalCase：

~~~text
InterviewDetailResponse
InterviewUpsertRequest
CurrentUserResponse
ApiError
~~~

API Request / Response 类型应与后端契约命名对齐。

不混用一套：

~~~text
DTO
VO
Model
Data
Info
~~~

来表达同一层概念。

---

# 5. API 层

组件内禁止直接调用 `fetch`。

所有 HTTP 请求必须经过：

~~~text
src/lib/api
~~~

## 5.1 client.ts

`client.ts` 只负责通用传输：

- Base URL；
- fetch；
- JSON 解析；
- 超时 / AbortSignal；
- HTTP 状态；
- `Result<T>` 解包；
- 统一 `ApiError`；
- 所有 API 请求统一 `credentials: include`，不手动管理登录 Token；
- 初始化 / 登录态变化后调用 `GET /api/v1/auth/csrf`；
- 从 `XSRF-TOKEN` Cookie 读取 CSRF Token，写请求放入 `X-XSRF-TOKEN` Header；
- 本地 3000 → 8080 联调依赖后端明确 CORS Origin + credentials，生产通过 Nginx 同源 `/api`。

后端统一返回：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {}
}
~~~

业务组件不应反复写：

~~~ts
if (response.code === "SUCCESS") {
  // ...
}
~~~

API 层直接返回已经 unwrap 的 data。

调用方目标体验：

~~~ts
const detail = await getInterviewDetail(id);
~~~

而不是让组件了解 Result 包装细节。

## 5.2 按业务拆 API

Public Beta 接口增加后，不再把几十个函数全部塞进一个巨大 client.ts。

推荐：

~~~text
api/interviews.ts
api/catalog.ts
api/auth.ts
api/reviews.ts
~~~

例如：

~~~text
listInterviews
getInterviewDetail
createInterview
saveInterview
submitInterview

listCompanies
listPositions
listTags

getCurrentUser
logout

getReviewDetail
publishInterview
rejectInterview
approveChangeRequest
~~~

## 5.3 ApiError

统一错误对象至少保留：

~~~text
httpStatus
code
message
~~~

页面根据业务语义处理：

~~~text
401  -> 引导 GitHub 登录
403  -> 权限不足
404  -> Not Found / 对应空状态
409  -> 状态或 version 冲突，显示明确冲突提示
500  -> 通用服务异常，不暴露内部信息
~~~

不要把所有失败都转换成同一个 Toast“操作失败”。

---

# 6. Result<T> 与 Warning

后端返回 `Result<T>`，前端 API 层统一解包。

如果 data 内含 warning，例如：

~~~text
SOURCE_URL_DUPLICATE_SUSPECTED
~~~

它不是请求失败。

前端应：

- 保留用户已填内容；
- 给出明确但非阻断提示；
- 允许用户继续流程。

不要把 warning 当 409 或错误页。

---

# 7. TypeScript 与数据边界

- 保持 `strict: true`；
- 运行时代码禁止 `any`；
- JSON / 外部未知数据边界使用 `unknown`；
- 不把后端 Entity 思维复制到前端；
- API Response、表单状态、UI 派生状态可以是不同类型。

例如：

~~~text
InterviewDetailResponse     后端返回
InterviewFormState          编辑器内部状态
InterviewCardView           仅在确有必要时的 UI 派生模型
~~~

只有真实需要时才创建 ViewModel，不为每个 Response 再复制一份同构类型。

---

# 8. 状态管理

状态遵循以下优先级：

## URL State

适合：

- 搜索词；
- 筛选；
- 分页；
- 可分享页面状态。

## Local State / useReducer

适合：

- 未提交的输入；
- 弹窗开关；
- 投稿表单；
- 编辑器 dirty 状态；
- 本组件 loading / feedback。

复杂投稿表单如果 `useState` 开始难以维护，可以使用 `useReducer`；不要为了“企业级”直接引入全局状态库。

## Server Data

后端数据不要再复制一份长期全局 store。

V1 暂不因为投稿和审核引入 Redux / Zustand。只有出现真实跨页面复杂共享状态问题后再评估。

## Context

真正全局且稳定的状态可以使用 Context，例如：

- 当前登录用户；
- 全局复制弹窗等跨树 UI 能力。

前端 CurrentUser 只服务展示与导航，不能替代后端鉴权。

---

# 9. 认证与权限

## 9.1 当前用户

统一通过：

~~~text
GET /api/v1/auth/me
~~~

获取：

~~~text
id
githubLogin
avatarUrl
role
~~~

不要在多个页面重复实现“是否登录”的不同判断逻辑。

## 9.2 UI 权限

~~~text
ANONYMOUS
  -> 可浏览 / 搜索
  -> 投稿时引导 GitHub 登录

USER
  -> 我的投稿
  -> 创建 / 编辑 / 申请修改删除

ADMIN
  -> USER 能力
  -> 审核入口
~~~

但必须明确：

> **隐藏按钮不是安全措施，所有最终权限以后端为准。**

不要把 GitHub Access Token 暴露给前端长期保存。

---

# 10. 投稿表单

投稿表单是 Public Beta 最复杂的前端交互，必须按聚合整体设计。

逻辑结构：

~~~text
InterviewForm
├── CompanySelector
├── DepartmentInput
├── PositionSelector
├── TagSelector
├── RecruitType
├── SourceUrl
└── InterviewRoundEditor[]
    └── QuestionEditor[]
        └── FollowUpEditor[]
~~~

`DepartmentInput` 为可选自由文本（能确认部门时填写，如“抖音电商”）。

## 10.1 Existing / Proposed

Company / Position：

~~~text
existingId
proposedName
~~~

已有正式项与用户新提议值二选一。

Tags：

~~~text
tagIds
proposedTags
~~~

前端只能提出 Candidate，不能直接创建正式 Catalog 数据。

## 10.2 顺序

前端不维护后端 `sortOrder` 字段。

数组顺序即展示 / 保存顺序：

~~~text
rounds[0] -> 第 1 个
questions[0] -> 第 1 个
followUps[0] -> 第 1 个
~~~

后端负责转换 sortOrder。

## 10.3 草稿与提交

必须区分两个动作：

~~~text
保存草稿
提交审核
~~~

保存草稿：

- 允许内容不完整；
- 基础格式错误仍提示；
- 保存失败不能清空用户输入。

提交审核：

- 前端做友好完整性检查；
- 后端仍做最终校验；
- 不因为前端校验通过就假设一定可以提交。

## 10.4 version

编辑接口携带后端返回的 `version`。

遇到：

~~~text
INTERVIEW_VERSION_CONFLICT
~~~

前端不能自动覆盖服务器最新内容。

必须明确提示：

> 当前内容已经发生变化，请刷新后重新确认。

用户尚未保存的本地内容不能因为弹一个错误就直接丢失。

---

# 11. 审核页面

管理员审核页至少需要表现：

~~~text
当前投稿内容
作者
Candidate
原始 SubmissionSnapshot
version
更新时间
拒绝原因（如有）
~~~

Candidate 操作：

~~~text
使用已有正式项
创建新的正式项
删除不合理 Tag 候选
~~~

每次 Candidate resolve 必须携带当前 `version`；成功后用响应中的新 version 更新审核页本地状态，后续 resolve / publish 继续使用新 version，不能沿用旧版本。

审核页面使用后端 version。

如果管理员打开旧页面后作者已经修改：

~~~text
409 INTERVIEW_VERSION_CONFLICT
~~~

页面必须停止发布 / 拒绝动作，提示管理员刷新后重新审核。

不能静默覆盖。

管理员直接修改已发布面经复用同一套编辑器（`PUT /api/v1/admin/interviews/{id}`），但此时新公司 / 岗位 / 标签由管理员直接创建为正式 Catalog 数据，不展示“待审核 Candidate”语义。前端需表达：

~~~text
存在 PENDING 申请 -> 409 CHANGE_REQUEST_CONFLICT，先去处理申请
版本冲突          -> 409 INTERVIEW_VERSION_CONFLICT，刷新后重试
~~~

---

# 12. ChangeRequest UI

已发布面经的修改 / 删除不是直接改线上数据。

前端必须把它表达成：

~~~text
申请修改
申请删除
待审核
已批准
已拒绝
~~~

修改申请编辑的是完整目标版本。

公开详情在审核期间仍展示当前 PUBLISHED 内容，不切换到待审核 payload。

---

# 13. 页面状态

所有核心页面至少考虑：

~~~text
loading
success
empty
error
permission-denied
conflict（适用时）
~~~

公共列表：

~~~text
Loading / Success / Empty / Error
~~~

详情：

~~~text
Loading / Success / 404 / Error / AnchorInvalid
~~~

投稿：

~~~text
Loading
Editing
Dirty
Saving
Saved
Submitting
ValidationError
VersionConflict
Error
~~~

审核：

~~~text
Loading
Reviewing
ResolvingCandidate
Publishing / Rejecting
VersionConflict
AlreadyHandled
Error
~~~

操作过程中按钮应避免重复提交，但**前端禁用按钮不等于后端幂等保证**。

---

# 14. 搜索与详情

搜索命中逻辑以后端为准。

前端只负责：

- URL 状态；
- 渲染 filters；
- 渲染 matches；
- 视觉高亮；
- 问题锚点定位；
- 返回列表状态恢复。

禁止把后端的：

~~~text
多关键词 AND
同篇跨问题命中
大小写规则
来源去重
~~~

再复制一套到前端。

问题锚点继续基于稳定 Question ID。

搜索定位 URL 契约：

~~~text
/interview/{id}?q={keyword}&followUpId={followUpId}#question-{questionId}
~~~

- 命中主问题（kind = QUESTION）：只带 `#question-{questionId}`；
- 命中追问（kind = FOLLOW_UP）：带 `followUpId` 与其主问题锚点，定位到对应追问；
- 不使用数组下标或 `follow=1` 这类位置猜测参数。

高亮只修改视觉，不改变复制文本。

历史详情若返回 `originalPositionName / inferredPositionName / note`，以低视觉权重的辅助信息展示；不能因为新版标准 Position 已存在就把真实原岗位与事实性备注完全隐藏。

日期展示统一读取 `interviewDate + interviewDatePrecision`：DAY 显示完整日期，MONTH 只显示到月，YEAR 只显示到年；列表的 `firstInterviewDate` 同时使用 `firstInterviewDatePrecision`，禁止把月首 / 年首占位值渲染成真实具体日。

---

# 15. UI 与响应式

产品主品牌在用户界面统一展示为 **「面个 Offer」**；`Interview Vault` 只在关于 / 开源工程信息等场景作为工程名出现。

保持当前 V1 视觉方向：

- 浅色界面；
- 清晰信息层级；
- 白色卡片；
- 轻边框；
- 克制圆角；
- 不堆炫光 / 渐变 / 装饰动画。

主题色、边框、文字层级等尽量集中为 CSS variables / 设计 token，不在组件中散落大量 magic color。

## Desktop

- 列表根据宽度 2～3 列；
- 详情正文保持舒适阅读宽度；
- 投稿编辑器不能因为大屏无限拉宽；
- 管理审核区可以使用更宽工作区，但仍需保持层级清晰。

## Mobile

- 单列；
- 重要操作不依赖 Hover；
- 触控区域足够；
- 长标签 / URL / 问题文本不产生横向溢出；
- 复杂投稿表单也必须可以手机编辑，不建设第二套 H5 业务页面。

---

## 15.1 关于 / 反馈 / 支持作者

V1 提供一个统一的“关于 / 反馈”入口，建议实现为轻量 Dialog / Drawer，不新增独立复杂页面。

推荐组件：

~~~text
components/shared/about-feedback-dialog.tsx
~~~

内容包含：

~~~text
项目简介
作者 / GitHub
开源仓库
GitHub Issues 反馈入口
支持作者
~~~

反馈规则：

- Bug、产品建议、数据问题统一跳转项目 GitHub Issues；
- 前端不提交 feedback API；
- 不维护 feedback 表单状态、工单状态或站内回复系统；
- 如果后续配置 Issue Template，可以分别进入 Bug / 功能建议 / 数据问题模板。

支持作者规则：

- 微信 / 支付宝等二维码由作者主动提供；
- 二维码作为前端静态资源，例如 `public/support/`；
- 不调用后端支付 API；
- 不实现订单、支付回调、金额记录、会员状态；
- 页面必须明确“赞赏完全自愿，不影响任何功能，也不会获得额外权益”。

“关于 / 反馈”入口在 PC 与 H5 均需可访问，但不应喧宾夺主或阻塞核心浏览体验。

---

# 16. 组件与抽象规则

允许抽组件的典型条件：

- 有独立业务职责；
- 文件明显过大；
- 同样交互重复出现；
- 独立状态 / 生命周期值得封装。

不要因为 JSX 有十几行就强行拆一层。

避免：

~~~text
CommonCard
CommonList
BaseForm
UniversalDialog
~~~

这类过早万能抽象。

`components/ui` 只放无业务语义基础组件。

---

# 17. 测试与质量门槛

每轮重要前端开发至少通过：

~~~text
npm run typecheck
npm run lint
npm run test
npm run build
~~~

核心浏览器流程需要覆盖：

1. 搜索 / 筛选 / 分页；
2. 详情 / 锚点 / 复制；
3. GitHub 登录后的用户状态；
4. 新建投稿；
5. 保存草稿；
6. 提交审核；
7. 被拒后修改重提；
8. 管理员处理 Candidate；
9. 发布 / 拒绝；
10. ChangeRequest 修改 / 删除审批；
11. version 冲突；
12. PC / 手机主要流程。

不要求每个纯展示组件都写单测，但关键业务状态转换不能只靠人工点一遍。

---

# 18. 禁止项

V1 前端不因为“规范”引入：

- Redux / Zustand 等全局状态库（除非后续出现真实需求）；
- 第二套移动端业务页面；
- 组件内散落 fetch；
- 自己复制后端搜索 / 权限 / 审核规则；
- `any`；
- 巨型万能 Common 组件；
- 前端自行创建正式 Company / Position / Tag；
- 在浏览器保存 GitHub Secret / 数据库信息；
- 为未来可能存在的页面提前创建大量空目录。

---

# 19. 开发前阅读顺序

前端开发或 AI 执行前依次阅读：

~~~text
PRD.md
-> docs/architecture/system-architecture.md
-> docs/api/api-design.md
-> docs/frontend/frontend-development.md
~~~

涉及后端领域含义时再阅读：

~~~text
docs/database/database-design.md
docs/backend/package-structure.md
~~~

---

# 20. 验收原则

前端完成 Public Beta 后重点确认：

- API 全部通过统一 client；
- 页面没有自行发明后端业务规则；
- Result<T> / ApiError 处理统一；
- 401 / 403 / 404 / 409 UI 语义正确；
- 搜索状态可刷新 / 分享 / 返回恢复；
- 草稿与提交审核校验强度不同；
- version 冲突不会静默覆盖；
- 用户未保存表单不会因普通请求错误直接丢失；
- admin 入口只对 ADMIN 展示，但安全仍依赖后端；
- PC / H5 共享业务组件；
- “关于 / 反馈”入口可访问，GitHub Issues 跳转正确，赞赏二维码仅为静态展示；
- typecheck / lint / test / build 全部通过。
