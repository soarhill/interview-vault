package com.interviewvault.interview.dto.request;

import java.time.LocalDate;
import java.util.List;

import com.interviewvault.interview.enums.RoundType;

/**
 * 轮次输入（V1 简化冻结）：id 可选（已有子项必须回传原 id）；sortOrder 不由前端传，按数组顺序生成。
 * 日期只有完整 YYYY-MM-DD 或 null——没有精度概念；历史月 / 年精度由后端在日期未变时原样保留。
 */
public record RoundInput(
        Long id,
        RoundType roundType,
        Integer roundNo,
        LocalDate interviewDate,
        List<QuestionInput> questions) {
}
