package com.interviewvault.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewvault.auth.repository.UserMapper;
import com.interviewvault.auth.service.AdminWhitelist;
import com.interviewvault.auth.service.GithubOAuth2UserService;
import com.interviewvault.common.response.Result;

import jakarta.servlet.http.HttpServletResponse;

/**
 * 会话与安全（协议见 api-design §6）：
 * - HttpSession + JSESSIONID（HttpOnly；生产由部署设 Secure；SameSite=Lax）
 * - CSRF：XSRF-TOKEN Cookie（前端可读）→ X-XSRF-TOKEN Header；写请求必须携带
 * - OAuth state 由 Spring Security 生成并校验；登录成功重定向回前端
 * - CORS：本地跨端口时放行明确前端 Origin 且允许 credentials；生产走 Nginx 同源
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final ObjectMapper objectMapper;
    private final String loginSuccessRedirect;

    public SecurityConfig(ObjectMapper objectMapper,
                          @Value("${iv.auth.login-success-redirect:http://localhost:3000}")
                          String loginSuccessRedirect) {
        this.objectMapper = objectMapper;
        this.loginSuccessRedirect = loginSuccessRedirect;
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http, GithubOAuth2UserService githubUserService,
                                    CsrfTokenRepository csrfTokenRepository, AdminWhitelist adminWhitelist)
            throws Exception {
        CsrfTokenRequestAttributeHandler csrfRequestHandler = new CsrfTokenRequestAttributeHandler();
        csrfRequestHandler.setCsrfRequestAttributeName(null);

        http.cors(Customizer.withDefaults())
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository)
                        .csrfTokenRequestHandler(csrfRequestHandler))
                .authorizeHttpRequests(auth -> auth
                        // OAuth 流程端点
                        .requestMatchers("/oauth2/**", "/login/**").permitAll()
                        // 公开 GET 读接口（公开 API 均为 GET）
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/interviews/**", "/api/v1/interview-filters",
                                "/api/v1/companies", "/api/v1/positions", "/api/v1/tags",
                                "/api/v1/position-categories",
                                "/api/v1/auth/github", "/api/v1/auth/github/callback",
                                "/api/v1/auth/csrf", "/api/v1/cheers").permitAll()
                        // 写接口：登出放行到过滤器链（CSRF 仍生效），其余写操作都需要登录
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout",
                                "/api/v1/cheers").permitAll()
                        .requestMatchers("/api/v1/auth/me").authenticated()
                        .requestMatchers("/api/v1/me/**").authenticated()
                        // 管理接口：ROLE_ADMIN 且（配置白名单后）GitHub ID 仍在白名单——撤权即时生效
                        .requestMatchers("/api/v1/admin/**").access(adminAccess(adminWhitelist))
                        // 接口文档（开发期）
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                        // 未定义路径一律拒绝，防止未来误暴露
                        .anyRequest().denyAll())
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint((request, response, ex) ->
                                writeJson(response, HttpServletResponse.SC_UNAUTHORIZED, "AUTH_REQUIRED", "未登录"))
                        .accessDeniedHandler((request, response, ex) ->
                                writeJson(response, HttpServletResponse.SC_FORBIDDEN, "ACCESS_DENIED", "无权限")))
                .oauth2Login(login -> login
                        // 回调监听地址与 ClientRegistration 的 redirect-uri 保持一致
                        // （自定义 redirect-uri 不会自动改变过滤器监听路径，必须显式声明）
                        .loginProcessingUrl("/api/v1/auth/github/callback")
                        .userInfoEndpoint(userInfo -> userInfo.userService(githubUserService))
                        .successHandler((request, response, authentication) ->
                                response.sendRedirect(loginSuccessRedirect))
                        .failureHandler((request, response, exception) ->
                                response.sendRedirect(loginSuccessRedirect + "?login=failed")));
        return http.build();
    }

    /** 白名单装配（auth 域内唯一入口，登录角色与请求期撤权共用）。 */
    @Bean
    AdminWhitelist adminWhitelist(org.springframework.core.env.Environment environment) {
        return new AdminWhitelist(environment);
    }

    /** GitHub 用户装配：githubId 建户/识别，角色按 ADMIN_GITHUB_IDS 白名单每次登录校正。 */
    @Bean
    GithubOAuth2UserService githubOAuth2UserService(
            OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate,
            UserMapper users, AdminWhitelist adminWhitelist) {
        return new GithubOAuth2UserService(delegate, users, adminWhitelist);
    }

    /**
     * /api/v1/admin/** 授权裁决：会话带 ROLE_ADMIN 且（白名单非空时）主体 GitHub 数字 ID
     * 仍在新白名单内。会话中的角色是登录时的快照——白名单移除某人并重启后，
     * 其 JDBC Session 里的 ROLE_ADMIN 不再算数，撤权立即生效。
     */
    private static AuthorizationManager<RequestAuthorizationContext> adminAccess(AdminWhitelist whitelist) {
        return (authenticationSupplier, context) -> {
            org.springframework.security.core.Authentication authentication = authenticationSupplier.get();
            if (authentication == null || authentication.getAuthorities().stream()
                    .noneMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) {
                return new AuthorizationDecision(false);
            }
            if (authentication.getPrincipal() instanceof OAuth2User principal
                    && principal.getAttributes().get("id") instanceof Number githubId
                    && !whitelist.isEmpty() && !whitelist.contains(githubId.longValue())) {
                return new AuthorizationDecision(false);
            }
            return new AuthorizationDecision(true);
        };
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${iv.cors.origins:http://localhost:3000}") String origins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        for (String origin : origins.split(",")) {
            config.addAllowedOrigin(origin.trim());
        }
        config.addAllowedMethod("*");
        config.addAllowedHeader("*");
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /** CSRF Cookie 仓库（供安全链与 /auth/csrf 显式初始化共用同一来源）。 */
    @Bean
    CsrfTokenRepository csrfTokenRepository() {
        return CookieCsrfTokenRepository.withHttpOnlyFalse();
    }

    /** DefaultOAuth2UserService 显式成 Bean，供 GithubOAuth2UserService 委托。 */
    @Bean
    OAuth2UserService<OAuth2UserRequest, OAuth2User> defaultOAuth2UserService() {
        return new DefaultOAuth2UserService();
    }

    private void writeJson(HttpServletResponse response, int status, String code, String message)
            throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), Result.error(code, message));
    }
}
