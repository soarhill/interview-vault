package com.interviewvault.auth.dto.response;

public record CurrentUserResponse(Long id, String githubLogin, String avatarUrl, String role) {
}
