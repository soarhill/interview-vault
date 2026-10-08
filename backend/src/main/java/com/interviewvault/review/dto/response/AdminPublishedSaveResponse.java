package com.interviewvault.review.dto.response;

import java.util.List;

import com.interviewvault.common.response.Warning;

/** 管理员直改保存响应：canonical 已发布聚合（sources[] + 只读历史字段）。 */
public record AdminPublishedSaveResponse(AdminPublishedInterviewResponse interview, List<Warning> warnings) {
}
