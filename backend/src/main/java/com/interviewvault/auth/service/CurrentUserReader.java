package com.interviewvault.auth.service;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

import com.interviewvault.auth.enums.UserRole;
import com.interviewvault.common.exception.BizException;

/**
 * 会话当前用户读取（生产主体为 AppOAuth2User；测试可用任意携带 userId 属性的
 * OAuth2User 模拟）。Spring Security 解决「你是什么身份」，
 * Service 层用本组件拿到当前用户后再做资源级校验（数据归属 / 状态可操作性）。
 */
@Component
public class CurrentUserReader {

    public record CurrentUser(Long id, Long githubId, UserRole role) {
        public boolean isAdmin() {
            return role == UserRole.ADMIN;
        }
    }

    /** 未登录抛 AUTH_REQUIRED（401）。 */
    public CurrentUser require() {
        CurrentUser user = get();
        if (user == null) {
            throw new BizException("AUTH_REQUIRED", org.springframework.http.HttpStatus.UNAUTHORIZED, "未登录");
        }
        return user;
    }

    /** 匿名返回 null。 */
    public CurrentUser get() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof OAuth2User principal
                && principal.getAttributes().get(AppOAuth2User.ATTR_USER_ID) instanceof Number userId) {
            UserRole role = authentication.getAuthorities().stream()
                    .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority())) ? UserRole.ADMIN : UserRole.USER;
            Long githubId = principal.getAttributes().get("id") instanceof Number n ? n.longValue() : null;
            return new CurrentUser(userId.longValue(), githubId, role);
        }
        return null;
    }
}
