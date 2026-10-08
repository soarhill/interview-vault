# 面个 Offer（Interview Vault）API 设计

> **版本：V1 · Public Beta**
>
> **更新时间：2026-10-07**
>
> 本文件是 V1 API 的设计基线。产品规则见 [PRD](../product/prd.md)，领域模型与状态流见 [系统架构](../architecture/system-architecture.md)，数据库约束见 [数据库设计](../database/database-design.md)。
>
> 编码阶段使用 springdoc 生成 OpenAPI；实现若与本文冲突，应先更新设计文档再修改实现。

---

# 1. 设计原则

1. Base URL 统一为 `/api/v1`。
2. 请求与响应使用 UTF-8 JSON，字段使用 camelCase。
3. 项目统一使用 `Result<T>` 作为响应包装。
4. HTTP Status 仍表达真实协议语义，不能因为使用 Result 就所有请求都返回 200。
5. CRUD 使用资源语义；提交审核、发布、拒绝等状态迁移使用显式业务动作接口。
6. DTO 不等于数据库 Entity，不直接暴露数据库结构。
7. `InterviewRecord` 是投稿聚合根；投稿页保存整份聚合，不拆成大量 Round / Question / FollowUp 细碎写接口。
8. 草稿保存允许不完整；提交审核时才执行完整业务校验。
9. 公开 API 与 `/me/**`、`/admin/**` 权限边界明确。
10. 并发控制优先使用数据库状态条件更新 + version 乐观锁 + UNIQUE 约束，不引入 Redis 分布式锁。
11. V1 不建设通用 Idempotency-Key 机制；状态机与唯一约束已经可以覆盖当前重复请求问题。

---

# 2. 统一响应

## 2.1 Result<T>

Java 逻辑模型：

```java
public class Result<T> {
    private String code;
    private String message;
    private T data;
}
```

成功示例：

```json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 1001
  }
}
```

错误示例：

```json
{
  "code": "INTERVIEW_STATUS_CONFLICT",
  "message": "当前面经状态已发生变化，请刷新后重试",
  "data": null
}
```

列表响应的分页信息放在 data 内：

```json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "items": [],
    "page": 1,
    "size": 20,
    "total": 126
  }
}
```

---

## 2.2 HTTP Status

| HTTP | 语义 |
| --- | --- |
| 200 | 查询 / 修改 / 业务动作成功 |
| 201 | 创建成功 |
| 400 | 请求参数格式非法 |
| 401 | 未登录 |
| 403 | 已登录但无接口或资源权限 |
| 404 | 资源不存在 |
| 409 | 当前业务状态、版本或唯一性发生冲突 |
| 413 | 请求体超过大小上限 |
| 429 | 触发限流 |
| 500 | 未预期服务端异常 |

典型区别：

- 游客调用 `/me/**`：401。
- 普通 USER 调用 `/admin/**`：403。
- 修改别人的草稿：403。
- 已发布面经再次 submit：409。
- 管理员基于旧 version 发布：409。

---

# 3. 业务错误码

V1 只定义真正有业务语义的错误码。

```text
VALIDATION_ERROR
AUTH_REQUIRED
ACCESS_DENIED

INTERVIEW_NOT_FOUND
INTERVIEW_REMOVED
INTERVIEW_NOT_OWNER
INTERVIEW_INCOMPLETE
INTERVIEW_STATUS_CONFLICT
INTERVIEW_VERSION_CONFLICT

COMPANY_NOT_FOUND
POSITION_NOT_FOUND
TAG_NOT_FOUND
DUPLICATE_NORMALIZED_NAME

CANDIDATE_NOT_FOUND
CANDIDATE_ALREADY_RESOLVED
CANDIDATE_NOT_RESOLVED

CHANGE_REQUEST_NOT_FOUND
CHANGE_REQUEST_CONFLICT

CHEER_RATE_LIMITED
PAYLOAD_TOO_LARGE

INTERNAL_ERROR
```

来源 URL 疑似重复不是失败，不使用 409 阻止用户提交，而是 Warning：

```json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 1001,
    "warnings": [
      {
        "code": "SOURCE_URL_DUPLICATE_SUSPECTED",
        "message": "该来源链接已有相关面经，请确认是否为同一份内容"
      }
    ]
  }
}
```

相似问题不属于重复面经判断条件。

---

# 4. 权限模型

V1 三种访问身份：

```text
ANONYMOUS
USER
ADMIN
```

接口级权限：

```text
公开 GET API       permitAll
/api/v1/me/**      authenticated
/api/v1/admin/**   hasRole("ADMIN")
```

接口级权限之外，Service 还必须做资源级权限校验。

例如：

```http
PUT /api/v1/me/interviews/1001
```

不能只检查“已登录”，还必须检查：

```text
interview.authorId == currentUser.id
```

因此：

> Spring Security 解决“你是什么身份”，Service 解决“这条具体数据是不是你的、当前状态能不能操作”。

---

# 5. Public API

## 5.1 面经列表 / 搜索

```http
GET /api/v1/interviews
```

Query：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| companyId | long | 公司 ID，可空 |
| positionCategory | string | 岗位方向目录 ID 字符串，可空 |
| recruitType | string | INTERN / CAMPUS，可空 |
| q | string | 关键词，可空 |
| page | int | 从 1 开始 |
| size | int | 默认 20，最大值由实现统一限制 |

示例：

```http
GET /api/v1/interviews?companyId=1&positionCategory=4&recruitType=CAMPUS&q=Redis%20分布式锁&page=1&size=20
```

搜索、筛选都属于“在面经集合上查询”，V1 不拆独立 `/search` 接口。

响应 DTO：

```json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1001,
        "company": {
          "id": 1,
          "name": "字节跳动"
        },
        "department": "抖音电商",
        "position": {
          "id": 12,
          "name": "Java 后端开发",
          "category": "后端开发"
        },
        "recruitType": "CAMPUS",
        "firstInterviewDate": "2026-09-20",
        "firstInterviewDatePrecision": "DAY",
        "rounds": ["一面", "二面", "HR 面"],
        "tags": ["Redis", "MySQL"],
        "matches": [
          {
            "questionId": 8821,
            "followUpId": null,
            "roundName": "一面",
            "kind": "QUESTION",
            "snippet": "Redis 分布式锁怎么实现？"
          }
        ]
      }
    ],
    "page": 1,
    "size": 20,
    "total": 126
  }
}
```

`firstInterviewDate` 是 API DTO 计算字段，由 Round 中最早已确认日期计算，不要求 interview_record 存冗余字段；同时返回 `firstInterviewDatePrecision`（DAY / MONTH / YEAR），避免把月级 / 年级历史日期误展示成某个具体日。`department` 可为 null。

### matches.kind 契约

```text
kind 值      questionId    followUpId    含义
QUESTION     有值          null          命中主问题
FOLLOW_UP    有值          有值          命中追问（followUpId 为命中的那条追问，questionId 为其主问题）
META         null          null          仅命中公司 / 岗位 / 标签等元信息，不生成问题定位
```

搜索定位 URL 使用稳定 ID，不使用数组下标：

```text
/interview/{id}?q={keyword}&followUpId={followUpId}#question-{questionId}
```

- kind = QUESTION：`#question-{questionId}` 定位到主问题；
- kind = FOLLOW_UP：定位到对应主问题下的追问；
- kind = META：不携带问题锚点。

---

## 5.2 面经详情

```http
GET /api/v1/interviews/{id}
```

只返回 `PUBLISHED` 的公开面经，不把其他用户草稿暴露出去。

下架与不存在的区别（协议都是 404，错误码与产品文案不同）：

```text
status = REMOVED  -> HTTP 404 + code = INTERVIEW_REMOVED   （前端展示“该面经已下架”）
id 不存在         -> HTTP 404 + code = INTERVIEW_NOT_FOUND（前端展示“面经不存在”）
```

逻辑响应：

```json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 1001,
    "company": {
      "id": 1,
      "name": "字节跳动"
    },
    "department": "抖音电商",
    "position": {
      "id": 12,
      "name": "Java 后端开发",
      "category": "后端开发"
    },
    "recruitType": "CAMPUS",
    "tags": [
      {
        "id": 3,
        "name": "Redis"
      }
    ],
    "firstInterviewDate": "2026-09-20",
    "firstInterviewDatePrecision": "DAY",
    "originalPositionName": "后端开发实习生",
    "inferredPositionName": null,
    "note": "真实面试时间以原记录为准",
    "rounds": [
      {
        "id": 201,
        "roundType": "TECHNICAL",
        "roundNo": 1,
        "displayName": "一面",
        "remark": null,
        "interviewDate": "2026-09-20",
        "interviewDatePrecision": "DAY",
        "questions": [
          {
            "id": 3001,
            "content": "Redis 分布式锁怎么实现？",
            "referenceUrl": null,
            "questionType": "NORMAL",
            "followUps": [
              {
                "id": 4001,
                "content": "锁过期怎么办？"
              }
            ]
          }
        ]
      }
    ],
    "sources": [
      {
        "id": 5001,
        "url": "https://example.com/interview"
      }
    ]
  }
}
```

