package com.interviewvault.interview.service;

import com.interviewvault.interview.entity.InterviewRound;
import com.interviewvault.interview.enums.RoundType;

/**
 * 轮次展示名规则（后端统一计算，避免前端多页面重复实现）：
 * TECHNICAL + n -> 一面…五面；HR -> HR 面；UNKNOWN -> remark 原始描述；remark 追加以「 · 」。
 */
public final class RoundDisplayNames {

    private static final String[] CN = {"一", "二", "三", "四", "五"};

    private RoundDisplayNames() {
    }

    public static String displayName(RoundType type, Integer roundNo, String remark) {
        String base;
        if (type == RoundType.TECHNICAL && roundNo != null && roundNo >= 1 && roundNo <= 5) {
            base = CN[roundNo - 1] + "面";
        } else if (type == RoundType.HR) {
            base = "HR 面";
        } else {
            base = remark == null || remark.isBlank() ? "轮次" : remark.strip();
            return base;
        }
        return remark == null || remark.isBlank() ? base : base + " · " + remark.strip();
    }

    public static String displayName(InterviewRound round) {
        return displayName(round.getRoundType(), round.getRoundNo(), round.getRemark());
    }
}
