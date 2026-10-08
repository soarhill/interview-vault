package com.interviewvault.interview.dto.response;

import java.util.List;

public record MyInterviewListResponse(List<MyInterviewListItemResponse> items, long total, int page, int size) {
}