Response 可以返回 `displayName`，避免前端在多个页面重复实现 TECHNICAL + roundNo + remark 的展示规则；同时保留原始字段供前端逻辑使用。

---

## 5.3 公司

~~~http
GET /api/v1/companies
GET /api/v1/companies?q=字节
~~~

只返回正式 Company。响应结构固定为：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "字节跳动"
      }
    ]
  }
}
~~~

该接口用于投稿选择器、管理员目录选择器等“查正式目录”场景，不承担首页筛选计数。

---

## 5.4 岗位

~~~http
GET /api/v1/positions
GET /api/v1/positions?q=Java
GET /api/v1/positions?categoryId=4
~~~

只返回正式 Position：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 12,
        "name": "Java 后端开发",
        "category": "后端开发"
      }
    ]
  }
}
~~~

---

## 5.5 标签

~~~http
GET /api/v1/tags
GET /api/v1/tags?q=Redis
~~~

只返回正式 Tag：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 3,
        "name": "Redis"
      }
    ]
  }
}
~~~

普通用户不能直接 POST 正式 Catalog 数据；新值通过投稿 Candidate 流程提出。

---

## 5.6 首页筛选选项与联动计数

首页筛选计数不塞进 Catalog 接口，单独提供面经查询维度接口：

~~~http
GET /api/v1/interview-filters
GET /api/v1/interview-filters?companyId=1&positionCategory=4&recruitType=CAMPUS&q=Redis
~~~

响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "total": 18,
    "companies": [
      {
        "id": 1,
        "name": "字节跳动",
        "count": 12
      },
      {
        "id": 2,
        "name": "腾讯",
        "count": 7
      }
    ],
    "positionCategories": [
      {
        "value": "2",
        "label": "后端开发",
        "count": 15
      },
      {
        "value": "1",
        "label": "Agent 开发",
        "count": 3
      }
    ],
    "recruitTypes": [
      {
        "value": "INTERN",
        "label": "实习",
        "count": 5
      },
      {
        "value": "CAMPUS",
        "label": "校招",
        "count": 13
      }
    ]
  }
}
~~~

联动计数使用 faceted search 语义：

- total 应用当前所有筛选条件；
- companies 计算 count 时忽略当前 companyId，但保留 positionCategory / recruitType / q；
- positionCategories 计算 count 时忽略当前 positionCategory，但保留 companyId / recruitType / q；
- recruitTypes 计算 count 时忽略当前 recruitType，但保留 companyId / positionCategory / q；
- q 始终参与计数；
- V1 首页不提供 Tag 筛选，因此 Tag 不进入联动计数；GET /tags 只服务投稿 / 管理员目录选择。

这样前端不需要自己用列表结果猜计数，也不需要并发调用一组 Company / Position 查询拼出筛选面板。

---

## 5.7 页尾祝福「接受祝福」

面经列表页尾的轻互动：一句祝福 + 「接受祝福」按钮 + 累计人数。产品配套能力，不新增独立业务模块（V1 归 interview）。

```http
GET /api/v1/cheers
```

```json
{ "code": "SUCCESS", "message": "success", "data": { "count": 1284 } }
```

```http
POST /api/v1/cheers
```

成功返回自增后的总数：

```json
{ "code": "SUCCESS", "message": "success", "data": { "count": 1285 } }
```

规则：

- 两个接口均公开（游客可点；POST 走 CSRF）。
- 「每人一次」：登录用户由数据库唯一约束保证（重复 POST 幂等返回当前总数，不报错）；游客由前端 localStorage 防重复 + 服务端按 IP 限流（10 分钟窗口最多 5 次，超限返回 429 CHEER_RATE_LIMITED），V1 不做匿名指纹——这是彩蛋级数据，不是严谨投票。
- 前端展示文案：「已有 N 人接受了这份祝福」（人数常驻展示）；点击前按钮为「接受祝福」，点击后变「已接受 ✓」并 +1。

---

# 6. GitHub OAuth

## 6.1 开始登录

```http
GET /api/v1/auth/github
```

负责发起 GitHub OAuth。

## 6.2 OAuth 回调

```http
GET /api/v1/auth/github/callback
```

后端使用 GitHub 稳定 `githubId` 识别本站用户。

首次授权：

```text
GitHub OAuth 成功
-> 根据 githubId 查询
-> 不存在则创建 app_user
-> 建立本站登录态
```

## 6.3 当前用户

```http
GET /api/v1/auth/me
```

示例：

```json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 100,
    "githubLogin": "soarhill",
    "avatarUrl": "https://...",
    "role": "USER"
  }
}
```

## 6.4 退出

```http
POST /api/v1/auth/logout
```

V1 只申请完成身份认证需要的最小 GitHub 权限，不长期保存 Access Token。

## 6.5 CSRF Token

```http
GET /api/v1/auth/csrf
```

用于前端初始化或登录态变化后获取 / 刷新 CSRF Token。后端使用 Spring Security 的 `CookieCsrfTokenRepository`：

```text
Session Cookie   JSESSIONID（HttpOnly；生产 Secure；SameSite=Lax）
CSRF Cookie      XSRF-TOKEN（允许前端读取；生产 Secure；SameSite=Lax）
CSRF Header      X-XSRF-TOKEN
Fetch            credentials: include
```

写请求（POST / PUT / DELETE）统一携带 `X-XSRF-TOKEN`。本地前后端分端口开发时，后端 CORS 只放行明确的前端 Origin，并开启 credentials；生产环境通过 Nginx 同源访问 `/api`。

## 6.6 会话与安全

V1 登录态决策：

```text
登录态       服务器 HttpSession，不使用 JWT
OAuth state  由 Spring Security 生成并校验，防 OAuth CSRF
Session 存储 Spring Session JDBC（PostgreSQL spring_session 表）；空闲 7 天过期，
             进程重启不掉登录态
```

不引入 Redis 或独立 Session 服务；出现多实例部署需求时再演进。

管理员撤权：`/api/v1/admin/**` 的授权在**每个请求**上按当前 `ADMIN_GITHUB_IDS`
白名单复核主体 GitHub 数字 ID。白名单移除某人并重新部署后，其既有 Session 里的
ROLE_ADMIN 立即失效（不需要等会话过期）；白名单为空时登录不会产生 ADMIN。

## 6.7 首个管理员引导

OAuth 自动创建的用户默认 `USER`。首个 ADMIN 通过部署环境变量引导：

```text
ADMIN_GITHUB_IDS=<githubId1>,<githubId2>
```

OAuth 建户或登录时，`githubId` 命中白名单则 `role = ADMIN`，否则 `USER`。数据库仍保存 `app_user.role`；V1 不建设管理员管理界面或 RBAC。已登录管理员会话的撤权见 6.6——请求期按白名单复核，撤权即时生效。

---

# 7. 投稿 API

## 7.1 创建草稿

```http
POST /api/v1/me/interviews
```

返回：

```json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 1001,
    "status": "DRAFT",
    "version": 0,
    "updateTime": "2026-10-06T10:00:00+08:00",
    "warnings": []
  }
}
```

HTTP 201。

---

## 7.2 获取自己的投稿

列表：

~~~http
GET /api/v1/me/interviews
GET /api/v1/me/interviews?status=PENDING_REVIEW&page=1&size=20
~~~

状态筛选允许 DRAFT / PENDING_REVIEW / REJECTED / PUBLISHED；不传表示全部。

列表响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1001,
        "company": {
          "id": 1,
          "name": "字节跳动",
          "source": "OFFICIAL"
        },
        "department": "抖音电商",
        "position": {
          "id": null,
          "name": "Agent Infra Engineer",
          "source": "PROPOSED",
          "category": null
        },
        "recruitType": "CAMPUS",
        "status": "REJECTED",
        "version": 8,
        "rejectionReason": "来源无法确认，请补充可验证来源",
        "firstInterviewDate": "2026-09-20",
        "firstInterviewDatePrecision": "DAY",
        "roundCount": 2,
        "questionCount": 18,
        "hasPendingChangeRequest": false,
        "createTime": "2026-10-01T10:00:00+08:00",
        "updateTime": "2026-10-05T21:30:00+08:00",
        "actions": {
          "canEdit": true,
          "canSubmit": false,
          "canDeleteDraft": false,
          "canRequestChange": false,
          "canRequestDelete": false
        }
      }
    ],
    "page": 1,
    "size": 20,
    "total": 6
  }
}
~~~

