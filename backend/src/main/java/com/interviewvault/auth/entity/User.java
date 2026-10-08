package com.interviewvault.auth.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.interviewvault.auth.enums.UserRole;

/**
 * 本站用户。githubId 是稳定外部身份（唯一）；githubLogin 仅展示，可变化。
 * V1 不保存密码，不长期保存 GitHub Access Token。
 */
@TableName("app_user")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long githubId;
    private String githubLogin;
    private String avatarUrl;
    private UserRole role;

    protected User() {
    }

    public User(Long githubId, String githubLogin, String avatarUrl, UserRole role) {
        this.githubId = githubId;
        this.githubLogin = githubLogin;
        this.avatarUrl = avatarUrl;
        this.role = role;
    }

    public Long getId() {
        return id;
    }

    public Long getGithubId() {
        return githubId;
    }

    public String getGithubLogin() {
        return githubLogin;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public UserRole getRole() {
        return role;
    }

    /** 每次登录刷新展示信息；角色由 ADMIN_GITHUB_IDS 白名单决定（登录即校正，含降级）。 */
    public void applyProfile(String githubLogin, String avatarUrl, UserRole role) {
        this.githubLogin = githubLogin;
        this.avatarUrl = avatarUrl;
        this.role = role;
    }
}
