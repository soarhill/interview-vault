package com.interviewvault.review.dto.response;

import java.time.OffsetDateTime;

import com.fasterxml.jackson.databind.JsonNode;

/** 提交快照视图：content 为 JSONB 反序列化后的对象，不再把 JSON 字符串塞给前端。 */
public record SnapshotView(Long id, OffsetDateTime createTime, JsonNode content) {
}