company / position 使用统一 CatalogSelectionView：

~~~text
id      正式目录 ID；候选值时为 null
name    页面直接展示的名称
source  OFFICIAL / PROPOSED
category 仅 Position 使用；候选岗位可为 null
~~~

这样前端不需要自己把 InterviewCandidate 和正式 Catalog 数据拼成展示名称。

详情：

~~~http
GET /api/v1/me/interviews/{id}
~~~

响应直接给投稿编辑页所需完整基线：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 1001,
    "status": "DRAFT",
    "version": 9,
    "rejectionReason": null,
    "company": {
      "id": 1,
      "name": "字节跳动",
      "source": "OFFICIAL"
    },
    "position": {
      "id": null,
      "name": "Agent Infra Engineer",
      "source": "PROPOSED",
      "category": null
    },
    "department": "抖音电商",
    "recruitType": "CAMPUS",
    "tags": [
      {
        "id": 3,
        "name": "Redis",
        "source": "OFFICIAL"
      },
      {
        "id": null,
        "name": "Agent Memory",
        "source": "PROPOSED"
      }
    ],
    "rounds": [
      {
        "id": 201,
        "roundType": "TECHNICAL",
        "roundNo": 1,
        "displayName": "一面",
        "remark": null,
        "interviewDate": "2026-09-20",
        "interviewDatePrecision": "DAY",
        "questions": [
          {
            "id": 3001,
            "content": "Redis 分布式锁怎么实现？",
            "referenceUrl": null,
            "questionType": "NORMAL",
            "sectionLabel": "Redis",
            "contextNote": null,
            "algorithmTitle": null,
            "algorithmDescription": null,
            "algorithmRequirements": null,
            "leetcodeNumber": null,
            "leetcodeUrl": null,
            "followUps": [
              {
                "id": 4001,
                "content": "锁过期怎么办？"
              }
            ]
          }
        ]
      }
    ],
    "sourceUrl": "https://example.com/interview",
    "createTime": "2026-10-01T10:00:00+08:00",
    "updateTime": "2026-10-05T21:30:00+08:00",
    "actions": {
      "canEdit": true,
      "canSubmit": true,
      "canDeleteDraft": true,
      "canRequestChange": false,
      "canRequestDelete": false
    }
  }
}
~~~

actions 是后端按状态、所有权和“是否曾进入审核历史”计算出来的能力，不允许前端只根据 status 猜。

尤其：

~~~text
status = DRAFT
不等于
canDeleteDraft = true
~~~

被拒后编辑回 DRAFT 的投稿已有 SubmissionSnapshot，canDeleteDraft 必须为 false。

该接口可以读取自己的 DRAFT / PENDING_REVIEW / REJECTED / PUBLISHED，不等于公开详情接口。

---

## 7.3 保存整份草稿 / 待审核投稿

```http
PUT /api/v1/me/interviews/{id}
```

投稿页以 InterviewRecord 为聚合根，一次提交完整当前表单，不设计大量细碎的 Round / Question / FollowUp 写接口。

核心请求：

```json
{
  "version": 7,
  "company": {
    "existingId": 1
  },
  "position": {
    "proposedName": "Agent Infra Engineer"
  },
  "department": "抖音电商",
  "recruitType": "CAMPUS",
  "tagIds": [3, 7],
  "proposedTags": ["Agent Memory"],
  "rounds": [
    {
      "roundType": "TECHNICAL",
      "roundNo": 1,
      "interviewDate": "2026-09-20",
      "questions": [
        {
          "content": "Redis 分布式锁怎么实现？",
          "followUps": [
            {
              "content": "锁过期怎么办？"
            }
          ]
        }
      ]
    }
  ],
  "sourceUrl": "https://example.com/interview"
}
```

### SelectionInput

Company / Position 使用：

```text
existingId
proposedName
```

规则：二选一；草稿阶段也允许二者都暂时为空。

正式提交审核时必须满足业务完整性。

Tag 因为是多选，分为：

```text
tagIds
proposedTags
```

### sortOrder

前端不传 `sortOrder`。

数组顺序就是业务顺序：

```text
rounds[0]      -> sortOrder = 1
questions[0]   -> sortOrder = 1
followUps[0]   -> sortOrder = 1
```

这样避免“数组位置”和“sortOrder 字段”互相冲突。

### 保存动作对状态的影响

```text
当前 DRAFT          -> 保存后仍为 DRAFT
当前 PENDING_REVIEW -> 保存后仍为 PENDING_REVIEW（内容与 version 更新，审核端始终看到最新版本）
当前 REJECTED       -> 保存后回到 DRAFT（清空 rejectionReason，重新进入作者编辑阶段）
当前 REMOVED        -> 保存后回到 DRAFT（已下架内容可由作者编辑复活，重新走投稿审核）
```

作者不能通过 PUT 修改 `PUBLISHED` 记录；已发布内容的修改走 ChangeRequest。
唯一例外是 `REMOVED`：作者编辑保存即复活为草稿，重新提交审核后可再次公开。

`department` 为可选自由文本（能确认部门时填写），草稿阶段允许为空。

---

## 7.4 保存草稿的校验

草稿允许不完整。

基础格式校验包括：

- ID 必须是合法数字；
- proposedName trim 后不能是纯空白；
- proposedTags 忽略大小写后不能自重复；
- sourceUrl 有值时必须是 HTTP/HTTPS URL；
- department 有值时 trim 后不能是纯空白；
- roundType 必须是允许值；
- TECHNICAL 的 roundNo 必须 1～5；
- HR 的 roundNo 必须为空；
- 同一份数据不能出现两个相同技术轮次；
- tagIds 不能包含重复值；
- 长度 / 数量上限见 12.2「输入上限」，全部在服务端强制执行。

不要为了方便在 DTO 上把所有字段都加 `@NotNull / @NotEmpty`，否则 DRAFT 无法正常工作。

## 7.5 删除纯草稿

```http
DELETE /api/v1/me/interviews/{id}
```

只允许删除**纯草稿**：

```text
status = DRAFT
AND 从未创建过 SubmissionSnapshot（从未提交过审核）
```

满足条件时物理删除并级联清理聚合数据，返回 200。

不满足条件（已提交过、被拒后回到 DRAFT、已发布等）返回：

```text
HTTP 409 + INTERVIEW_STATUS_CONFLICT
```

进入过平台审核历史的记录不可物理抹除审计链。

---

# 8. 提交审核

```http
POST /api/v1/me/interviews/{id}/submit
```

请求至少携带当前 version：

```json
{
  "version": 8
}
```

Service 事务内：

```text
1. 校验登录人与 authorId
2. 校验状态允许提交（当前状态 = DRAFT；REJECTED 投稿需先编辑保存回到 DRAFT）
3. 校验当前 version
4. 执行完整性业务校验
5. 保存 SubmissionSnapshot
6. DRAFT -> PENDING_REVIEW
7. version + 1
8. 提交事务
```

完整性校验至少包括：

- Company 已选择正式值或合法 Candidate；
- Position 已选择正式值或合法 Candidate；
- RecruitType 已填写；
- 至少一个有效 Round；
- 至少存在一个有效问题；
- Question.content 非空；
- FollowUp 存在时 content 非空。

Candidate 可以在 PENDING_REVIEW 中存在，管理员审核时解决；只有最终 PUBLISH 前要求全部 Candidate 已处理完成。

---

# 9. 管理员审核投稿

## 9.1 待审核列表

~~~http
GET /api/v1/admin/reviews/interviews
GET /api/v1/admin/reviews/interviews?status=PENDING_REVIEW&page=1&size=20
~~~

响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1001,
        "company": {
          "id": 1,
          "name": "字节跳动",
          "source": "OFFICIAL"
        },
        "position": {
          "id": null,
          "name": "Agent Infra Engineer",
          "source": "PROPOSED",
          "category": null
        },
        "author": {
          "id": 100,
          "githubLogin": "soarhill",
          "avatarUrl": "https://..."
        },
        "status": "PENDING_REVIEW",
        "version": 11,
        "candidateCount": 2,
        "submitTime": "2026-10-05T20:00:00+08:00",
        "updateTime": "2026-10-05T20:10:00+08:00"
      }
    ],
    "page": 1,
    "size": 20,
    "total": 9
  }
}
~~~

