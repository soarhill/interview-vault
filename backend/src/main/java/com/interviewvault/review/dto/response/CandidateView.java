package com.interviewvault.review.dto.response;

import java.util.List;

/** 候选项视图：suggestedMatches 为名称包含查询结果（V1 不使用 AI）。 */
public record CandidateView(Long id, String type, String value,
                            List<SuggestedMatch> suggestedMatches) {

    public record SuggestedMatch(Long id, String name) {
    }
}
