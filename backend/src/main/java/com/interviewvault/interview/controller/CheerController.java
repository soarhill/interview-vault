package com.interviewvault.interview.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.common.response.Result;
import com.interviewvault.interview.service.CheerService;

import jakarta.servlet.http.HttpServletRequest;

/** 页尾祝福条「加油一下」：公开接口，游客可点（按 IP 限流）；写请求走 CSRF。 */
@RestController
@RequestMapping("/api/v1/cheers")
public class CheerController {

    private final CheerService cheers;

    public CheerController(CheerService cheers) {
        this.cheers = cheers;
    }

    public record CheerCountResponse(long count) {
    }

    @GetMapping
    public Result<CheerCountResponse> count() {
        return Result.ok(new CheerCountResponse(cheers.count()));
    }

    @PostMapping
    public Result<CheerCountResponse> cheer(HttpServletRequest request) {
        return Result.ok(new CheerCountResponse(cheers.cheer(request.getRemoteAddr())));
    }

    // 客户端地址由容器的可信代理配置解析；不能再次信任客户端可伪造的原始 XFF 首段。
}
