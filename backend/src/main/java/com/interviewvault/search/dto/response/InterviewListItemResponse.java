package com.interviewvault.search.dto.response;

import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.interviewvault.catalog.dto.response.CompanySummaryResponse;
import com.interviewvault.catalog.dto.response.PositionSummaryResponse;

/** 列表卡片视图；matches 仅在有搜索词时出现。 */
public record InterviewListItemResponse(
        Long id,
        CompanySummaryResponse company,
        String department,
        PositionSummaryResponse position,
        String recruitType,
        LocalDate firstInterviewDate,
        String firstInterviewDatePrecision,
        List<String> rounds,
        List<String> tags,
        @JsonInclude(JsonInclude.Include.NON_NULL) List<SearchMatchResponse> matches) {
}
