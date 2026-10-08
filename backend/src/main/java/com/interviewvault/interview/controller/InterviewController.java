package com.interviewvault.interview.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.common.response.Result;
import com.interviewvault.interview.dto.response.InterviewDetailResponse;
import com.interviewvault.interview.service.InterviewDetailService;

@RestController
@RequestMapping("/api/v1/interviews")
public class InterviewController {

    private final InterviewDetailService detailService;

    public InterviewController(InterviewDetailService detailService) {
        this.detailService = detailService;
    }

    @GetMapping("/{id}")
    public Result<InterviewDetailResponse> detail(@PathVariable long id) {
        return Result.ok(detailService.detail(id));
    }
}
