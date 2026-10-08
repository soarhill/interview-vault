package com.interviewvault.review.dto.response;

import java.time.OffsetDateTime;

/** 管理员变更申请列表项：内嵌面经摘要与申请人。 */
public record AdminChangeRequestListItemResponse(
        Long id,
        String type,
        String status,
        Long baseVersion,
        Long requestVersion,
        InterviewSummary interview,
        AuthorRef requester,
        String reason,
        OffsetDateTime createTime,
        OffsetDateTime updateTime) {

    public record InterviewSummary(Long id, String companyName, String positionName,
                                   String status, Long version) {
    }
}
