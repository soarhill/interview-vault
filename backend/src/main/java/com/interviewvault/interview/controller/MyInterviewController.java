package com.interviewvault.interview.controller;

import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.common.exception.BizException;
import com.interviewvault.common.response.Result;
import com.interviewvault.interview.dto.request.InterviewSubmitRequest;
import com.interviewvault.interview.dto.request.InterviewUpsertRequest;
import com.interviewvault.interview.dto.response.DraftDeleteResponse;
import com.interviewvault.interview.dto.response.InterviewMutationResponse;
import com.interviewvault.interview.dto.response.InterviewSaveResponse;
import com.interviewvault.interview.dto.response.MyInterviewDetailResponse;
import com.interviewvault.interview.dto.response.MyInterviewListResponse;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.service.InterviewSubmissionService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** 「我的投稿」六个写读接口；资源级权限（作者本人）由 Service 校验。 */
@RestController
@RequestMapping("/api/v1/me/interviews")
@Validated
public class MyInterviewController {

    private final InterviewSubmissionService submissions;

    public MyInterviewController(InterviewSubmissionService submissions) {
        this.submissions = submissions;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Result<InterviewMutationResponse> createDraft() {
        return Result.ok(submissions.createDraft());
    }

    @GetMapping
    public Result<MyInterviewListResponse> list(
            @RequestParam(required = false) InterviewStatus status,
            @RequestParam(defaultValue = "1") @Min(1) @Max(10_000) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        return Result.ok(submissions.list(status, page, size));
    }

    @GetMapping("/{id}")
    public Result<MyInterviewDetailResponse> detail(@PathVariable long id) {
        return Result.ok(submissions.detail(id));
    }

    @PutMapping("/{id}")
    public Result<InterviewSaveResponse> save(@PathVariable long id,
                                              @Valid @RequestBody InterviewUpsertRequest request) {
        return Result.ok(submissions.save(id, request));
    }

    @DeleteMapping("/{id}")
    public Result<DraftDeleteResponse> deleteDraft(@PathVariable long id) {
        return Result.ok(submissions.deleteDraft(id));
    }

    @PostMapping("/{id}/submit")
    public Result<InterviewMutationResponse> submit(@PathVariable long id,
                                                    @Valid @RequestBody InterviewSubmitRequest request) {
        return Result.ok(submissions.submit(id, request.version()));
    }
}
