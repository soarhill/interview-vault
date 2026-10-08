package com.interviewvault.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.interviewvault.auth.entity.User;
import com.interviewvault.auth.enums.UserRole;
import com.interviewvault.auth.repository.UserMapper;

import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;

class GithubOAuth2UserServiceTest {

    private final OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate = mock(OAuth2UserService.class);
    private final UserMapper users = mock(UserMapper.class);

    private OAuth2User githubUser(long githubId, String login) {
        Set<GrantedAuthority> authorities = Set.of(new SimpleGrantedAuthority("SCOPE_read:user"));
        return new DefaultOAuth2User(authorities,
                Map.of("id", githubId, "login", login, "avatar_url", "https://avatar"),
                "id");
    }

    private GithubOAuth2UserService service(String adminIds) {
        Environment environment = new MockEnvironment()
                .withProperty("iv.auth.admin-github-ids", adminIds);
        return new GithubOAuth2UserService(delegate, users, new AdminWhitelist(environment));
    }

    @Test
    void first_login_creates_user_with_role_from_whitelist() {
        given(delegate.loadUser(any())).willReturn(githubUser(424242424L, "soarhill"));
        given(users.selectOne(any())).willReturn(null);

        OAuth2User result = service("424242424").loadUser(mock(OAuth2UserRequest.class));

        verify(users).insert(any(User.class));
        assertThat(result.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_ADMIN");
        assertThat(result.getAttributes()).containsEntry("userId", null);
        // userId 由数据库回填后进入 attributes（此处 insert mock 未回填 id，仅验证角色链路）
    }

    @Test
    void whitelist_miss_creates_plain_user() {
        given(delegate.loadUser(any())).willReturn(githubUser(42L, "someone"));
        given(users.selectOne(any())).willReturn(null);

        OAuth2User result = service("424242424").loadUser(mock(OAuth2UserRequest.class));

        assertThat(result.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_USER");
    }

    @Test
    void existing_user_role_is_corrected_on_every_login_including_demotion() {
        given(delegate.loadUser(any())).willReturn(githubUser(424242424L, "renamed-login"));
        User existing = new User(424242424L, "old-login", "https://old", UserRole.ADMIN);
        existing.applyProfile("old-login", "https://old", UserRole.ADMIN);
        given(users.selectOne(any())).willReturn(existing);

        // 白名单移除后再登录：降级为 USER，展示信息刷新
        OAuth2User result = service("").loadUser(mock(OAuth2UserRequest.class));

        verify(users).updateById(existing);
        assertThat(existing.getGithubLogin()).isEqualTo("renamed-login");
        assertThat(existing.getRole()).isEqualTo(UserRole.USER);
        assertThat(result.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_USER");
    }
}
