package com.interviewvault.interview.dto.response;

import java.util.List;

/**
 * 问题视图：referenceUrl 是合并后的用户可见链接（reference_url ?? leetcode_url）；
 * questionType 与历史兼容字段继续完整返回，服务历史读取与编辑 seed。
 */
public record QuestionResponse(
        Long id,
        String content,
        String referenceUrl,
        String questionType,
        String sectionLabel,
        String contextNote,
        String algorithmTitle,
        String algorithmDescription,
        String algorithmRequirements,
        Integer leetcodeNumber,
        String leetcodeUrl,
        List<FollowUpResponse> followUps) {
}
