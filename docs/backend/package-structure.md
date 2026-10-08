# 面个 Offer（Interview Vault）后端包结构与命名规范

> **版本：V1 · Public Beta**
>
> **更新时间：2026-10-07**
>
> 本文件定义后端 Java 包结构、类命名和现有代码迁移规则，是后续人工开发与 AI 编码共同遵守的工程规范。
>
> 产品规则见 [PRD](../product/prd.md)，系统边界见 [系统架构](../architecture/system-architecture.md)，数据库见 [数据库设计](../database/database-design.md)，接口见 [API 设计](../api/api-design.md)。

---

# 1. 最终决策

Interview Vault 后端保持：

> **单 Maven Module + 模块化单体 + 顶层按业务域分包 + 业务内部按技术职责分层。**

V1 不把 auth / interview / catalog / review / search 拆成多个 Maven Module。它们属于同一个 Spring Boot Server，一起启动、部署并共享 PostgreSQL；当前规模没有必要用多个 pom.xml 强行制造物理边界。

---

# 2. 顶层包

长期运行代码只使用以下六个顶层包：

~~~text
com.interviewvault
├── auth
├── interview
├── catalog
├── review
├── search
└── common
~~~

| 包 | 中文理解 | 负责什么 |
| --- | --- | --- |
| auth | 认证 / 身份 | GitHub OAuth、User、UserRole、当前用户、鉴权、会话与 CSRF |
| interview | 面经 | InterviewRecord、Round、Question、FollowUp、Source、InterviewCandidate、SubmissionSnapshot、投稿主体生命周期 |
| catalog | 标准目录 | Company、Position、Tag、PositionCategory 等正式可选数据 |
| review | 审核 / 内容治理 | ChangeRequest、InterviewRevision、发布/拒绝、修改/删除审批、管理员直接修改已发布内容 |
| search | 搜索 | 搜索、筛选、关键词解析、命中片段、搜索 SQL |
| common | 公共技术能力 | Result、全局异常、全局配置、跨模块持久化基础设施 |

## 为什么叫 catalog

dictionary 更接近固定 code → label 字典，不足以表达 Company / Position / Tag 这些独立实体；taxonomy 更强调层级分类体系，而 Company 等并不是分类树。

catalog 表示“平台维护、可查询、可选择的一组正式目录项”，与当前业务最贴合。因此正式包名固定为 catalog，不再使用 taxonomy / dictionary 作为该模块包名。

---

# 3. 业务模块内部结构

业务模块采用“模块内分层”，但没有代码时不要为了整齐创建空包。

~~~text
interview
├── controller
├── service
├── repository
├── entity
├── dto
│   ├── request
│   └── response
└── enums
~~~

## controller

只负责 HTTP 路由、参数绑定、Bean Validation、获取当前身份、调用 Service、返回 Result<T>。

禁止把复杂业务规则、事务或 SQL 写进 Controller，也禁止 Controller 直接调用 Mapper。

## service

负责业务用例、状态机、事务边界、资源所有权校验、跨 Repository / 模块编排和业务组装。

推荐具体职责名，例如：

~~~text
InterviewDetailService
InterviewSubmissionService
ChangeRequestService
CatalogQueryService
~~~

默认不创建“Service 接口 + ServiceImpl”两层。只有真正存在多个实现、SPI 或明确扩展点时才拆接口。

## repository

负责数据库访问。项目继续使用 repository 作为包名，MyBatis 类仍使用 XxxMapper 命名：

~~~text
interview/repository/InterviewRecordMapper.java
catalog/repository/CompanyMapper.java
search/repository/SearchMapper.java
~~~

不再为了形式给 Mapper 外面再包一层无意义 Repository。

## entity

只放持久化实体。Entity 不直接作为 Controller Response 返回。

## dto

API 输入输出统一使用：

~~~text
dto/request/XxxRequest
dto/response/XxxResponse
~~~

不混用 ReqVO / RspVO / DTO / VO 多套命名体系。

如果某模块 DTO 极少，可以暂时直接放 dto；数量增长后再拆 request / response。

