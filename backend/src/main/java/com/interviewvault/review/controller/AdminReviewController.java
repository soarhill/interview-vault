package com.interviewvault.review.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.common.response.Result;
import com.interviewvault.interview.dto.request.InterviewUpsertRequest;
import com.interviewvault.interview.dto.response.InterviewMutationResponse;
import com.interviewvault.interview.dto.response.InterviewSaveResponse;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.review.dto.request.CandidateResolveRequest;
import com.interviewvault.review.dto.request.RejectRequest;
import com.interviewvault.review.dto.request.VersionedActionRequest;
import com.interviewvault.review.dto.response.AdminReviewDetailResponse;
import com.interviewvault.review.dto.response.AdminReviewListResponse;
import com.interviewvault.review.dto.response.CandidateResolveResponse;
import com.interviewvault.review.service.ReviewModerationService;
import com.interviewvault.review.service.ReviewQueryService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** 管理员审核（api-design 审核 API 章节）：/api/v1/admin/** 已由安全链限定 ADMIN。 */
@RestController
@RequestMapping("/api/v1/admin/reviews/interviews")
@Validated
public class AdminReviewController {

    private final ReviewQueryService queryService;
    private final ReviewModerationService moderationService;

    public AdminReviewController(ReviewQueryService queryService, ReviewModerationService moderationService) {
        this.queryService = queryService;
        this.moderationService = moderationService;
    }

    @GetMapping
    public Result<AdminReviewListResponse> list(
            @RequestParam(required = false) InterviewStatus status,
            @RequestParam(defaultValue = "1") @Min(1) @Max(10_000) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        return Result.ok(queryService.list(status, page, size));
    }

    @GetMapping("/{id}")
    public Result<AdminReviewDetailResponse> detail(@PathVariable long id) {
        return Result.ok(queryService.detail(id));
    }

    @PutMapping("/{id}")
    public Result<InterviewSaveResponse> edit(@PathVariable long id,
                                              @Valid @RequestBody InterviewUpsertRequest request) {
        return Result.ok(moderationService.edit(id, request));
    }

    @PostMapping("/{id}/candidates/{candidateId}/resolve")
    public Result<CandidateResolveResponse> resolve(@PathVariable long id, @PathVariable long candidateId,
                                                    @Valid @RequestBody CandidateResolveRequest request) {
        return Result.ok(moderationService.resolve(id, candidateId, request));
    }

    @PostMapping("/{id}/publish")
    public Result<InterviewMutationResponse> publish(@PathVariable long id,
                                                     @Valid @RequestBody VersionedActionRequest request) {
        return Result.ok(moderationService.publish(id, request.version()));
    }

    @PostMapping("/{id}/reject")
    public Result<InterviewMutationResponse> reject(@PathVariable long id,
                                                    @Valid @RequestBody RejectRequest request) {
        return Result.ok(moderationService.reject(id, request.version(), request.reason()));
    }
}
