package com.interviewvault.review.dto.response;

/** 直改编辑基线：存在 PENDING 申请时仍 200，但 canEditDirectly=false（api-design「管理员读取 / 直接修改已发布面经」）。 */
public record AdminPublishedEditBaselineResponse(
        AdminPublishedInterviewResponse interview,
        PendingChangeRequestRef pendingChangeRequest,
        Actions actions) {

    public record PendingChangeRequestRef(Long id, String type, Long baseVersion,
                                          java.time.OffsetDateTime updateTime) {
    }

    public record Actions(boolean canEditDirectly) {
    }
}
