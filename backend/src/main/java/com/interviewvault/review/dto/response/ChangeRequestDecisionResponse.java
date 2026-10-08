package com.interviewvault.review.dto.response;

import java.time.OffsetDateTime;

/** 批准 / 拒绝响应（api-design「批准 / 拒绝」）：拒绝不修改正式 InterviewRecord，version 不递增。 */
public record ChangeRequestDecisionResponse(
        ChangeRequestRef changeRequest,
        InterviewRef interview) {

    public record ChangeRequestRef(Long id, String status, OffsetDateTime reviewTime) {
    }

    public record InterviewRef(Long id, String status, Long version) {
    }
}