## enums

业务枚举跟随业务模块：

~~~text
interview/enums/InterviewStatus
interview/enums/RecruitType
interview/enums/RoundType
interview/enums/QuestionType
interview/enums/InterviewDatePrecision
interview/enums/CandidateType

catalog/enums/PositionCategory

review/enums/ChangeRequestType
review/enums/ChangeRequestStatus

auth/enums/UserRole
~~~

禁止因为“都是 enum”就全部塞进 common/enums。

---

# 4. common 的边界

common 是最容易腐化的包，必须严格控制。

允许：

~~~text
common
├── config
├── exception
├── response
└── persistence
~~~

典型类：

~~~text
common/config/WebCorsConfig
common/exception/BizException
common/exception/ErrorCode
common/exception/GlobalExceptionHandler
common/response/Result
~~~

只有满足下面条件才允许进入 common：

> **不属于任何明确业务域，并且是多个模块真正共享的技术能力。**

业务模块可以依赖 common；common 不能反向依赖 auth / interview / catalog / review / search。

---

# 5. 模块依赖方向

推荐方向：

~~~text
common
  ↑
auth      catalog      interview
              ↑           ↑
              └──── review ┘
              ↑           ↑
              └──── search ┘
~~~

含义：

- auth 管身份；
- catalog 拥有 Company / Position / Tag；
- interview 拥有面经聚合，包括 InterviewCandidate 与 SubmissionSnapshot（由投稿 / 提交审核动作创建）；
- review 可以编排 auth + interview + catalog 完成审核，并拥有 ChangeRequest / InterviewRevision 等治理实体；
- search 可以读取 interview + catalog 数据；
- interview/catalog 不反向依赖 review/search；
- common 不知道任何业务。

Candidate / Snapshot 归 interview 是刻意裁决：若放 review，`interview.InterviewSubmissionService` 写候选与快照就要反向依赖 review，与依赖方向图矛盾；review 只读取与处理它们。

禁止循环依赖，例如：

~~~text
interview -> review -> interview
search -> interview -> search
common -> interview
~~~

---

# 6. 命名规范

## Package

包名必须全小写、使用完整常见英文、优先表达业务语义。

正式禁止新建：

~~~text
shared
support
helper
misc
~~~

utils 原则上也不新建。先尝试把职责说清楚，例如：

~~~text
Keywords      -> KeywordParser
Snippets      -> SnippetGenerator
Normalizers   -> SeedNormalizer
~~~

同类职责真的增长后，再形成 parser / snippet / normalizer，而不是 support 垃圾桶。

## Entity

使用单数业务名：

~~~text
InterviewRecord
InterviewRound
Question
FollowUp
InterviewSource
Company
Position
Tag
User
InterviewCandidate
SubmissionSnapshot
ChangeRequest
~~~

旧命名统一收敛：

~~~text
Interview         -> InterviewRecord
InterviewQuestion -> Question
InterviewFollowUp -> FollowUp
~~~

## Enum

枚举类名直接使用领域名，不加 Enum 后缀：

~~~text
InterviewStatus
RecruitType
RoundType
PositionCategory
UserRole
~~~

值使用大写，例如 PENDING_REVIEW、PUBLISHED、INTERN、CAMPUS。

## Controller / Service / Mapper

统一：

~~~text
XxxController
XxxService
XxxMapper
~~~

优先具体职责名，避免最终形成万能的 InterviewService / CommonService / BaseService。

## Request / Response

输入：

~~~text
InterviewUpsertRequest
InterviewSubmitRequest
ChangeRequestUpsertRequest
~~~

输出：

~~~text
InterviewDetailResponse
InterviewListResponse
InterviewRoundResponse
CompanySummaryResponse
SearchMatchResponse
~~~

避免 DetailResponse / ListItem / ListResponse / Info / Ref / Dates 这类脱离上下文难以理解的名字。

## 时间字段

Java：

~~~text
createTime
updateTime
publishTime
reviewTime
interviewDate
~~~

数据库：

