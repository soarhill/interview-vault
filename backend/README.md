# Interview Vault 后端

Spring Boot 3.5 + Java 25 + Maven + PostgreSQL 18 + Flyway。模块化单体：`auth` / `catalog` / `common` / `interview` / `review` / `search`。设计与约束见 [开发说明](../docs/backend/backend-development.md)。

## 环境准备

- JDK 25、Maven 3.9+。
- 开发数据库（Docker，一次性）：

```bash
docker run -d --name interview-vault-pg \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=interviewvault \
  -p 5433:5432 postgres:18
```

连接配置走环境变量，默认 `IV_DB_URL=jdbc:postgresql://localhost:5433/interviewvault`、`IV_DB_USER=postgres`、`IV_DB_PASSWORD=dev`。schema 由 Flyway 管理，应用启动自动迁移；空库启动即建表并写入基础字典，得到可运行的空数据系统。真实面经数据不在仓库内（生产恢复见部署 Runbook）。

## 常用命令

```bash
mvn spring-boot:run    # 启动 API（:8080，Swagger 在 /swagger-ui/index.html）
mvn test               # 全量测试；Testcontainers 自动起一次性 PG18（需要 Docker，无需本地库）
```

Windows 下若当前会话 JDK 不是 25，先将 `JAVA_HOME` 指向 JDK 25。

## 分支

主分支为 `main`。API 形状以 [API 设计](../docs/api/api-design.md) 为唯一基线；契约变更须先改契约再改代码。生产部署要求见[部署 Runbook](../docs/deployment/production-deployment.md)。
