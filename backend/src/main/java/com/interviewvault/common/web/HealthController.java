package com.interviewvault.common.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 容器与反代共用的最小探活端点：只报告进程活着，不暴露版本、配置或依赖细节。
 * 供 Compose healthcheck 与上线检查单使用；无需引入 actuator 全套管理端点。
 */
@RestController
@RequestMapping("/api/v1/health")
public class HealthController {

    @GetMapping
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
