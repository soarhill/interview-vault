package com.interviewvault.interview.enums;

/**
 * 轮次类型。UNKNOWN 仅用于无法安全归一的历史轮次（搭配 remark 保留原始描述），
 * 不在新投稿 UI 中作为普通选项展示。
 */
public enum RoundType {
    TECHNICAL,
    HR,
    UNKNOWN
}
