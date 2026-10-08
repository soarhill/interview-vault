package com.interviewvault.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ProductionConfigGuardTest {

    private MockEnvironment base() {
        return new MockEnvironment()
                .withProperty("spring.datasource.password", "a-real-secret")
                .withProperty("spring.security.oauth2.client.registration.github.client-id", "iv-client-id")
                .withProperty("spring.security.oauth2.client.registration.github.client-secret", "iv-client-secret")
                .withProperty("iv.cors.origins", "https://miangeoffer.example.com")
                .withProperty("iv.auth.login-success-redirect", "https://miangeoffer.example.com/login")
                .withProperty("iv.auth.admin-github-ids", "424242424");
    }

    @Test
    void complete_production_config_passes() {
        assertThat(ProductionConfigGuard.inspect(base())).isEmpty();
    }

    @Test
    void dev_defaults_and_placeholders_are_rejected() {
        MockEnvironment env = base()
                .withProperty("spring.datasource.password", "dev")
                .withProperty("spring.security.oauth2.client.registration.github.client-id", "placeholder")
                .withProperty("spring.security.oauth2.client.registration.github.client-secret", "placeholder")
                .withProperty("iv.cors.origins", "http://localhost:3000")
                .withProperty("iv.auth.login-success-redirect", "http://localhost:3000")
                .withProperty("iv.auth.admin-github-ids", "");
        assertThat(ProductionConfigGuard.inspect(env)).hasSize(6);
    }

    @Test
    void blank_secrets_also_fail() {
        MockEnvironment env = base().withProperty("spring.datasource.password", " ");
        assertThat(ProductionConfigGuard.inspect(env))
                .anyMatch(problem -> problem.contains("IV_DB_PASSWORD"));
    }
}
