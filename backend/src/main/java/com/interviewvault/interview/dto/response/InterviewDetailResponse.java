package com.interviewvault.interview.dto.response;

import java.time.LocalDate;
import java.util.List;

import com.interviewvault.catalog.dto.response.CompanySummaryResponse;
import com.interviewvault.catalog.dto.response.PositionSummaryResponse;
import com.interviewvault.catalog.dto.response.TagSummaryResponse;

/** 公开详情（仅 PUBLISHED）。firstInterviewDate/Precision 为派生字段；历史真实性字段可为 null。 */
public record InterviewDetailResponse(
        Long id,
        CompanySummaryResponse company,
        String department,
        PositionSummaryResponse position,
        String recruitType,
        List<TagSummaryResponse> tags,
        LocalDate firstInterviewDate,
        String firstInterviewDatePrecision,
        String originalPositionName,
        String inferredPositionName,
        String note,
        List<InterviewRoundResponse> rounds,
        List<InterviewSourceResponse> sources) {
}