submitTime 取当前审核周期最近一次 SubmissionSnapshot.createTime。

---

## 9.2 审核详情

~~~http
GET /api/v1/admin/reviews/interviews/{id}
~~~

响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "interview": {
      "id": 1001,
      "status": "PENDING_REVIEW",
      "version": 11,
      "company": {
        "id": 1,
        "name": "字节跳动",
        "source": "OFFICIAL"
      },
      "position": {
        "id": null,
        "name": "Agent Infra Engineer",
        "source": "PROPOSED",
        "category": null
      },
      "department": "抖音电商",
      "recruitType": "CAMPUS",
      "tags": [
        {
          "id": 3,
          "name": "Redis",
          "source": "OFFICIAL"
        },
        {
          "id": null,
          "name": "Agent Memory",
          "source": "PROPOSED"
        }
      ],
      "rounds": [
        {
          "id": 201,
          "roundType": "TECHNICAL",
          "roundNo": 1,
          "displayName": "一面",
          "remark": null,
          "interviewDate": "2026-09-20",
          "interviewDatePrecision": "DAY",
          "questions": [
            {
              "id": 3001,
              "content": "Redis 分布式锁怎么实现？",
              "referenceUrl": null,
              "questionType": "NORMAL",
              "sectionLabel": "Redis",
              "contextNote": null,
              "algorithmTitle": null,
              "algorithmDescription": null,
              "algorithmRequirements": null,
              "leetcodeNumber": null,
              "leetcodeUrl": null,
              "followUps": [
                {
                  "id": 4001,
                  "content": "锁过期怎么办？"
                }
              ]
            }
          ]
        }
      ],
      "sourceUrl": "https://example.com/interview",
      "createTime": "2026-10-01T10:00:00+08:00",
      "updateTime": "2026-10-05T20:10:00+08:00"
    },
    "author": {
      "id": 100,
      "githubLogin": "soarhill",
      "avatarUrl": "https://..."
    },
    "candidates": [
      {
        "id": 901,
        "type": "TAG",
        "value": "Java多线程锁",
        "suggestedMatches": [
          {
            "id": 12,
            "name": "JUC"
          }
        ]
      }
    ],
    "submissionSnapshot": {
      "id": 7001,
      "createTime": "2026-10-05T20:00:00+08:00",
      "content": {
        "company": {
          "existingId": 1,
          "proposedName": null
        },
        "position": {
          "existingId": null,
          "proposedName": "Agent Infra Engineer"
        },
        "department": "抖音电商",
        "recruitType": "CAMPUS",
        "tagIds": [3],
        "proposedTags": ["Agent Memory"],
        "rounds": [],
        "sourceUrl": "https://example.com/interview"
      }
    }
  }
}
~~~

submissionSnapshot.content 是 JSONB payload 反序列化后的对象，不把 JSON 字符串再塞给前端。审核页默认展示当前 interview，同时提供 Snapshot 用于“原始投稿 vs 当前审核内容”追溯。

若一份投稿多次 submit，submissionSnapshot 返回当前审核周期最近一次提交产生的快照；历史快照不在 V1 审核页面展开。

---

## 9.3 管理员编辑审核内容

~~~http
PUT /api/v1/admin/reviews/interviews/{id}
~~~

管理员可以修改最终公开内容的全部普通投稿字段，请求使用第 12 章定义的 InterviewUpsertRequest，并必须带当前 version。

如果提交期间作者已经更新内容，version 不一致：

- HTTP 409
- INTERVIEW_VERSION_CONFLICT
- 管理员刷新后重新审核

成功响应使用 InterviewSaveResponse，返回保存后的 canonical interview（含新 version 与新建子项真实 id），不能只返回 SUCCESS。

---

## 9.4 处理 Candidate

```http
POST /api/v1/admin/reviews/interviews/{id}/candidates/{candidateId}/resolve
```

使用已有：

```json
{
  "version": 11,
  "action": "USE_EXISTING",
  "targetId": 25
}
```

创建新正式项：

```json
{
  "version": 11,
  "action": "CREATE_NEW",
  "name": "OpenAI"
}
```

删除不合理 Tag 候选：

```json
{
  "version": 11,
  "action": "REMOVE"
}
```

Company / Position 不允许通过 REMOVE 把“必填语义”静默删除；管理员应改为已有项或创建正式项。

Candidate 处理成功后从当前候选集合移除，并使 `InterviewRecord.version + 1`。请求中的 `version` 必须等于当前审核版本；作者或管理员已修改内容时返回 `409 INTERVIEW_VERSION_CONFLICT`。成功响应返回新的 version，后续 Candidate resolve / publish 必须继续使用新 version。

如果两个管理员重复处理同一个 Candidate，第二次操作根据实际先后返回 `INTERVIEW_VERSION_CONFLICT` 或 `CANDIDATE_ALREADY_RESOLVED`，但绝不能静默成功。

---

## 9.5 发布

```http
POST /api/v1/admin/reviews/interviews/{id}/publish
```

请求：

```json
{
  "version": 11
}
```

Service 必须检查：

- 当前状态 = PENDING_REVIEW；
- version 与管理员打开审核页时一致；
- Company 已确定；
- Position 已确定；
- RecruitType 已确定；
- Candidate 已全部处理；
- Round / Question 结构合法。

成功：

```text
PENDING_REVIEW -> PUBLISHED
publishTime = now
version + 1
```

---

## 9.6 拒绝

```http
POST /api/v1/admin/reviews/interviews/{id}/reject
```

请求：

```json
{
  "version": 11,
  "reason": "来源无法确认，请补充可验证来源"
}
```

成功：

```text
PENDING_REVIEW -> REJECTED
rejectionReason = reason
version + 1
```

用户在“我的投稿”中可以看到拒绝原因。

作者编辑保存被拒投稿（状态回到 DRAFT）时，`rejectionReason` 即被清空；下一次拒绝结果重新写入。

---

## 9.7 管理员读取 / 直接修改已发布面经

管理员进入“直接编辑已发布内容”页面时，不能拿公开详情接口猜编辑基线，使用专用读取接口：

~~~http
GET /api/v1/admin/interviews/{id}
~~~

仅用于 PUBLISHED 面经。响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "interview": {
      "id": 1001,
      "status": "PUBLISHED",
      "version": 15,
      "company": {
        "id": 1,
        "name": "字节跳动"
      },
      "department": "抖音电商",
      "position": {
        "id": 12,
        "name": "Java 后端开发",
        "category": "后端开发"
      },
      "recruitType": "CAMPUS",
      "tags": [
        {
          "id": 3,
          "name": "Redis"
        }
      ],
      "originalPositionName": "后端开发实习生",
      "inferredPositionName": null,
      "note": "真实面试时间以原记录为准",
      "rounds": [
        {
          "id": 201,
          "roundType": "TECHNICAL",
          "roundNo": 1,
          "displayName": "一面",
          "remark": null,
          "interviewDate": "2026-09-20",
          "interviewDatePrecision": "DAY",
          "questions": [
            {
              "id": 3001,
              "content": "Redis 分布式锁怎么实现？",
              "referenceUrl": null,
              "questionType": "NORMAL",
              "sectionLabel": "Redis",
              "contextNote": null,
              "algorithmTitle": null,
              "algorithmDescription": null,
              "algorithmRequirements": null,
              "leetcodeNumber": null,
              "leetcodeUrl": null,
              "followUps": [
                {
                  "id": 4001,
                  "content": "锁过期怎么办？"
                }
              ]
            }
          ]
        }
      ],
      "sources": [
        {
          "id": 5001,
          "url": "https://example.com/interview-a"
        },
        {
          "id": 5002,
          "url": "https://example.com/interview-b"
        }
      ],
      "updateTime": "2026-10-05T20:10:00+08:00"
    },
    "pendingChangeRequest": null,
    "actions": {
      "canEditDirectly": true
    }
  }
}
~~~

如果存在 PENDING ChangeRequest，读取仍返回 200，但：

~~~json
{
  "pendingChangeRequest": {
    "id": 8801,
    "type": "UPDATE",
    "baseVersion": 15,
    "updateTime": "2026-10-06T09:20:00+08:00"
  },
  "actions": {
    "canEditDirectly": false
  }
}
~~~

前端据此禁用保存并引导管理员先处理申请；即使前端未禁用，PUT 仍由后端返回 409 CHANGE_REQUEST_CONFLICT。

直接修改：

~~~http
PUT /api/v1/admin/interviews/{id}
~~~

管理员编辑 PUBLISHED 时使用 AdminPublishedInterviewUpdateRequest：

