# 面个 Offer（Interview Vault）后端开发说明

> **版本：V1 · Public Beta**
>
> 后端实现者的施工说明。产品规则以 [PRD](../product/prd.md) 为准，领域边界以 [系统架构](../architecture/system-architecture.md) 为准，数据库以 [数据库设计](../database/database-design.md) 为准，接口以 [API 设计](../api/api-design.md) 为准，包结构与命名以 [包结构规范](./package-structure.md) 为准。

---

## 1. 工程形态

后端采用：

> **Spring Boot + Java + Maven 的模块化单体，单 Maven Module。**

V1 不把 auth / interview / catalog / review / search 拆成多个 Maven Module，也不拆微服务。

Java 顶层包：

~~~text
com.interviewvault
├── auth
├── interview
├── catalog
├── review
├── search
└── common
~~~

具体类如何落位、命名和现有代码怎么迁移，全部以 [package-structure.md](./package-structure.md) 为准。

---

## 2. 分层职责

模块内部按实际需要使用：

~~~text
controller
service
repository
entity
dto/request
dto/response
enums
~~~

核心规则：

- Controller 薄，只负责 HTTP、参数绑定、鉴权入口和 Result 返回；
- Service 承担业务规则、状态机、事务和资源权限；
- Repository 承担数据库访问；
- Entity 不直接返回给 Controller；
- API 使用 Request / Response DTO；
- 默认不创建 Service + ServiceImpl 形式主义层；
- 不建设 DDD 四层，也不做提前抽象。

---

## 3. API 与 Result<T>

所有 V1 HTTP 契约以 [API 设计](../api/api-design.md) 为准。

项目统一使用 Result<T>，但 HTTP Status 仍保持真实语义：

~~~text
400 参数错误
401 未登录
403 无权限
404 不存在
409 状态 / version / 唯一性冲突
500 未预期异常
~~~

统一异常处理位于 common/exception，统一响应位于 common/response。不要恢复旧版 ErrorResponse 双轨响应。

---

## 4. 权限

接口级：

