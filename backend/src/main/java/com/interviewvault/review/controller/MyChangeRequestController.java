package com.interviewvault.review.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.common.response.Result;
import com.interviewvault.review.dto.request.ChangeRequestUpsertRequest;
import com.interviewvault.review.dto.response.ChangeRequestView;
import com.interviewvault.review.dto.response.MyChangeRequestBaselineResponse;
import com.interviewvault.review.service.ChangeRequestService;

import jakarta.validation.Valid;

/** 作者侧变更申请（api-design 作者变更申请章节）：读取基线与当前 PENDING、创建 / 覆盖申请。 */
@RestController
@RequestMapping("/api/v1/me/interviews/{id}/change-request")
public class MyChangeRequestController {

    private final ChangeRequestService service;

    public MyChangeRequestController(ChangeRequestService service) {
        this.service = service;
    }

    @GetMapping
    public Result<MyChangeRequestBaselineResponse> read(@PathVariable long id) {
        return Result.ok(service.readBaseline(id));
    }

    @PutMapping
    public Result<ChangeRequestView> upsert(@PathVariable long id,
                                            @Valid @RequestBody ChangeRequestUpsertRequest request) {
        return Result.ok(service.upsert(id, request));
    }
}
