package com.interviewvault.review.dto.response;

import java.util.List;

public record AdminChangeRequestListResponse(List<AdminChangeRequestListItemResponse> items,
                                             long total, int page, int size) {
}
