package com.interviewvault.review.dto.request;

import jakarta.validation.constraints.NotNull;

/** 发布等只携带版本的业务动作请求。 */
public record VersionedActionRequest(@NotNull Long version) {
}
