package com.interviewvault.auth.contract;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.interviewvault.auth.config.SecurityConfig;
import com.interviewvault.auth.controller.AuthController;
import com.interviewvault.auth.repository.UserMapper;

/** 安全契约：401/403 JSON 语义、CSRF Cookie 机制、me 只认登录态。 */
@WebMvcTest(controllers = AuthController.class)
@Import(SecurityConfig.class)
class AuthContractTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private UserMapper users;

    @Test
    void anonymous_me_yields_401_with_auth_required_code() throws Exception {
        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"))
                .andExpect(jsonPath("$.message").value("未登录"));
    }

    @Test
    void anonymous_admin_paths_yields_401_not_403() throws Exception {
        // 未登录访问管理端点：先认证后授权（401 而非 403）
        mvc.perform(get("/api/v1/admin/reviews/interviews"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    @Test
    void logged_in_me_returns_user_summary() throws Exception {
        mvc.perform(get("/api/v1/auth/me").with(oauth2Login()
                        .attributes(attrs -> {
                            attrs.put("id", 424242424L);
                            attrs.put("login", "soarhill");
                            attrs.put("avatar_url", "https://avatar");
                        })
                        .authorities(new org.springframework.security.core.authority
                                .SimpleGrantedAuthority("ROLE_USER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.githubLogin").value("soarhill"))
                .andExpect(jsonPath("$.data.role").value("USER"));
    }

    @Test
    void csrf_endpoint_sets_xsrf_token_cookie() throws Exception {
        MvcResult result = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.headerName").value("X-XSRF-TOKEN"))
                .andExpect(jsonPath("$.data.token").isNotEmpty())
                .andReturn();
        boolean hasCookie = result.getResponse().getCookies().length > 0
                && "XSRF-TOKEN".equals(result.getResponse().getCookies()[0].getName());
        org.assertj.core.api.Assertions.assertThat(hasCookie).isTrue();
    }

    @Test
    void write_without_csrf_token_yields_403() throws Exception {
        mvc.perform(post("/api/v1/auth/logout"))
                .andExpect(status().isForbidden());
    }

    @Test
    void logout_with_csrf_but_anonymous_yields_401() throws Exception {
        mvc.perform(post("/api/v1/auth/logout")
                        .with(org.springframework.security.test.web.servlet.request
                                .SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }
}
