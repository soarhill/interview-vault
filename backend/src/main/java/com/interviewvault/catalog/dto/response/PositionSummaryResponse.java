package com.interviewvault.catalog.dto.response;

/** 岗位视图（公开列表 / 详情使用）；category 为筛选大类。 */
public record PositionSummaryResponse(Long id, String name, String category) {
}
