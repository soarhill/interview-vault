package com.interviewvault.interview.dto.request;

/** 公司 / 岗位选择：existingId 与 proposedName 二选一；草稿阶段允许都为空。 */
public record SelectionInput(Long existingId, String proposedName) {

    public boolean hasExisting() {
        return existingId != null;
    }

    public boolean hasProposed() {
        return proposedName != null && !proposedName.isBlank();
    }

    public boolean empty() {
        return existingId == null && !hasProposed();
    }
}
