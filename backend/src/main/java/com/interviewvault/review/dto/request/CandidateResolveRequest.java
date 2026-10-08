package com.interviewvault.review.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 候选项处理（api-design「处理 Candidate」）：USE_EXISTING 需 targetId；
 * CREATE_NEW 需 name；新建岗位带 categoryName（方向目录不存在时按规范化名新建）。
 */
public record CandidateResolveRequest(
        @NotNull Long version,
        @NotNull String action,
        Long targetId,
        @Size(max = 100) String name,
        @Size(max = 50) String categoryName) {

    public static final String USE_EXISTING = "USE_EXISTING";
    public static final String CREATE_NEW = "CREATE_NEW";
    public static final String REMOVE = "REMOVE";
}