~~~text
Public GET        permitAll
/api/v1/me/**     authenticated
/api/v1/admin/**  ADMIN
~~~

资源级由 Service 继续检查，例如 interview.authorId == currentUser.id。

Spring Security 解决“你是什么身份”，Service 解决“这条数据是否允许你操作”。

会话与引导：

~~~text
登录态    服务器 HttpSession + JSESSIONID Cookie（HttpOnly / 生产 Secure / SameSite=Lax），不使用 JWT
CSRF      CookieCsrfTokenRepository；XSRF-TOKEN Cookie -> X-XSRF-TOKEN Header
客户端    API 请求统一 credentials: include；GET /api/v1/auth/csrf 用于初始化 / 刷新 Token
CORS      本地仅放行明确前端 Origin 且 allowCredentials=true；生产通过 Nginx 同源 /api
OAuth     state 由 Spring Security 生成并校验
管理员引导 IV_ADMIN_GITHUB_IDS 环境变量白名单，OAuth 命中即 ADMIN
~~~

Session 经 spring-session-jdbc 存 PostgreSQL（7 天不活动过期，重启不掉登录态），不为此引入 Redis。

---

## 5. 数据访问

- PostgreSQL 是 V1 唯一核心数据源。
- MyBatis / MyBatis-Plus Mapper 放在各业务模块 repository。
- 简单 CRUD 可以使用 MyBatis-Plus；复杂搜索 SQL 可以使用 XML / 手写 SQL。
- Flyway 管理 schema。
- Entity 不跨 Web 边界直接输出。
- 不引入 Redis、Elasticsearch、消息队列。
- 搜索当前直接查 PostgreSQL，索引根据真实 SQL + EXPLAIN 决定，不机械加满单列索引。

---

## 6. 事务

以下场景必须以业务事务保证一致：

- 提交审核 + SubmissionSnapshot + 状态迁移；
- Candidate 处理 + 正式 Catalog 数据关联 + 发布；
- ChangeRequest UPDATE 批准 + 正式内容替换；
- ChangeRequest DELETE 批准 + REMOVED；
- 管理员直接修改已发布内容 + InterviewRevision 审计 + 条件更新；
- 草稿聚合保存涉及的 Round / Question / FollowUp 更新。

事务边界放 Service，不放 Controller。

---

## 7. 并发

V1 使用：

> **预期状态条件 UPDATE + affectedRows + InterviewRecord.version 乐观锁 + 数据库 UNIQUE 约束。**

状态迁移 SQL 必须带预期原状态。

~~~sql
UPDATE interview_record
SET status = 'PUBLISHED',
    version = version + 1
WHERE id = ?
  AND status = 'PENDING_REVIEW'
  AND version = ?;
~~~

- affectedRows = 1：这次成功修改目标记录。
- affectedRows = 0：状态或 version 已变化，返回 409。
- UNIQUE 用于重复数据最终兜底，不等同于状态竞争控制。

Candidate resolve 也会改变当前审核内容：请求必须携带 InterviewRecord.version，成功处理 Candidate 后 version + 1；作者或管理员基于旧 version 的后续写入返回 409。

创建 / 覆盖 / 审批 PENDING ChangeRequest 与管理员直接修改 PUBLISHED 时，都要在短事务内对目标 interview_record 做行级锁，再检查正式 version 与 PENDING 申请状态，避免先检查后写入的竞态。该锁只存在于一次数据库事务内，不是页面级长锁，也不需要 Redis。

V1 不为这些场景引入 Redis 分布式锁，也不建设通用 Idempotency-Key。

---

## 8. 校验

### 保存草稿

允许业务内容不完整，只做基础格式校验。

### 提交审核

执行完整业务校验：

- Company / Position 有正式值或 Candidate；
- RecruitType 已填写；
- 至少一轮；
- 至少一个有效 Question；
- Question / FollowUp 内容合法。

### 发布

进一步要求：

- Company / Position 已转为正式目录数据；
- 不存在未处理 Candidate；
- 当前状态和 version 正确；
- 内容结构合法。

不要为了省事在草稿 DTO 上把所有字段全部加 @NotNull / @NotEmpty。

---

## 9. 搜索

search 模块集中负责：

- 多关键词 AND；
- 中文包含；
- 英文大小写不敏感；
- LIKE 特殊字符转义；
- 跨问题分散命中；
- 命中片段；
- 筛选和查询 SQL。

搜索拥有“查询能力”，不拥有 Interview / Company / Position / Tag 这些领域实体。

V1 不做 Elasticsearch、Embedding、向量检索、AI 语义判重。

---

## 10. Catalog

正式 Company / Position / Tag 属于 catalog。

普通用户不能直接创建正式 Catalog 项。用户投稿提出不存在的公司 / 岗位 / 标签时进入 interview.InterviewCandidate；管理员审核后再绑定已有项、创建正式项或删除不合理 Tag 候选。

不要重新建设 runtime Alias / Mapping 系统。

---

## 11. 测试

至少覆盖：

- search 核心检索语义；
- Controller 的 HTTP / Result 契约；
- Service 状态迁移；
- version 乐观锁冲突；
- 管理员直接修改已发布内容（含 PENDING ChangeRequest 冲突与 InterviewRevision 审计）；
- UNIQUE 冲突的业务错误转换；
- 投稿草稿与 submit 不同校验强度；
- 纯草稿删除（进入过审核历史的不可删）；
- Candidate resolve；
- ChangeRequest approve / reject；
- PostgreSQL 关键查询集成测试。

真库集成测试优先使用 Testcontainers，与开发数据库隔离。

---

## 12. 开发纪律

开发前阅读顺序：

~~~text
docs/product/prd.md
-> docs/architecture/system-architecture.md
-> docs/database/database-design.md
-> docs/api/api-design.md
-> docs/backend/package-structure.md
-> docs/backend/backend-development.md
~~~

新增代码必须遵守：

- 不新增 shared / support / helper / misc；
- utils 极度克制；
- 业务枚举留在业务模块；
- common 不承载业务对象；
- 没有实际职责不创建空包；
- 没有真实扩展点不创建接口 + Impl；
- 发现设计冲突先更新设计文档，不自行发明新领域模型；
- 不为了“企业级”提前引入 Redis / MQ / ES / 微服务。

---

## 14. 验收

后端实现完成后按以下顺序检查：

1. 编译与测试；
2. 数据库迁移可重放；
3. API 与 api-design.md 对齐；
4. 包结构与 package-structure.md 对齐；
5. 无旧 taxonomy / shared / support 运行时代码；
6. 无明显循环依赖；
7. Public / User / Admin 权限边界正确；
8. 并发冲突返回正确 409；
9. 公开搜索只返回 PUBLISHED 内容。
