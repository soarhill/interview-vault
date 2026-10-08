package com.interviewvault.auth.service;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.core.env.Environment;

/**
 * 管理员白名单（iv.auth.admin-github-ids，逗号分隔 GitHub 数字 ID）。
 * 每次调用现读 Environment 而不是启动时固化：部署换白名单后，重启进程即以新名单裁决
 * 每个管理员请求——旧 Session 里序列化的 ROLE_ADMIN 立即失效（撤权不等会话过期）。
 * 名单为空 = 未配置运行时撤权（此时登录也不会产生 ADMIN，会话角色即最终裁决）。
 * 装配在 SecurityConfig（@Bean）：WebMvcTest 切片显式 import SecurityConfig 时可一并取得。
 */
public class AdminWhitelist {

    private final Environment environment;

    public AdminWhitelist(Environment environment) {
        this.environment = environment;
    }

    public boolean isEmpty() {
        return parse().isEmpty();
    }

    public boolean contains(long githubId) {
        return parse().contains(githubId);
    }

    private Set<Long> parse() {
        String raw = environment.getProperty("iv.auth.admin-github-ids", "");
        if (raw.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(AdminWhitelist::toLongOrNull)
                .filter(id -> id != null)
                .collect(Collectors.toUnmodifiableSet());
    }

    private static Long toLongOrNull(String value) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
