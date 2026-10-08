package com.interviewvault.common.config;

import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * 生产启动 fail-fast：prod profile 下拒绝「开发默认值/占位符」配置——
 * 数据库密码 dev、OAuth placeholder、localhost CORS/回跳、空管理员白名单都会中止启动。
 * 开发默认值方便本地起服务，但不允许被原样带上公网（详见部署 runbook）。
 */
@Component
public class ProductionConfigGuard implements org.springframework.beans.factory.InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(ProductionConfigGuard.class);

    private final Environment environment;

    public ProductionConfigGuard(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void afterPropertiesSet() {
        if (!environment.acceptsProfiles(org.springframework.core.env.Profiles.of("prod"))) {
            return;
        }
        List<String> violations = inspect(environment);
        if (!violations.isEmpty()) {
            throw new IllegalStateException("生产配置检查未通过（详见 docs/deployment/production-deployment.md）:\n- "
                    + String.join("\n- ", violations));
        }
        log.info("生产配置检查通过");
    }

    /** 拆出来供单测直接断言（MockEnvironment）。 */
    static List<String> inspect(Environment env) {
        List<String> problems = new ArrayList<>();
        String dbPassword = env.getProperty("spring.datasource.password");
        if (dbPassword == null || dbPassword.isBlank() || "dev".equals(dbPassword)) {
            problems.add("数据库密码未设置或仍为开发默认值（IV_DB_PASSWORD）");
        }
        requiresValue(env, "spring.security.oauth2.client.registration.github.client-id",
                "placeholder", "GitHub OAuth client-id（IV_GITHUB_CLIENT_ID）", problems);
        requiresValue(env, "spring.security.oauth2.client.registration.github.client-secret",
                "placeholder", "GitHub OAuth client-secret（IV_GITHUB_CLIENT_SECRET）", problems);
        rejectsLocalhost(env.getProperty("iv.cors.origins"), "CORS Origin 白名单（IV_CORS_ORIGINS）", problems);
        rejectsLocalhost(env.getProperty("iv.auth.login-success-redirect"),
                "登录成功回跳地址（IV_LOGIN_SUCCESS_REDIRECT）", problems);
        String adminIds = env.getProperty("iv.auth.admin-github-ids");
        if (adminIds == null || adminIds.isBlank()) {
            problems.add("管理员白名单为空（IV_ADMIN_GITHUB_IDS）——生产必须有可裁决的管理员");
        }
        return problems;
    }

    private static void requiresValue(Environment env, String key, String placeholder, String label,
                                      List<String> problems) {
        String value = env.getProperty(key);
        if (value == null || value.isBlank() || placeholder.equals(value)) {
            problems.add(label + " 未设置或仍为占位符");
        }
    }

    private static void rejectsLocalhost(String value, String label, List<String> problems) {
        if (value == null || value.isBlank()
                || value.contains("localhost") || value.contains("127.0.0.1")) {
            problems.add(label + " 未设置或仍指向 localhost");
        }
    }
}
