package com.interviewvault.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.auth.dto.response.CsrfResponse;
import com.interviewvault.auth.dto.response.CurrentUserResponse;
import com.interviewvault.auth.service.AppOAuth2User;
import com.interviewvault.common.response.Result;
import com.interviewvault.common.exception.BizException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRepository;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final CsrfTokenRepository csrfTokenRepository;

    public AuthController(CsrfTokenRepository csrfTokenRepository) {
        this.csrfTokenRepository = csrfTokenRepository;
    }

    /** 发起 GitHub OAuth：重定向到 Spring Security 的授权端点（含 state 生成）。 */
    @GetMapping("/github")
    public ResponseEntity<Void> github() {
        return ResponseEntity.status(302)
                .location(java.net.URI.create("/oauth2/authorization/github"))
                .build();
    }

    /** 当前用户；未登录由安全链路统一 401 + AUTH_REQUIRED。 */
    @GetMapping("/me")
    public Result<CurrentUserResponse> me(@org.springframework.security.core.annotation.AuthenticationPrincipal
                                          OAuth2User principal) {
        Object userId = principal.getAttributes().get(AppOAuth2User.ATTR_USER_ID);
        String role = principal.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority())) ? "ADMIN" : "USER";
        return Result.ok(new CurrentUserResponse(
                userId == null ? null : ((Number) userId).longValue(),
                String.valueOf(principal.getAttributes().get("login")),
                java.util.Objects.toString(principal.getAttributes().get("avatar_url"), null),
                role));
    }

    /** CSRF 初始化 / 刷新：显式生成并保存 token（写 XSRF-TOKEN Cookie，前端读 Cookie 放 Header）。 */
    @GetMapping("/csrf")
    public Result<CsrfResponse> csrf(HttpServletRequest request, HttpServletResponse response) {
        CsrfToken token = csrfTokenRepository.generateToken(request);
        csrfTokenRepository.saveToken(token, request, response);
        return Result.ok(new CsrfResponse(token.getHeaderName(), token.getToken()));
    }

    /** 退出：失效会话；需登录态 + CSRF Token（api-design「退出」）。 */
    @PostMapping("/logout")
    public Result<Void> logout(Authentication authentication,
                               HttpServletRequest request, HttpServletResponse response) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new BizException("AUTH_REQUIRED", org.springframework.http.HttpStatus.UNAUTHORIZED, "未登录");
        }
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return Result.ok(null);
    }
}
