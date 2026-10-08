package com.interviewvault.catalog.dto.response;

import java.util.List;

/** 目录查询响应（companies / positions / tags 共用 items 结构，无分页）。 */
public record CatalogListResponse<T>(List<T> items) {

    public static <T> CatalogListResponse<T> of(List<T> items) {
        return new CatalogListResponse<>(items);
    }
}
