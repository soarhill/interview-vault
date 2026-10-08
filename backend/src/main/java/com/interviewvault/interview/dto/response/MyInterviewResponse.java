package com.interviewvault.interview.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

/** canonical 聚合视图：保存成功后直接作为表单新基线（含新建子项真实 id），前端无需再 GET。 */
public record MyInterviewResponse(
        Long id,
        String status,
        Long version,
        CatalogSelectionView company,
        CatalogSelectionView position,
        String department,
        String recruitType,
        List<TagSelectionView> tags,
        List<InterviewRoundResponse> rounds,
        String sourceUrl,
        OffsetDateTime updateTime) {
}
