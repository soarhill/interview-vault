package com.interviewvault.review.dto.response;

import com.interviewvault.review.dto.response.AdminPublishedInterviewResponse;

/** 管理员申请详情：当前正式版本 + 申请目标版本同屏对比（api-design「管理员变更申请详情」）。 */
public record AdminChangeRequestDetailResponse(
        ChangeRequestView changeRequest,
        AdminPublishedInterviewResponse currentInterview,
        AuthorRef requester) {
}
