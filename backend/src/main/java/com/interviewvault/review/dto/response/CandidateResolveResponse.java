package com.interviewvault.review.dto.response;

import java.time.OffsetDateTime;

/** resolve 成功响应：前端必须用新 version 继续后续 resolve / publish（api-design「InterviewMutationResponse」）。 */
public record CandidateResolveResponse(Long resolvedCandidateId, InterviewVersionView interview) {

    public record InterviewVersionView(Long id, String status, Long version, OffsetDateTime updateTime) {
    }
}
