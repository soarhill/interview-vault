package com.interviewvault.review.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** 审批必须绑定管理员已读取的申请修订号，而非只检查正式面经版本。 */
public record ChangeRequestDecisionRequest(@NotNull @Min(0) Long expectedRequestVersion) {
}