~~~json
{
  "version": 15,
  "company": {
    "existingId": 1
  },
  "position": {
    "existingId": 12
  },
  "department": "抖音电商",
  "recruitType": "CAMPUS",
  "tagIds": [3, 7],
  "proposedTags": [],
  "rounds": [],
  "sourceUrls": [
    "https://example.com/interview-a",
    "https://example.com/interview-b"
  ]
}
~~~

与普通用户投稿不同：

- PUBLISHED 面经不得创建 InterviewCandidate；
- company / position 仍使用 SelectionInput；若管理员传 proposedName，则后端在该治理事务中直接创建或复用正式 Catalog，不落 Candidate；
- Tag 使用 tagIds + proposedTags；proposedTags 在管理员治理事务中直接创建或复用正式 Tag，不落 Candidate；
- sourceUrls 是完整来源 URL 列表，用于安全编辑多来源记录；
- originalPositionName / inferredPositionName 是治理只读字段，普通治理编辑不修改；
- note 在 V1 管理员直接编辑中也按真实性字段只读保留，不因普通正文编辑被覆盖；
- Round / Question / FollowUp 使用第 12 章的可选 id 规则，已有子项必须带原 id，新建子项 id = null。

规则：

1. 仅 PUBLISHED 状态可用；
2. 当前存在 PENDING ChangeRequest 时禁止直接修改，返回 409 CHANGE_REQUEST_CONFLICT；
3. 条件更新 WHERE id = ? AND status = 'PUBLISHED' AND version = ?（version 取请求携带的编辑基线版本；affectedRows = 0 返回 409 INTERVIEW_VERSION_CONFLICT，防止旧编辑页静默覆盖他人修改）；
4. 保存内容必须通过 12.2「输入上限」与 PUBLISHED 完整性校验（公司 / 岗位 / 招聘类型 / 至少一轮一问；sourceUrls 每条必须是 HTTP/HTTPS URL）；
5. 成功后仍为 PUBLISHED，version + 1；
6. 同一事务内写入 interview_revision 审计记录（保存修改前的完整正式版本）。

成功响应使用 InterviewSaveResponse：返回保存后的 canonical PUBLISHED interview（version=16），包括新建 Round / Question / FollowUp 的真实 id、完整 sources[] 与只读历史字段。

不引入新锁、新审批流；审计与 Snapshot 分离，SubmissionSnapshot 语义保持“用户提交审核时的原始快照”不被污染。

---

# 10. 已发布内容修改 / 删除

## 10.1 读取编辑基线与当前 PENDING 申请

~~~http
GET /api/v1/me/interviews/{id}/change-request
~~~

该接口只允许已发布面经的作者访问。无论当前有没有 PENDING 申请，只要 Interview 存在且归当前用户，正常返回 200；“没有申请”不是 404。

无 PENDING 申请：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "interview": {
      "id": 1001,
      "version": 15,
      "company": {
        "id": 1,
        "name": "字节跳动"
      },
      "department": "抖音电商",
      "position": {
        "id": 12,
        "name": "Java 后端开发",
        "category": "后端开发"
      },
      "recruitType": "CAMPUS",
      "tags": [
        {
          "id": 3,
          "name": "Redis"
        }
      ],
      "rounds": [
        {
          "id": 201,
          "roundType": "TECHNICAL",
          "roundNo": 1,
          "remark": null,
          "interviewDate": "2026-09-20",
          "interviewDatePrecision": "DAY",
          "questions": [
            {
              "id": 3001,
              "content": "Redis 分布式锁怎么实现？",
              "referenceUrl": null,
              "questionType": "NORMAL",
              "sectionLabel": "Redis",
              "contextNote": null,
              "algorithmTitle": null,
              "algorithmDescription": null,
              "algorithmRequirements": null,
              "leetcodeNumber": null,
              "leetcodeUrl": null,
              "followUps": [
                {
                  "id": 4001,
                  "content": "锁过期怎么办？"
                }
              ]
            }
          ]
        }
      ],
      "sourceUrl": "https://example.com/interview"
    },
    "changeRequest": null
  }
}
~~~

有 PENDING UPDATE：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "interview": {
      "id": 1001,
      "version": 15,
      "company": {
        "id": 1,
        "name": "字节跳动"
      },
      "department": "抖音电商",
      "position": {
        "id": 12,
        "name": "Java 后端开发",
        "category": "后端开发"
      },
      "recruitType": "CAMPUS",
      "tags": [
        {
          "id": 3,
          "name": "Redis"
        }
      ],
      "rounds": [],
      "sourceUrl": "https://example.com/interview"
    },
    "changeRequest": {
      "id": 8801,
      "type": "UPDATE",
      "status": "PENDING",
      "baseVersion": 15,
      "payload": {
        "company": {
          "existingId": 1,
          "proposedName": null
        },
        "position": {
          "existingId": 12,
          "proposedName": null
        },
        "department": "抖音电商",
        "recruitType": "CAMPUS",
        "tagIds": [3, 7],
        "proposedTags": [],
        "rounds": [],
        "sourceUrl": "https://example.com/interview"
      },
      "reason": null,
      "createTime": "2026-10-06T09:00:00+08:00",
      "updateTime": "2026-10-06T09:20:00+08:00"
    }
  }
}
~~~

changeRequest 只返回当前 PENDING 申请；历史 APPROVED / REJECTED 申请不在作者编辑页展开。

---

## 10.2 创建或覆盖 ChangeRequest

~~~http
PUT /api/v1/me/interviews/{id}/change-request
~~~

UPDATE：

~~~json
{
  "type": "UPDATE",
  "baseVersion": 15,
  "payload": {
    "company": {
      "existingId": 1,
      "proposedName": null
    },
    "position": {
      "existingId": 12,
      "proposedName": null
    },
    "department": "抖音电商",
    "recruitType": "CAMPUS",
    "tagIds": [3, 7],
    "proposedTags": [],
    "rounds": [],
    "sourceUrl": "https://example.com/interview"
  }
}
~~~

DELETE：

~~~json
{
  "type": "DELETE",
  "baseVersion": 15,
  "reason": "不希望继续公开"
}
~~~

UPDATE 的 payload 使用 InterviewChangePayload：语义是“作者希望最终发布的完整目标版本”，字段形状与普通投稿编辑基本一致，但不包含 version；version 只使用最外层 baseVersion。

用户可以在 ChangeRequest 中提出新的 Company / Position / Tag 名称。它们不会直接污染正式 Catalog；管理员审批 UPDATE 时必须先解析为已有正式项或创建正式项，再应用正式内容。

规则：

- UPDATE payload 在创建/覆盖时即做两道校验：12.2「输入上限」全部规则 + PUBLISHED 完整性（公司 / 岗位 / 招聘类型 / 至少一轮一问）；不满足返回 400，payload 不落库。落库的是解析后的规范形（未知字段被剔除，防止把任意大 JSON 存进 JSONB）；
- UPDATE payload 与当前正式内容完全一致时拒绝（400 VALIDATION_ERROR「内容没有任何变化，无需提交修改申请」）：比较基准 = 作者基线（10.1）的 canonical 内容按与前端同一套映射转成目标版本后的规范形，version 不参与；空跑申请不应进入审核队列；
- 同一 Interview 同时最多一个 PENDING ChangeRequest；
- 第一次 UPDATE：创建；
- 再次 UPDATE：覆盖当前 PENDING payload，记录 id 不变；
- UPDATE 改 DELETE：同一 PENDING 记录切换为 DELETE，并清空 UPDATE payload；
- DELETE 改 UPDATE：同一 PENDING 记录切换为 UPDATE，并写入完整 payload；
- 正式 InterviewRecord 始终保持 PUBLISHED，直到管理员批准；
- baseVersion 必须等于当前正式 version，否则返回 409 INTERVIEW_VERSION_CONFLICT。

成功响应必须返回完整当前申请：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 8801,
    "interviewId": 1001,
    "type": "UPDATE",
    "status": "PENDING",
    "baseVersion": 15,
    "payload": {
      "company": {
        "existingId": 1,
        "proposedName": null
      },
      "position": {
        "existingId": 12,
        "proposedName": null
      },
      "department": "抖音电商",
      "recruitType": "CAMPUS",
      "tagIds": [3, 7],
      "proposedTags": [],
      "rounds": [],
      "sourceUrl": "https://example.com/interview"
    },
    "reason": null,
    "createTime": "2026-10-06T09:00:00+08:00",
    "updateTime": "2026-10-06T09:20:00+08:00"
  }
}
~~~

---

# 11. 管理员处理 ChangeRequest

## 11.1 列表

