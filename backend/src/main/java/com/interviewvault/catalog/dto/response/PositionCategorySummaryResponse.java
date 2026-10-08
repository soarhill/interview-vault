package com.interviewvault.catalog.dto.response;

/** 岗位方向视图（首页筛选 / 岗位联想附带）；方向是管理员可扩展目录。 */
public record PositionCategorySummaryResponse(Long id, String name, Integer sortOrder) {
}
