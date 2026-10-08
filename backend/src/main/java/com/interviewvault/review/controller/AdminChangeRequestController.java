package com.interviewvault.review.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import com.interviewvault.review.dto.request.ChangeRequestDecisionRequest;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.common.response.Result;
import com.interviewvault.review.dto.response.AdminChangeRequestDetailResponse;
import com.interviewvault.review.dto.response.AdminChangeRequestListResponse;
import com.interviewvault.review.dto.response.ChangeRequestDecisionResponse;
import com.interviewvault.review.enums.ChangeRequestStatus;
import com.interviewvault.review.enums.ChangeRequestType;
import com.interviewvault.review.service.ChangeRequestService;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** 管理员变更申请处理（api-design §11）：approve / reject 携带申请修订号，重复调用不产生二次副作用。 */
@RestController
@RequestMapping("/api/v1/admin/change-requests")
@Validated
public class AdminChangeRequestController {

    private final ChangeRequestService service;

    public AdminChangeRequestController(ChangeRequestService service) {
        this.service = service;
    }

    @GetMapping
    public Result<AdminChangeRequestListResponse> list(
            @RequestParam(defaultValue = "PENDING") ChangeRequestStatus status,
            @RequestParam(required = false) ChangeRequestType type,
            @RequestParam(defaultValue = "1") @Min(1) @Max(10_000) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        return Result.ok(service.list(status, type, page, size));
    }

    @GetMapping("/{id}")
    public Result<AdminChangeRequestDetailResponse> detail(@PathVariable long id) {
        return Result.ok(service.detail(id));
    }

    @PostMapping("/{id}/approve")
    public Result<ChangeRequestDecisionResponse> approve(@PathVariable long id,
            @Valid @RequestBody ChangeRequestDecisionRequest request) {
        return Result.ok(service.approve(id, request.expectedRequestVersion()));
    }

    @PostMapping("/{id}/reject")
    public Result<ChangeRequestDecisionResponse> reject(@PathVariable long id,
            @Valid @RequestBody ChangeRequestDecisionRequest request) {
        return Result.ok(service.reject(id, request.expectedRequestVersion()));
    }
}