~~~http
GET /api/v1/admin/change-requests
GET /api/v1/admin/change-requests?status=PENDING&type=UPDATE&page=1&size=20
~~~

默认 status=PENDING。响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "items": [
      {
        "id": 8801,
        "type": "UPDATE",
        "status": "PENDING",
        "baseVersion": 15,
        "interview": {
          "id": 1001,
          "companyName": "字节跳动",
          "positionName": "Java 后端开发",
          "status": "PUBLISHED",
          "version": 15
        },
        "requester": {
          "id": 100,
          "githubLogin": "soarhill",
          "avatarUrl": "https://..."
        },
        "reason": null,
        "createTime": "2026-10-06T09:00:00+08:00",
        "updateTime": "2026-10-06T09:20:00+08:00"
      }
    ],
    "page": 1,
    "size": 20,
    "total": 3
  }
}
~~~

## 11.2 详情

~~~http
GET /api/v1/admin/change-requests/{id}
~~~

响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "changeRequest": {
      "id": 8801,
      "type": "UPDATE",
      "status": "PENDING",
      "baseVersion": 15,
      "payload": {
        "company": {
          "existingId": 1,
          "proposedName": null
        },
        "position": {
          "existingId": 12,
          "proposedName": null
        },
        "department": "抖音电商",
        "recruitType": "CAMPUS",
        "tagIds": [3, 7],
        "proposedTags": [],
        "rounds": [],
        "sourceUrl": "https://example.com/interview"
      },
      "reason": null,
      "createTime": "2026-10-06T09:00:00+08:00",
      "updateTime": "2026-10-06T09:20:00+08:00"
    },
    "currentInterview": {
      "id": 1001,
      "status": "PUBLISHED",
      "version": 15,
      "company": {
        "id": 1,
        "name": "字节跳动"
      },
      "department": "抖音电商",
      "position": {
        "id": 12,
        "name": "Java 后端开发",
        "category": "后端开发"
      },
      "recruitType": "CAMPUS",
      "tags": [
        {
          "id": 3,
          "name": "Redis"
        }
      ],
      "rounds": [],
      "sources": [
        {
          "id": 5001,
          "url": "https://example.com/interview"
        }
      ]
    },
    "requester": {
      "id": 100,
      "githubLogin": "soarhill",
      "avatarUrl": "https://..."
    }
  }
}
~~~

管理员详情必须同时拿到“当前正式版本”和“申请目标版本”，前端不自行再拼第二次公开详情请求。

## 11.3 批准 / 拒绝

批准：

~~~http
POST /api/v1/admin/change-requests/{id}/approve
~~~

拒绝：

~~~http
POST /api/v1/admin/change-requests/{id}/reject
~~~

两个动作都必须携带管理员读取的申请修订号：

~~~json
{ "expectedRequestVersion": 0 }
~~~

`ChangeRequestView.requestVersion` 创建时为 0，每次覆盖申请（payload/type/reason）递增。
审批在事务锁内同时检查 PENDING 和 expectedRequestVersion；不一致返回 409
CHANGE_REQUEST_CONFLICT，前端保留旧展示并要求读取最新申请重新核对。
baseVersion 是正式面经基线，不能替代申请自身的修订号；重复审批不会产生第二次副作用。

批准 UPDATE：

~~~text
校验 ChangeRequest=PENDING
-> 校验 baseVersion 与当前正式 version 一致
-> 复核 payload 完整性（与创建时同一套校验；历史遗留的不完整 payload 一律 400 拒绝，
   正式内容与申请状态均不变）
-> 解析 payload 中可能存在的新 Catalog 名称
-> 保存修改前的完整正式版本到 InterviewRevision
-> 应用完整 payload
-> InterviewRecord.version + 1
-> ChangeRequest=APPROVED
-> reviewTime / reviewerId
~~~

批准 UPDATE 时锁顺序与创建一致（先 interview_record 再 change_request），
作者覆盖申请与管理员批准并发不会互相死锁。

来源合并语义：作者基线只暴露第一条来源（canonical 的 sourceUrl）。批准 UPDATE 时
payload 的 sourceUrl 只替换这第一条；管理员维护的其余多来源作者不可见、不可编辑，
批准后原样保留，不因作者改其它字段而丢失。

批准 DELETE：

~~~text
InterviewRecord PUBLISHED -> REMOVED
-> version + 1
-> ChangeRequest=APPROVED
~~~

拒绝：

~~~text
InterviewRecord 保持原样
ChangeRequest=PENDING -> REJECTED
~~~

批准成功响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "changeRequest": {
      "id": 8801,
      "status": "APPROVED",
      "reviewTime": "2026-10-06T10:30:00+08:00"
    },
    "interview": {
      "id": 1001,
      "status": "PUBLISHED",
      "version": 16
    }
  }
}
~~~

DELETE 批准时 interview.status 返回 REMOVED。

拒绝成功响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "changeRequest": {
      "id": 8801,
      "status": "REJECTED",
      "reviewTime": "2026-10-06T10:30:00+08:00"
    },
    "interview": {
      "id": 1001,
      "status": "PUBLISHED",
      "version": 15
    }
  }
}
~~~

拒绝不修改正式 InterviewRecord，因此 version 不递增。

---

# 12. 核心 DTO、写响应与保真规则

## 12.1 SelectionInput / CatalogSelectionView

写请求中的 Company / Position 使用 SelectionInput：

~~~text
existingId
proposedName
~~~

提交审核时 existingId / proposedName 必须二选一；保存草稿时允许二者都为空。

读响应中的 Company / Position 使用 CatalogSelectionView：

~~~text
id       正式目录 ID；候选值时为 null
name     页面直接展示的名称
source   OFFICIAL / PROPOSED
category Position 可返回；候选岗位允许为 null
~~~

前端不用自己查询 Candidate 再拼展示名称。

---

## 12.2 InterviewUpsertRequest

普通用户保存投稿、管理员编辑待审核投稿使用同一个聚合请求：

~~~json
{
  "version": 7,
  "company": {
    "existingId": 1,
    "proposedName": null
  },
  "position": {
    "existingId": null,
    "proposedName": "Agent Infra Engineer"
  },
  "department": "抖音电商",
  "recruitType": "CAMPUS",
  "tagIds": [3, 7],
  "proposedTags": ["Agent Memory"],
  "rounds": [
    {
      "id": 201,
      "roundType": "TECHNICAL",
      "roundNo": 1,
      "interviewDate": "2026-09-20",
      "questions": [
        {
          "id": 3001,
          "content": "Redis 分布式锁怎么实现？",
          "referenceUrl": null,
          "followUps": [
            {
              "id": 4001,
              "content": "锁过期怎么办？"
            }
          ]
        }
      ]
    }
  ],
  "sourceUrl": "https://example.com/interview"
}
~~~

### 子实体 ID 规则

Round / Question / FollowUp 的 id 都是可选字段：

- 已存在子项：必须回传原 id；
- 新增子项：id 省略或为 null；
- 后端必须校验传入 id 确实属于当前 Interview 聚合，不能跨面经引用；
- 聚合保存按 id 做更新 / 新增 / 删除差异，不允许简单“全部删掉再插入”，否则 Question ID 会变化，公开详情稳定锚点失效；
- 当前请求数组中缺失的、原本属于该聚合的可编辑子项视为用户明确删除；
- sortOrder 不由前端传，仍由数组顺序生成。

### QuestionInput 写入模型（V1 简化冻结）

QuestionInput 只包含：

~~~text
id
content
referenceUrl                 可选题目链接（LeetCode / 牛客 / Codeforces 等）
followUps[]
~~~

- referenceUrl 非空时必须是 HTTP/HTTPS URL，长度 ≤ 500；
- questionType 不再由前端提交：带 referenceUrl 的问题由后端记为 ALGORITHM，其余为 NORMAL；
- 新投稿不产生 sectionLabel / contextNote / algorithm* / leetcodeNumber / leetcodeUrl。

历史兼容（读取与保护）规则：

- 读取（编辑基线 / canonical / 详情）时，Question 返回 `referenceUrl = reference_url ?? leetcode_url`（合并为一个用户可见链接），并继续返回历史字段（questionType、sectionLabel、contextNote、algorithm*、leetcodeNumber、leetcodeUrl）供兼容展示；
- 保存时，输入里不存在的历史字段一律**保持原值**，缺省不代表清空（sectionLabel / contextNote / algorithm* / leetcodeNumber / remark 永不因保存而被抹掉）；
- 唯一例外是「相关题目链接」本身：编辑表单把它预填进 referenceUrl，用户清空后保存即视为删除链接（同时清空 legacy leetcode_url）；
- questionType 更新时只升不降：带链接 → ALGORITHM；去掉链接不会把历史 ALGORITHM 改回 NORMAL。

