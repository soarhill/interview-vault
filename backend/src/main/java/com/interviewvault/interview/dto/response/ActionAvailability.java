package com.interviewvault.interview.dto.response;

/**
 * 服务端计算的能力位（api-design「获取自己的投稿」）：前端不允许只凭 status 猜。
 * canDeleteDraft ≠ status==DRAFT：被拒后回到 DRAFT 的投稿已有快照，不可物理删除。
 */
public record ActionAvailability(
        boolean canEdit,
        boolean canSubmit,
        boolean canDeleteDraft,
        boolean canRequestChange,
        boolean canRequestDelete) {

    public static final ActionAvailability NONE = new ActionAvailability(false, false, false, false, false);
}
