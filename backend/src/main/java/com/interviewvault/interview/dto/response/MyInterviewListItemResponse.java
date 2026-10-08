package com.interviewvault.interview.dto.response;

import java.time.LocalDate;
import java.time.OffsetDateTime;

/** 「我的投稿」列表项：计数与能力位由服务端计算，前端不自行推导。 */
public record MyInterviewListItemResponse(
        Long id,
        CatalogSelectionView company,
        CatalogSelectionView position,
        String department,
        String recruitType,
        String status,
        Long version,
        String rejectionReason,
        LocalDate firstInterviewDate,
        String firstInterviewDatePrecision,
        int roundCount,
        int questionCount,
        boolean hasPendingChangeRequest,
        OffsetDateTime createTime,
        OffsetDateTime updateTime,
        ActionAvailability actions) {
}
