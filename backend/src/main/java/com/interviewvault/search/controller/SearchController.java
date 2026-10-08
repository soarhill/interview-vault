package com.interviewvault.search.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.common.response.Result;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.search.dto.response.InterviewFiltersResponse;
import com.interviewvault.search.dto.response.InterviewListResponse;
import com.interviewvault.search.service.SearchService;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/v1")
@Validated
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping("/interviews")
    public Result<InterviewListResponse> list(
            @RequestParam(required = false) @Min(1) Long companyId,
            @RequestParam(required = false) Long positionCategory,
            @RequestParam(required = false) RecruitType recruitType,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(defaultValue = "1") @Min(1) @Max(10_000) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        return Result.ok(searchService.list(companyId, positionCategory, recruitType, q, page, size));
    }

    @GetMapping("/interview-filters")
    public Result<InterviewFiltersResponse> filters(
            @RequestParam(required = false) @Min(1) Long companyId,
            @RequestParam(required = false) Long positionCategory,
            @RequestParam(required = false) RecruitType recruitType,
            @RequestParam(required = false) @Size(max = 100) String q) {
        return Result.ok(searchService.filters(companyId, positionCategory, recruitType, q));
    }
}
