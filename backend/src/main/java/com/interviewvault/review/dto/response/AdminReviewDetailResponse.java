package com.interviewvault.review.dto.response;

import java.util.List;

import com.interviewvault.interview.dto.response.MyInterviewResponse;

/** 审核详情：当前审核内容 + 作者 + 候选项 + 当前审核周期最近一次快照（原始投稿 vs 当前内容追溯）。 */
public record AdminReviewDetailResponse(
        MyInterviewResponse interview,
        AuthorRef author,
        List<CandidateView> candidates,
        SnapshotView submissionSnapshot) {
}
