package com.interviewvault.review.dto.request;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 创建 / 覆盖变更申请（api-design「创建或覆盖 ChangeRequest」）：UPDATE 必须携带完整目标版本 payload；
 * DELETE 只带 reason。baseVersion 必须等于当前正式 version。
 */
public record ChangeRequestUpsertRequest(
        @NotNull String type,
        @NotNull Long baseVersion,
        JsonNode payload,
        @Size(max = 500) String reason) {

    public static final String TYPE_UPDATE = "UPDATE";
    public static final String TYPE_DELETE = "DELETE";
}
