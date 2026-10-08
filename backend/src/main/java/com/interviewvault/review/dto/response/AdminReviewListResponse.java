package com.interviewvault.review.dto.response;

import java.util.List;

public record AdminReviewListResponse(List<AdminReviewListItemResponse> items, long total, int page, int size) {
}
