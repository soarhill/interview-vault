package com.interviewvault.review.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

import com.interviewvault.interview.dto.response.InterviewRoundResponse;

/** 已发布面经的治理视图：sources[] 完整多来源 + 只读历史真实性字段（api-design「管理员读取 / 直接修改已发布面经」）。 */
public record AdminPublishedInterviewResponse(
        Long id,
        String status,
        Long version,
        CompanyRef company,
        String department,
        PositionRef position,
        String recruitType,
        List<TagRef> tags,
        String originalPositionName,
        String inferredPositionName,
        String note,
        List<InterviewRoundResponse> rounds,
        List<SourceRef> sources,
        OffsetDateTime updateTime) {

    public record CompanyRef(Long id, String name) {
    }

    public record PositionRef(Long id, String name, String category) {
    }

    public record TagRef(Long id, String name) {
    }

    public record SourceRef(Long id, String url) {
    }
}
