package com.interviewvault.search.dto.response;

import java.util.List;

public record InterviewListResponse(List<InterviewListItemResponse> items, long total, int page, int size) {
}
