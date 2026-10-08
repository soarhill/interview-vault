package com.interviewvault.interview.enums;

/** 面经生命周期；不叠加 isPublished / deleted 等布尔状态。 */
public enum InterviewStatus {
    DRAFT,
    PENDING_REVIEW,
    PUBLISHED,
    REJECTED,
    REMOVED
}