~~~text
create_time
update_time
publish_time
review_time
interview_date
~~~

时间点用 Time，自然日期用 Date。

---

# 7. 不做的“规范化”

V1 不做：

- DDD 的 domain / application / infrastructure / adapter 四层；
- 每个 Service 强制 interface + impl；
- 每个业务拆 Maven Module；
- BaseController / BaseService / BaseRepository 大继承体系；
- 为一个类创建一个抽象层；
- 所有 Entity 强制配 Converter 接口；
- 为“以后可能用”提前创建空 package。

原则：**先有真实职责，再有抽象。**

---

# 8. 当前代码迁移表

V1 包重组（shared → common、taxonomy → catalog、旧 interview 拆分等）已完成。
新类怎么放看第 9、10 节。

---

# 9. Public Beta 新模块落位

auth / review 等模块已按本规范落位并合并 main；本节保留为模块职责与位置的定义。

## auth

~~~text
auth
├── controller/AuthController
├── service/AuthService
├── repository/UserMapper
├── entity/User
├── dto/response/CurrentUserResponse
├── enums/UserRole
└── config/...       # 认证专属配置
~~~

GitHub OAuth / Security 的认证业务配置优先放 auth；真正全局 Web 配置才放 common/config。

## review

~~~text
review
├── controller
├── service
├── repository
├── entity
│   ├── ChangeRequest
│   └── InterviewRevision
├── dto
│   ├── request
│   └── response
└── enums
    ├── ChangeRequestType
    └── ChangeRequestStatus
~~~

review 负责审核和内容治理，不等同于“管理员页面”。InterviewCandidate / SubmissionSnapshot 不在 review——它们归 interview，由投稿动作创建；review 只读取与处理。InterviewRevision 归 review，因为它是管理员治理动作的审计。

---

# 10. 新类放哪：五步判断

1. 先判断业务：身份 → auth；面经主体 / Candidate / SubmissionSnapshot → interview；公司/岗位/标签 → catalog；审核 / ChangeRequest / InterviewRevision → review；搜索 → search。
2. 如果完全不属于具体业务、且多个模块共享技术能力，才进 common。
3. 再判断技术角色：HTTP → controller；业务用例 → service；DB → repository；持久化对象 → entity；API 输入输出 → dto；业务枚举 → enums。
4. 准备放 support / helper / shared / utils 时先停止，用 Parser / Generator / Normalizer / Converter 等真实职责重新命名。
5. 没有两个以上真实使用方或变化点，不提前抽象。

---

# 11. Code Review 检查项

每次涉及后端结构的新 PR 至少检查：

- 是否新增未经允许的顶层包；
- 是否把业务类放进 common；
- 是否出现新的 shared / support / helper / misc；
- 是否出现无理由的 XxxService + XxxServiceImpl；
- Entity 是否直接暴露给 Controller；
- Request / Response 是否语义明确；
- 是否发生跨模块循环依赖；
- enum 是否回归所属业务；
- Mapper 是否放在 repository；
- 类名是否需要打开源码才能猜出职责。

---

# 12. 目标结构快照

完成 Public Beta 核心实现后，主代码大致应呈现：

~~~text
com.interviewvault
├── InterviewVaultApplication.java
├── auth
│   ├── controller
│   ├── service
│   ├── repository
│   ├── entity
│   ├── dto
│   ├── enums
│   └── config
├── interview
│   ├── controller
│   ├── service
│   ├── repository
│   ├── entity
│   ├── dto
│   │   ├── request
│   │   └── response
│   └── enums
├── catalog
│   ├── controller
│   ├── service
│   ├── repository
│   ├── entity
│   ├── dto
│   └── enums
├── review
│   ├── controller
│   ├── service
│   ├── repository
│   ├── entity
│   ├── dto
│   └── enums
├── search
│   ├── controller
│   ├── service
│   ├── repository
│   ├── dto
│   ├── parser
│   └── snippet
└── common
    ├── config
    ├── exception
    ├── response
    └── persistence
~~~

这是一张方向图，不是空目录创建清单。
