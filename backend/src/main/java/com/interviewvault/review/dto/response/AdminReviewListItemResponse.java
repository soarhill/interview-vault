package com.interviewvault.review.dto.response;

import java.time.OffsetDateTime;

import com.interviewvault.interview.dto.response.CatalogSelectionView;

/** 审核列表项：submitTime 取当前审核周期最近一次快照时间。 */
public record AdminReviewListItemResponse(
        Long id,
        CatalogSelectionView company,
        CatalogSelectionView position,
        AuthorRef author,
        String status,
        Long version,
        int candidateCount,
        OffsetDateTime submitTime,
        OffsetDateTime updateTime) {
}
