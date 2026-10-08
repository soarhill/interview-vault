package com.interviewvault.interview.dto.response;

import java.time.LocalDate;
import java.util.List;

public record InterviewRoundResponse(
        Long id,
        String roundType,
        Integer roundNo,
        String displayName,
        String remark,
        LocalDate interviewDate,
        String interviewDatePrecision,
        List<QuestionResponse> questions) {
}
