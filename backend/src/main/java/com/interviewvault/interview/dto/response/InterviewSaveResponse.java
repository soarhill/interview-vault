package com.interviewvault.interview.dto.response;

import java.util.List;

import com.interviewvault.common.response.Warning;

/** 聚合保存成功响应：canonical interview + 非阻断 warnings。 */
public record InterviewSaveResponse(MyInterviewResponse interview, List<Warning> warnings) {
}