### 日期（V1 简化冻结）

RoundInput：

~~~text
id
roundType
roundNo
interviewDate                可选，YYYY-MM-DD 或 null
questions[]
~~~

- 新投稿只提交完整日期或不填，没有 precision 概念；
- 更新时日期与库中一致 → 历史精度（MONTH / YEAR）原样保留；
- 日期变化 → 按 DAY 写入；清空 → 日期与精度同时置空；
- 读取响应仍返回 interviewDatePrecision，历史月 / 年精度继续兼容展示。

### 岗位方向目录

方向是管理员可扩展目录：`GET /api/v1/position-categories`（公开）返回 `{id, name, sortOrder}`。
筛选与列表的 `positionCategory` 参数传**目录 id 字符串**；filters 的 `positionCategories[].value`
即目录 id、`label` 即方向名。候选 `CREATE_NEW` 岗位时携带 `categoryName`——目录无同名项则按
规范化名新建方向（排到「其他」之前），有则复用。

### 来源

普通用户投稿 V1 最多一个来源，因此使用 sourceUrl。用户投稿记录从创建开始就只维护这一条用户来源。

多来源记录不通过普通用户投稿接口编辑；管理员编辑已发布记录时使用第 9.7 节的 sourceUrls[]。

### 输入上限

所有聚合写入路径（普通保存 / 管理员编辑待审核 / 已发布直改 / ChangeRequest payload）
统一强制执行：

| 项 | 上限 |
| --- | --- |
| 轮次数 | 10 |
| 每轮问题数 | 50 |
| 每个问题追问数 | 20 |
| tagIds / proposedTags | 各 20 个；tagIds 不得重复 |
| 单个新标签 / proposedName | 50 / 100 字符 |
| department | 100 字符 |
| 问题正文 | 2000 字符 |
| 追问正文 | 1000 字符 |
| sourceUrl / sourceUrls | 每条 ≤ 500 字符且必须 HTTP/HTTPS；直改 sourceUrls ≤ 10 条 |
| 变更申请 reason / 拒绝原因 | 500 字符 |
| 写请求体 | 1 MB（超出返回 413 PAYLOAD_TOO_LARGE） |
| 搜索与目录 q | 100 字符 |
| 列表 page / size | page ≤ 10000；size ≤ 100 |

---

## 12.3 InterviewChangePayload

ChangeRequest UPDATE 的 payload 与 InterviewUpsertRequest 的业务内容相同，但不包含 version：

~~~text
company
position
department
recruitType
tagIds
proposedTags
rounds[]
sourceUrl
~~~

并发基线只使用 ChangeRequest 最外层 baseVersion。

Round / Question / FollowUp 的 id 规则和 12.2 完全相同。

---

## 12.4 InterviewDetailResponse

公开详情逻辑结构：

~~~text
id
company
department
position
recruitType
tags
firstInterviewDate
firstInterviewDatePrecision
originalPositionName
inferredPositionName
note
rounds
sources
~~~

Response 面向页面展示：

- displayName、firstInterviewDate、firstInterviewDatePrecision 是展示 / 聚合派生字段；
- 每个 Round 的 interviewDatePrecision 来自持久化字段；
- originalPositionName / inferredPositionName / note 主要服务历史真实性，存在时由详情页以辅助信息展示；
- Question 返回 referenceUrl（reference_url 优先、legacy leetcode_url 兜底）与历史兼容字段（questionType / sectionLabel / contextNote / algorithm* / leetcodeNumber / leetcodeUrl，存在时返回）；
- 上述可选字段允许为 null。

---

## 12.5 写成功响应

### A. 聚合保存：InterviewSaveResponse

PUT 保存整份 Interview 聚合时，后端可能给新 Round / Question / FollowUp 分配数据库 ID，因此**不能只返回新 version**，必须返回保存后的 canonical 聚合。

适用：

~~~text
PUT /me/interviews/{id}
PUT /admin/reviews/interviews/{id}
PUT /admin/interviews/{id}
~~~

普通投稿 / 待审核保存示例：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "interview": {
      "id": 1001,
      "status": "DRAFT",
      "version": 9,
      "company": {
        "id": 1,
        "name": "字节跳动",
        "source": "OFFICIAL"
      },
      "position": {
        "id": 12,
        "name": "Java 后端开发",
        "source": "OFFICIAL",
        "category": "后端开发"
      },
      "department": "抖音电商",
      "recruitType": "CAMPUS",
      "tags": [
        {
          "id": 3,
          "name": "Redis",
          "source": "OFFICIAL"
        }
      ],
      "rounds": [
        {
          "id": 201,
          "roundType": "TECHNICAL",
          "roundNo": 1,
          "displayName": "一面",
          "remark": null,
          "interviewDate": "2026-09-20",
          "interviewDatePrecision": "DAY",
          "questions": [
            {
              "id": 3001,
              "content": "Redis 分布式锁怎么实现？",
              "referenceUrl": null,
              "questionType": "NORMAL",
              "sectionLabel": "Redis",
              "contextNote": null,
              "algorithmTitle": null,
              "algorithmDescription": null,
              "algorithmRequirements": null,
              "leetcodeNumber": null,
              "leetcodeUrl": null,
              "followUps": [
                {
                  "id": 4001,
                  "content": "锁过期怎么办？"
                }
              ]
            }
          ]
        }
      ],
      "sourceUrl": "https://example.com/interview",
      "updateTime": "2026-10-06T10:00:00+08:00"
    },
    "warnings": []
  }
}
~~~

前端保存成功后直接用 interview 替换当前表单基线，因此：

- 新建子项拿到真实数据库 id；
- 本地 version 更新；
- 后续保存可以稳定按 id 做差异更新；
- 不需要额外再 GET 一次详情。

管理员 PUBLISHED 保存同样返回 canonical interview，但来源字段使用 sources[]，并包含第 9.7 节的只读历史字段。

### B. 状态 / 动作写入：InterviewMutationResponse

不改变聚合子实体结构的状态动作统一至少返回：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 1001,
    "status": "PENDING_REVIEW",
    "version": 10,
    "updateTime": "2026-10-06T10:05:00+08:00",
    "warnings": []
  }
}
~~~

适用：

~~~text
POST /me/interviews                         创建草稿（version=0）
POST /me/interviews/{id}/submit             提交审核
POST /admin/reviews/interviews/{id}/publish 发布
POST /admin/reviews/interviews/{id}/reject  拒绝
~~~

前端每次成功后必须用响应 version 覆盖本地旧 version。

Candidate resolve 使用扩展响应：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "resolvedCandidateId": 901,
    "interview": {
      "id": 1001,
      "status": "PENDING_REVIEW",
      "version": 12,
      "updateTime": "2026-10-06T10:00:00+08:00"
    }
  }
}
~~~

草稿物理删除成功：

~~~json
{
  "code": "SUCCESS",
  "message": "success",
  "data": {
    "id": 1001,
    "deleted": true
  }
}
~~~

ChangeRequest 的写响应使用第 10～11 章定义的专用 DTO，因为创建 / 拒绝 ChangeRequest 不一定改变正式 Interview version。

---

## 12.6 历史真实性与聚合保存保真

这是所有聚合写接口的硬规则。

### 迁移只读字段由服务端保留

~~~text
originalPositionName
inferredPositionName
note
~~~

它们不属于普通 InterviewUpsertRequest。普通用户保存投稿、管理员修改普通正文时，**请求里没有这些字段不等于清空**；Service 必须从当前正式聚合保留原值。

V1 若以后要人工修正这些迁移真实性字段，再单独增加明确治理能力，不复用普通表单的“全量覆盖”语义。

### 算法字段显式 round-trip

算法字段属于 Question 正式模型，不是隐藏迁移元数据，因此：

- 读取编辑基线时完整返回；
- QuestionInput 正式包含这些字段；
- 编辑普通字段时前端保留原值；
- 后端不得把缺省 NORMAL 模板错误覆盖到已有 ALGORITHM 问题。

### 多来源不降维

- 用户新投稿：sourceUrl，最多一个；
- 存量数据：interview_source 可以有多条；
- 管理员已发布编辑：sourceUrls[] 完整读取、完整提交；
- 不允许因为复用普通用户 sourceUrl DTO，就把历史第二、第三个来源删掉。

### 稳定子实体 ID

已有 UNKNOWN 轮次可以按原 id/type 保留；新建 UNKNOWN 或把标准轮次改为 UNKNOWN 不允许。

