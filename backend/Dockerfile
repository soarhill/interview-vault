# ---- 构建层：Maven + JDK 25（可验证的官方镜像）----
# 为什么多阶段：构建工具链（Maven 全量依赖、JDK）不进运行镜像，
# 运行层只留 JRE + 一个 jar，攻击面和体积都最小。
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build

# 先只拷 pom 拉依赖：源码变动不失效依赖层，国内网络下重建提速明显
COPY pom.xml .
RUN mvn -q -B dependency:go-offline

COPY src ./src
# 测试已在本地 / CI 用 mvn verify 完整执行（Testcontainers 需要 Docker，
# 镜像构建环境不假设有 Docker-in-Docker），镜像构建只做打包
RUN mvn -q -B package -DskipTests

# ---- 运行层：仅 JRE ----
FROM eclipse-temurin:25-jre

# curl 仅用于容器内 healthcheck 探活
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r app && useradd -r -g app -u 10001 app

WORKDIR /app
COPY --from=build /build/target/*.jar app.jar

# 非 root 运行
USER app
EXPOSE 8080

# 堆上限跟随容器内存限制（compose 设 mem limit），而非写死 -Xmx；
# egd 加速 SecureRandom 初始化（容器内 /dev/random 常见阻塞点）
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:8080/api/v1/health || exit 1
