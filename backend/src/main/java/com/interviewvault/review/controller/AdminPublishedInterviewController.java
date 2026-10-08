package com.interviewvault.review.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.common.response.Result;
import com.interviewvault.review.dto.request.AdminPublishedInterviewUpdateRequest;
import com.interviewvault.review.dto.response.AdminPublishedEditBaselineResponse;
import com.interviewvault.review.dto.response.AdminPublishedSaveResponse;
import com.interviewvault.review.service.PublishedInterviewAdminService;

import jakarta.validation.Valid;

/** 管理员直接读取 / 修改已发布面经（api-design「管理员读取 / 直接修改已发布面经」）。 */
@RestController
@RequestMapping("/api/v1/admin/interviews")
public class AdminPublishedInterviewController {

    private final PublishedInterviewAdminService service;

    public AdminPublishedInterviewController(PublishedInterviewAdminService service) {
        this.service = service;
    }

    @GetMapping("/{id}")
    public Result<AdminPublishedEditBaselineResponse> baseline(@PathVariable long id) {
        return Result.ok(service.baseline(id));
    }

    @PutMapping("/{id}")
    public Result<AdminPublishedSaveResponse> update(@PathVariable long id,
                                                     @Valid @RequestBody
                                                     AdminPublishedInterviewUpdateRequest request) {
        return Result.ok(service.update(id, request));
    }
}
