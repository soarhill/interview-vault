package com.interviewvault.interview.dto.request;

import java.util.List;

/**
 * 主问题输入（V1 简化冻结）：正文 + 可选题目链接 + 追问。
 * questionType 不再由前端提交——带链接由后端记 ALGORITHM，其余 NORMAL；
 * sectionLabel / contextNote / algorithm* / leetcode* 退出写入合同，更新时保持原值。
 */
public record QuestionInput(
        Long id,
        String content,
        String referenceUrl,
        List<FollowUpInput> followUps) {
}
