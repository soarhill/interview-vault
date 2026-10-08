package com.interviewvault.auth.service;

import java.io.Serializable;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * 本站会话主体：保留 GitHub 原始 attributes（id / login / avatar_url 等），
 * 附加 userId（app_user.id）。角色来自白名单裁决，表现为 ROLE_USER / ROLE_ADMIN。
 */
public class AppOAuth2User implements OAuth2User, Serializable {

    public static final String ATTR_USER_ID = "userId";

    private final Long userId;
    private final Map<String, Object> attributes;
    private final Set<GrantedAuthority> authorities;

    public AppOAuth2User(Long userId, Map<String, Object> attributes, Set<GrantedAuthority> authorities) {
        this.userId = userId;
        this.attributes = new LinkedHashMap<>(attributes);
        this.attributes.put(ATTR_USER_ID, userId);
        this.authorities = authorities;
    }

    public Long getUserId() {
        return userId;
    }

    public String getGithubLogin() {
        return String.valueOf(attributes.get("login"));
    }

    public String getAvatarUrl() {
        Object avatar = attributes.get("avatar_url");
        return avatar == null ? null : String.valueOf(avatar);
    }

    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getName() {
        return String.valueOf(attributes.get("id"));
    }
}
