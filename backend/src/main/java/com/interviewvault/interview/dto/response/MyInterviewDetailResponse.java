package com.interviewvault.interview.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

/** 投稿编辑页完整基线：canonical 聚合 + 审计字段 + 服务端能力位。 */
public record MyInterviewDetailResponse(
        Long id,
        String status,
        Long version,
        String rejectionReason,
        CatalogSelectionView company,
        CatalogSelectionView position,
        String department,
        String recruitType,
        List<TagSelectionView> tags,
        List<InterviewRoundResponse> rounds,
        String sourceUrl,
        OffsetDateTime createTime,
        OffsetDateTime updateTime,
        ActionAvailability actions) {
}
