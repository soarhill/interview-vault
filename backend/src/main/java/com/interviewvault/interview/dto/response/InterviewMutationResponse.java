package com.interviewvault.interview.dto.response;

import java.time.OffsetDateTime;
import java.util.List;

import com.interviewvault.common.response.Warning;

/** 不改变聚合子实体结构的状态 / 动作写响应：前端每次成功后必须用 version 覆盖本地。 */
public record InterviewMutationResponse(
        Long id,
        String status,
        Long version,
        OffsetDateTime updateTime,
        List<Warning> warnings) {
}
