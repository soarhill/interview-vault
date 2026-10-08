package com.interviewvault.interview.dto.request;

import java.util.List;

import com.interviewvault.interview.enums.RecruitType;

import jakarta.validation.constraints.NotNull;

/**
 * 聚合保存请求（普通用户保存投稿与管理员编辑待审核内容共用，见api-design「InterviewUpsertRequest」）。
 * 迁移只读字段（originalPositionName / inferredPositionName / note）不在此请求中，
 * 由服务端从当前聚合 preserve。除 version 外允许不完整——草稿语义。
 */
public record InterviewUpsertRequest(
        @NotNull Long version,
        SelectionInput company,
        SelectionInput position,
        String department,
        RecruitType recruitType,
        List<Long> tagIds,
        List<String> proposedTags,
        List<RoundInput> rounds,
        String sourceUrl) {

    public List<RoundInput> safeRounds() {
        return rounds == null ? List.of() : rounds;
    }

    public List<Long> safeTagIds() {
        return tagIds == null ? List.of() : tagIds;
    }

    public List<String> safeProposedTags() {
        return proposedTags == null ? List.of() : proposedTags;
    }
}
