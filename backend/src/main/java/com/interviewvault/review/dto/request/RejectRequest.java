package com.interviewvault.review.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 拒绝投稿：原因必填（≤500 字符），作者在「我的投稿」可见。 */
public record RejectRequest(@NotNull Long version,
                            @NotNull @Size(max = 500) String reason) {
}