Question.id 是搜索定位和详情锚点的稳定标识。聚合保存必须按已有 id 做差异更新，不允许每次保存 delete-all + reinsert。

同理 Round / FollowUp 已有 id 也应尽量稳定，便于审计与前端局部状态恢复。

### SubmissionSnapshot 永不被编辑覆盖

SubmissionSnapshot.payload 是提交瞬间的不可变审计快照。后续作者编辑、管理员编辑、Candidate resolve、发布都不能回写旧 Snapshot。

---

# 13. 并发控制

## 13.1 affectedRows 的语义

执行：

```sql
UPDATE interview_record
SET status = 'PUBLISHED'
WHERE id = ?
  AND status = 'PENDING_REVIEW';
```

如果当前确实还是 PENDING_REVIEW：

```text
affectedRows = 1
```

如果已经被另一管理员改成 REJECTED / PUBLISHED：

```text
affectedRows = 0
```

SQL 本身没有报错，只是没有任何一行满足 WHERE 条件。

因此：

> affectedRows 用来判断“我这次是否真的改到了预期状态的记录”。

这解决的是**状态竞争**。

---

## 13.2 状态条件更新

提交审核、发布、拒绝、批准 ChangeRequest 等操作必须带“预期原状态”。

例如发布：

```sql
UPDATE interview_record
SET status = 'PUBLISHED',
    version = version + 1,
    publish_time = now()
WHERE id = ?
  AND status = 'PENDING_REVIEW'
  AND version = ?;
```

affectedRows = 0 时，返回状态或版本冲突，而不是继续执行后续逻辑。

---

## 13.3 version 乐观锁

`interview_record.version`：

```text
BIGINT NOT NULL DEFAULT 0
```

每次会改变审核内容或正式版本的写操作成功后：

```text
version = version + 1
```

典型场景：

```text
10:00 管理员打开 version=7
10:02 作者修改，version=8
10:03 管理员拿 version=7 发布
=> affectedRows=0
=> INTERVIEW_VERSION_CONFLICT
```

这样避免管理员用旧页面覆盖用户的新内容。

V1 使用乐观锁，不使用数据库长事务锁页面，也不使用 Redis 分布式锁。

有一组操作需要短事务行级锁：创建 / 覆盖 PENDING ChangeRequest、审批 ChangeRequest、管理员直接修改 PUBLISHED 时，先对目标 `interview_record` 执行 `SELECT ... FOR UPDATE`，再检查正式 version 与 PENDING 申请状态并完成写入。这样关闭“先检查无申请，随后并发插入申请”的 check-then-act 窗口；锁仅存在于一次数据库事务内。

---

## 13.4 UNIQUE 约束解决的不是同一个问题

条件 UPDATE + affectedRows：

> 防止状态被别人抢先修改。

UNIQUE：

> 防止数据库出现不允许的重复记录。

例如：

- githubId 唯一；
- normalizedName 唯一；
- 同一 Interview + Tag 唯一；
- 同一 Interview 同时最多一个 PENDING ChangeRequest。

业务层先做友好检查，数据库 UNIQUE 做并发下的最终兜底。

---

# 14. 幂等

V1 不引入通用 `Idempotency-Key`。

以下操作通过“预期状态 + version + UNIQUE”自然保证重复调用不会重复产生业务副作用：

- submit
- publish
- reject
- Candidate resolve
- ChangeRequest approve / reject

例如两次 publish：

第一次：

```text
PENDING_REVIEW -> PUBLISHED
affectedRows=1
```

第二次：

```text
WHERE status=PENDING_REVIEW 匹配不到
affectedRows=0
=> INTERVIEW_STATUS_CONFLICT
```

以后出现支付、发券、外部回调等不可逆副作用场景，再单独设计通用幂等键。

---

# 15. 事务边界

必须事务化：

### 提交审核

```text
完整性校验
+ 创建 SubmissionSnapshot
+ 状态条件更新
+ version + 1
```

### Candidate resolve

```text
校验 Candidate 仍存在
+ 校验 InterviewRecord.status = PENDING_REVIEW
+ 校验请求 version
+ 创建 / 复用正式 Catalog 或绑定已有项
+ 移除 Candidate
+ InterviewRecord.version + 1
```

### 管理员发布

```text
Candidate 全部处理完成
+ 正式 Catalog 数据关联完成
+ 正文最终内容
+ PENDING_REVIEW -> PUBLISHED
+ publishTime
+ version + 1
```

### 批准 UPDATE ChangeRequest

```text
校验 PENDING
+ 校验正式版本
+ 应用完整 payload
+ 正式 version + 1
+ ChangeRequest -> APPROVED
```

### 批准 DELETE ChangeRequest

```text
InterviewRecord -> REMOVED
+ version + 1
+ ChangeRequest -> APPROVED
```

### 管理员直接修改已发布内容

```text
校验无 PENDING ChangeRequest
+ 保存 interview_revision（修改前版本）
+ 条件更新（status = 'PUBLISHED' AND version = ?）
+ version + 1
```

---

# 16. API 清单

| Method | Path | 权限 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/v1/interviews` | Public | 面经列表、搜索、筛选 |
| GET | `/api/v1/interviews/{id}` | Public | 公开面经详情 |
| GET | `/api/v1/interview-filters` | Public | 首页筛选选项与联动计数 |
| GET | `/api/v1/cheers` | Public | 页尾祝福累计人数 |
| POST | `/api/v1/cheers` | Public | 接受祝福（+1，幂等） |
| GET | `/api/v1/companies` | Public | 正式公司 |
| GET | `/api/v1/positions` | Public | 正式岗位 |
| GET | `/api/v1/tags` | Public | 正式标签 |
| GET | `/api/v1/position-categories` | Public | 岗位方向目录（筛选与投稿联想共用） |
| GET | `/api/v1/auth/github` | Public | GitHub OAuth |
| GET | `/api/v1/auth/github/callback` | Public | OAuth 回调 |
| GET | `/api/v1/auth/me` | Login | 当前用户 |
| GET | `/api/v1/auth/csrf` | Public | 获取 / 刷新 CSRF Token |
| POST | `/api/v1/auth/logout` | Login | 退出 |
| POST | `/api/v1/me/interviews` | USER+ | 创建草稿 |
| GET | `/api/v1/me/interviews` | USER+ | 我的投稿 |
| GET | `/api/v1/me/interviews/{id}` | Owner | 投稿详情 |
| PUT | `/api/v1/me/interviews/{id}` | Owner | 保存草稿 / 待审核内容 |
| DELETE | `/api/v1/me/interviews/{id}` | Owner | 删除纯草稿（从未提交过） |
| POST | `/api/v1/me/interviews/{id}/submit` | Owner | 提交审核 |
| GET | `/api/v1/me/interviews/{id}/change-request` | Owner | 当前变更申请 |
| PUT | `/api/v1/me/interviews/{id}/change-request` | Owner | 创建/覆盖变更申请 |
| GET | `/api/v1/admin/reviews/interviews` | ADMIN | 投稿审核列表 |
| GET | `/api/v1/admin/reviews/interviews/{id}` | ADMIN | 投稿审核详情 |
| PUT | `/api/v1/admin/reviews/interviews/{id}` | ADMIN | 编辑审核内容 |
| POST | `/api/v1/admin/reviews/interviews/{id}/publish` | ADMIN | 发布 |
| POST | `/api/v1/admin/reviews/interviews/{id}/reject` | ADMIN | 拒绝 |
| POST | `/api/v1/admin/reviews/interviews/{id}/candidates/{candidateId}/resolve` | ADMIN | 处理候选项 |
| GET | `/api/v1/admin/interviews/{id}` | ADMIN | 已发布面经管理员编辑基线 |
| PUT | `/api/v1/admin/interviews/{id}` | ADMIN | 直接修改已发布面经 |
| GET | `/api/v1/admin/change-requests` | ADMIN | 变更申请列表 |
| GET | `/api/v1/admin/change-requests/{id}` | ADMIN | 变更申请详情 |
| POST | `/api/v1/admin/change-requests/{id}/approve` | ADMIN | 批准变更 |
| POST | `/api/v1/admin/change-requests/{id}/reject` | ADMIN | 拒绝变更 |

---

# 17. V1 API 明确不做

- 评论 API
- 点赞 API
- 关注 / 私信 API
- 收藏同步 API
- AI 问答 API
- AI 审核 API
- 支付 / 会员 API
- 用户直接创建正式 Company / Position / Tag 的 API
- 独立 Question / FollowUp CRUD 写 API
- 通用 Idempotency-Key 平台
- Redis 分布式锁
- Embedding / AI 相似度去重 API

后续 API 演进必须由真实产品需求推动。
