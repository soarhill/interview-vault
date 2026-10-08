package com.interviewvault.review.dto.request;

import java.util.List;

import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.interview.enums.RecruitType;

import jakarta.validation.constraints.NotNull;

/**
 * 管理员直接修改已发布面经（api-design「管理员读取 / 直接修改已发布面经」）：
 * 与普通投稿不同——不得创建 Candidate，proposedName 由后端在治理事务内直接创建 / 复用正式目录；
 * sourceUrls 为完整来源列表（历史多来源安全编辑）；迁移只读字段不在请求中，由服务端 preserve。
 */
public record AdminPublishedInterviewUpdateRequest(
        @NotNull Long version,
        SelectionInput company,
        SelectionInput position,
        String department,
        RecruitType recruitType,
        List<Long> tagIds,
        List<String> proposedTags,
        List<RoundInput> rounds,
        List<String> sourceUrls) {

    public List<RoundInput> safeRounds() {
        return rounds == null ? List.of() : rounds;
    }

    public List<Long> safeTagIds() {
        return tagIds == null ? List.of() : tagIds;
    }

    public List<String> safeProposedTags() {
        return proposedTags == null ? List.of() : proposedTags;
    }

    public List<String> safeSourceUrls() {
        return sourceUrls == null ? List.of() : sourceUrls;
    }
}
