<div align="center">

<img src="docs/assets/readme/logo.svg" width="64" height="64" alt="面个 Offer 书本图标" />

# 面个 Offer

[![Apache License 2.0](https://img.shields.io/badge/License-Apache--2.0-0f766e?style=flat-square)](LICENSE) [![Spring Boot 3.5](https://img.shields.io/badge/Spring%20Boot-3.5-0f766e?style=flat-square&logo=springboot&logoColor=white)](backend/pom.xml) [![GitHub Pages 在线体验](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-GitHub%20Pages-0f766e?style=flat-square&logo=github&logoColor=white)](https://soarhill.github.io/interview-vault/)

**把真实问题，留给下一次面试。**

**[在线体验 →](https://soarhill.github.io/interview-vault/)** · [本地运行](#快速开始)

</div>

## 产品预览

在线阅读版的真实界面。

**首页 · 找到目标公司与岗位的面经**

![面个 Offer 首页，展示关键词搜索、公司与岗位筛选和面经列表](docs/assets/readme/home.png)

**详情 · 顺着面试轮次阅读问题与追问**

![面个 Offer 面经详情，展示面试轮次、问题、追问与复制按钮](docs/assets/readme/interview-detail.png)

<details>
<summary>查看关于页</summary>

![面个 Offer 关于页，介绍项目初心与开源信息](docs/assets/readme/about.png)

</details>

## 为什么做面个 Offer

最开始只是想给自己做个顺手的小工具。

准备秋招时，发现面经大多散落在牛客等平台，想找某家公司、某个岗位的面试题，总得翻来翻去，手机上看也不太方便。

平时遇到不会的题，我还喜欢复制给 AI 继续学习，但从长帖子里找问题、复制粘贴，实在有点折腾。

所以就有了面个 Offer。把面经按公司、岗位和面试轮次整理好，想查就查，遇到不会的题也能一键复制给 AI。

原本只是想方便自己，后来觉得或许也能帮到其他正在准备面试的人，就索性把它开源分享出来。

## 能做什么

**浏览与检索 · 在线可用**

按公司、岗位方向和招聘类型筛选，或用关键词查找相关面经。详情按轮次呈现问题、追问和算法题信息，保留原始来源；支持复制单题、追问或整组问题。

**投稿与审核 · 完整版**

GitHub 登录后，以结构化表单记录面试经历，先保存草稿，再提交审核。管理员可以对照原始投稿修正内容，审核后发布或拒绝，作者能够查看投稿状态。

**内容维护 · 完整版**

新的公司、岗位和标签先作为候选项保存，由管理员确认归并。已发布内容的修改与删除通过申请审核，审核期间读者仍可查看当前公开版本。

> 在线版使用 108 份公开面经快照，由 `gh-pages` 的 `/docs` 发布，不提供站内登录、投稿或审核；`main` 提供可本地运行的完整实现，后端尚未公开部署。

## 技术架构

完整版由 Next.js 负责页面与交互，通过 REST API 访问 Spring Boot。后端采用模块化单体，PostgreSQL 保存面经、分类目录、审核记录与登录会话，搜索也直接使用 PostgreSQL。

| 层 | 技术 |
| --- | --- |
| 前端 | Next.js 16（App Router）· React 19 · TypeScript strict · Tailwind CSS v4 |
| 后端 | Java 25 · Spring Boot 3.5 · Spring Security · MyBatis-Plus |
| 数据 | PostgreSQL 18 · Flyway · Spring Session JDBC |

后端按 `auth / interview / catalog / review / search / common` 分包，分别组织认证、面经、目录、审核、搜索与公共技术能力。GitHub OAuth 由 Spring Security 接入，权限在后端校验；会话通过 JDBC 持久化，写请求受 CSRF 防护。

提交快照保存原始投稿，修订记录保存修改前的正式内容，两者分别维护。发布和内容替换在事务中完成，内容编辑与审核操作检查版本号，旧页面提交会返回冲突。

详细模块边界、接口契约与数据约束见 [项目文档](#项目文档)。

## 快速开始

运行完整版需要 **JDK 25、Maven 3.9+、Node.js 20.9+ 与 Docker**。先启动 Docker，再克隆 `main`。

```bash
git clone --branch main https://github.com/soarhill/interview-vault.git
cd interview-vault
```

### 1. 数据库与后端

在项目根目录打开终端一，以下使用 Bash / Git Bash。

```bash
docker run -d --name interview-vault-pg \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=interviewvault \
  -p 127.0.0.1:5433:5432 \
  postgres:18
cd backend
mvn spring-boot:run
```

<details>
<summary>Windows PowerShell 写法</summary>

PowerShell 使用反引号续行，启动数据库的等效命令如下；之后同样运行 `cd backend` 和 `mvn spring-boot:run`。

```powershell
docker run -d --name interview-vault-pg `
  -e POSTGRES_PASSWORD=dev `
  -e POSTGRES_DB=interviewvault `
  -p 127.0.0.1:5433:5432 `
  postgres:18
```

</details>

默认数据库为 `jdbc:postgresql://localhost:5433/interviewvault`，用户名 `postgres`、密码 `dev`。自定义连接使用 `IV_DB_URL`、`IV_DB_USER`、`IV_DB_PASSWORD`，见 [后端配置样例](backend/.env.example)。

Flyway 自动建表并写入基础字典。**空库初始化不会导入在线版的 108 份面经。** API 文档可在 [本地 Swagger UI](http://localhost:8080/swagger-ui/index.html) 查看。

### 2. 前端

另开终端二，从项目根目录开始。

```bash
cd frontend
npm ci
```

新建 `frontend/.env.local`，填写以下内容。

```dotenv
NEXT_PUBLIC_API_MOCK=false
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

```bash
npm run dev
```

打开 [本地前端](http://localhost:3000)。修改环境变量后需重启开发服务，可选配置见 [前端配置样例](frontend/.env.example)。

<details>
<summary>配置 GitHub 登录与管理员（可选）</summary>

创建自己的 [GitHub OAuth App](https://github.com/settings/developers)。Homepage URL 填 `http://localhost:3000`，Authorization callback URL 填 `http://localhost:8080/api/v1/auth/github/callback`。

将 `IV_GITHUB_CLIENT_ID`、`IV_GITHUB_CLIENT_SECRET` 注入后端进程环境并重启，即可登录和投稿。体验管理员审核还需配置 `IV_ADMIN_GITHUB_IDS`，使用 GitHub 数字 ID，多个 ID 以逗号分隔。

后端不会自动加载 `.env` 文件，请通过终端或 IDE 设置环境变量。**OAuth 凭据和真实环境配置不得提交到 Git。**

</details>

<details>
<summary>只体验前端交互（Mock 模式）</summary>

将 `frontend/.env.local` 中的 `NEXT_PUBLIC_API_MOCK` 改为 `true`，重启 `npm run dev`，即可使用内置演示数据和模拟身份体验投稿、审核流程，无需启动后端。

Mock 数据与在线版的 108 份面经独立，模拟登录也不使用真实 GitHub 凭据。连接真实后端或运行生产构建时，设回 `false`。

</details>

更细的本地说明见 [后端 README](backend/README.md) 与 [前端 README](frontend/README.md)。生产配置和部署步骤另见 [部署指南](docs/deployment/production-deployment.md)。

## 项目文档

- 产品与架构 · [产品需求](docs/product/prd.md) · [系统架构](docs/architecture/system-architecture.md)
- 接口与数据 · [API 设计](docs/api/api-design.md) · [数据库设计](docs/database/database-design.md)
- 开发说明 · [后端](docs/backend/backend-development.md) · [前端](docs/frontend/frontend-development.md)
- 部署与备份 · [部署指南](docs/deployment/production-deployment.md)

## 参与贡献

欢迎通过 [Issues](https://github.com/soarhill/interview-vault/issues) 反馈问题、讨论改进，也欢迎提交代码或文档 PR。具体流程见 [贡献指南](CONTRIBUTING.md)。请勿在公开仓库提交真实面经数据、个人信息或密钥。

安全漏洞请按 [安全策略](SECURITY.md) 使用私密报告渠道。

## 开源协议

项目自有源码采用 [Apache License 2.0](LICENSE)，第三方组件与图标保留各自许可。面经原帖、用户内容与第三方公司商标的权利归各自权利人，不因项目开源而自动取得相同授权。

**内容来自公开渠道，不等于取得转载许可。** 面经内容的使用范围以原作者授权、平台协议及适用法律为准，用户个人信息与审核数据不随代码公开。

感谢愿意分享面试经历的同学，也感谢支持这个项目的开源社区。

## 最后

AI 时代真的很奇妙。

很多以前只会停留在脑海里的小念头，如今也能慢慢变成真正能用的东西。

面个 Offer 也是这样。最初只是想给自己做个方便查面经的小工具，没想到折腾着折腾着，就有了现在的样子。

**我一直觉得，分享面经本身就是一件挺浪漫的事。** 如果自己留下的经验，能帮助另一个人拿到心仪的 Offer，想想就觉得很开心。

或许我们素不相识，但在某个平行时空里，一份小小的分享，恰好帮到了另一个正在努力的人。

我想，这就是这个网站存在的意义。

**最后，愿每一份认真准备都有回响，愿看到这里的你，收到那封期待已久的 Offer。**
