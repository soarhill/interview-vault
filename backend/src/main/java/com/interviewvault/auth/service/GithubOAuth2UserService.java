package com.interviewvault.auth.service;

import java.util.Set;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.OAuth2User;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.interviewvault.auth.entity.User;
import com.interviewvault.auth.enums.UserRole;
import com.interviewvault.auth.repository.UserMapper;

/**
 * GitHub 登录落地：githubId 识别本站用户（首次建户），githubLogin/avatar 仅展示。
 * 角色由 ADMIN_GITHUB_IDS 白名单决定——每次登录校正（命中 ADMIN、未命中 USER，含降级），
 * 白名单是唯一真相，不建设管理员管理界面；已登录会话的撤权由 AdminWhitelist 在请求期裁决。
 */
public class GithubOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    private final OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate;
    private final UserMapper users;
    private final AdminWhitelist adminWhitelist;

    public GithubOAuth2UserService(OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate,
                                   UserMapper users, AdminWhitelist adminWhitelist) {
        this.delegate = delegate;
        this.users = users;
        this.adminWhitelist = adminWhitelist;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) {
        OAuth2User githubUser = delegate.loadUser(userRequest);
        Long githubId = ((Number) githubUser.getAttributes().get("id")).longValue();
        String login = String.valueOf(githubUser.getAttributes().get("login"));
        Object avatarAttr = githubUser.getAttributes().get("avatar_url");
        String avatarUrl = avatarAttr == null ? null : String.valueOf(avatarAttr);
        UserRole role = adminWhitelist.contains(githubId) ? UserRole.ADMIN : UserRole.USER;

        User user = users.selectOne(new LambdaQueryWrapper<User>().eq(User::getGithubId, githubId));
        if (user == null) {
            user = new User(githubId, login, avatarUrl, role);
            users.insert(user);
        } else {
            user.applyProfile(login, avatarUrl, role);
            users.updateById(user);
        }

        GrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + role.name());
        return new AppOAuth2User(user.getId(), githubUser.getAttributes(), Set.of(authority));
    }
}
