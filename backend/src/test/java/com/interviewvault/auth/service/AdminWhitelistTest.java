package com.interviewvault.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class AdminWhitelistTest {

    private AdminWhitelist whitelist(String raw) {
        return new AdminWhitelist(new MockEnvironment()
                .withProperty("iv.auth.admin-github-ids", raw));
    }

    @Test
    void parses_comma_separated_ids_ignoring_blank_and_malformed() {
        AdminWhitelist w = whitelist(" 424242424 , 42 ,, not-a-number ");
        assertThat(w.isEmpty()).isFalse();
        assertThat(w.contains(424242424L)).isTrue();
        assertThat(w.contains(42L)).isTrue();
        assertThat(w.contains(7L)).isFalse();
    }

    @Test
    void blank_or_missing_means_unconfigured() {
        assertThat(whitelist("").isEmpty()).isTrue();
        assertThat(new AdminWhitelist(new MockEnvironment()).isEmpty()).isTrue();
    }

    @Test
    void reflects_runtime_property_change_without_reconstruction() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("iv.auth.admin-github-ids", "1");
        AdminWhitelist w = new AdminWhitelist(environment);
        assertThat(w.contains(1L)).isTrue();

        // 模拟重启换白名单：同一进程内配置源变化，裁决立即跟随
        environment.setProperty("iv.auth.admin-github-ids", "2");
        assertThat(w.contains(1L)).isFalse();
        assertThat(w.contains(2L)).isTrue();
    }
}
