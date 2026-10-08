<div align="center">

<img src="frontend/src/app/icon.svg" width="72" alt="面个 Offer" />

# 面个 Offer

**把真实问题，留给下一次面试。**

来自真实面试记录的大厂面试问题库：搜索、阅读、沉淀每一轮真实问答。

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

</div>

---

## 为什么做这件事

准备一场面试最难的部分，往往不是「不会」，而是「不知道会遇到什么」。

面个 Offer 想把散落在论坛帖、聊天记录里的真实面试经历，变成一份**结构化、可检索、持续更新**的问题库：按公司、岗位方向、招聘类型找到对应面经，看到每一轮问了什么、追问链是什么样的，遇到算法题还能看到题干与要求。你可以在面试前夜快速过一遍目标公司的真题，也可以把自己刚经历的一场面试留下来，帮到下一个人。

## 产品预览

> 📸 **产品截图准备中**，首发前补充以下真实截图：
>
> - [ ] PC 端首页（搜索 + 筛选 + 面经列表）
> - [ ] PC 端面经详情（轮次 / 问题 / 追问 / 复制）
> - [ ] 移动端首页与详情
> - [ ] 投稿编辑器（草稿 / 校验 / 追问编排）
> - [ ] 管理员审核工作台（候选治理 / 快照对比）

## 核心功能

**浏览与检索（游客可用）**

- 关键词搜索：命中问题正文、算法描述、追问、公司、岗位与标签，结果高亮并支持直达命中追问
- 公司 / 岗位方向 / 招聘类型三维筛选，计数联动
- 结构化详情：按轮次组织的问题与追问、月 / 年精度日期、原始来源链接、一键复制

**贡献与治理（GitHub 登录）**

- 结构化投稿：草稿 / 提交两档校验，问题与追问可编排，未保存内容有退出保护
- 公司 / 岗位 / 标签支持提交新候选，由管理员归并进正式目录，不污染分类数据
- 管理员审核工作台：快照对照、候选解析、发布 / 拒绝；并发编辑有版本冲突保护
- 已发布内容的修改 / 删除走变更申请，审核期间公开页始终展示旧版本
- 与当前内容完全一致的空跑修改申请会被直接拒绝

## 技术架构

前后端分离的模块化单体，选型偏标准、可讲清门道：

| 层 | 技术 |
| --- | --- |
| 后端 | Java 25 · Spring Boot 3.5 · MyBatis-Plus · Spring Security（OAuth2 会话 + CSRF） |
| 数据 | PostgreSQL 18 · Flyway 迁移 · Spring Session（JDBC） |
| 前端 | Next.js 16（App Router）· React 19 · TypeScript strict · Tailwind CSS v4 |

架构决策与约束见[系统架构](docs/architecture/system-architecture.md)。

## 快速开始

需要 JDK 25、Maven 3.9+、Node.js ≥ 20，跑后端测试另需 Docker。

**1. 启动数据库与后端**（终端一，以下命令均从项目根目录出发）

```bash
docker run -d --name interview-vault-pg \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=interviewvault \
  -p 127.0.0.1:5433:5432 postgres:18
```

```bash
cd backend
mvn spring-boot:run
```

连接配置走环境变量，开发默认值开箱即用（`jdbc:postgresql://localhost:5433/interviewvault`）。schema 由 Flyway 管理，空库启动即自动建表并写入基础字典。API 文档见 `http://localhost:8080/swagger-ui/index.html`。

**2. 启动前端**（另开终端二，回到项目根目录）

```bash
cd frontend
npm ci
```

`.env.local`：

```dotenv
NEXT_PUBLIC_API_MOCK=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

```bash
npm run dev
```

访问 `http://localhost:3000`。仅做前端开发时，把 `NEXT_PUBLIC_API_MOCK` 设为 `true` 可脱离后端使用内置 Mock。

**3.（可选）打通登录**

注册一个 GitHub OAuth App（Homepage 填 `http://localhost:3000`，Callback 填 `http://localhost:8080/api/v1/auth/github/callback`），把 Client ID / Secret 通过 `IV_GITHUB_CLIENT_ID` / `IV_GITHUB_CLIENT_SECRET` 注入后端进程后重启，即可使用真实 GitHub 登录与完整投稿流程。

## 运行测试

```bash
# 后端（Testcontainers 自动起一次性 PG18，需要 Docker）
cd backend && mvn test

# 前端
cd frontend && npm run typecheck && npm run lint && npm run test && npm run build
```

## 项目文档

| 文档 | 内容 |
| --- | --- |
| [产品需求](docs/product/prd.md) | 定位、功能与业务边界 |
| [系统架构](docs/architecture/system-architecture.md) | 模块划分与关键约束 |
| [API 设计](docs/api/api-design.md) | 接口契约（唯一基线，契约先行） |
| [数据库设计](docs/database/database-design.md) | 表结构与约束 |
| [后端开发说明](docs/backend/backend-development.md) | 后端分层、规范与本地工作流 |
| [前端开发说明](docs/frontend/frontend-development.md) | 页面职责、Mock 与浏览器验收 |
| [部署 Runbook](docs/deployment/production-deployment.md) | 生产环境变量、边界与备份 |

## 参与贡献

欢迎提交 Issue 与 Pull Request——修复、功能、文档都在欢迎之列，流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

发现安全漏洞请走私密渠道，不要在公开 Issue 中披露细节，见 [SECURITY.md](SECURITY.md)。

## 开源协议与数据边界

本项目采用 **开源技术 + 独立运营产品** 的模式：

- 源代码与项目自有 Logo 以 [Apache License 2.0](LICENSE) 授权；
- 真实面经、用户投稿及生产数据不随本仓库代码一并开源授权。相关内容的权利归属和使用范围，以原作者授权、平台协议及适用法律为准；
- 仓库内出现的第三方公司名称与图形标识仅用于标识面经所属公司，**商标与图形权利归各自权利人**，不因本项目开源获得任何再授权；
- 用户个人信息与审核数据不会出现在本仓库中。

## 致谢

感谢所有分享真实面试经历的同学——每一份记录都在帮下一位面试者多一分底气。也感谢 Next.js、Spring Boot 与开源社区让这个项目得以站在巨人肩上。

---

<div align="center">

愿下一封来信，是你期待已久的 Offer。

</div>
