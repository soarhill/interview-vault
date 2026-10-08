package com.interviewvault.interview.dto.request;

import jakarta.validation.constraints.NotNull;

public record InterviewSubmitRequest(@NotNull Long version) {
}
