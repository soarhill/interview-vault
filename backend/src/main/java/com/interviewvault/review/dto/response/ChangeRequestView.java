package com.interviewvault.review.dto.response;

import java.time.OffsetDateTime;

import com.fasterxml.jackson.databind.JsonNode;

/** 变更申请完整视图：payload 为反序列化后的目标版本对象。 */
public record ChangeRequestView(
        Long id,
        Long interviewId,
        String type,
        String status,
        Long baseVersion,
        Long requestVersion,
        JsonNode payload,
        String reason,
        OffsetDateTime createTime,
        OffsetDateTime updateTime) {
}
