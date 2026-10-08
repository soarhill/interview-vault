package com.interviewvault.catalog.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interviewvault.catalog.dto.response.CatalogListResponse;
import com.interviewvault.catalog.dto.response.CompanySummaryResponse;
import com.interviewvault.catalog.dto.response.PositionCategorySummaryResponse;
import com.interviewvault.catalog.dto.response.PositionSummaryResponse;
import com.interviewvault.catalog.dto.response.TagSummaryResponse;
import com.interviewvault.catalog.service.CatalogQueryService;
import com.interviewvault.common.response.Result;

import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/v1")
@Validated
public class CatalogController {

    private final CatalogQueryService catalog;

    public CatalogController(CatalogQueryService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/companies")
    public Result<CatalogListResponse<CompanySummaryResponse>> companies(
            @RequestParam(required = false) @Size(max = 100) String q) {
        return Result.ok(CatalogListResponse.of(catalog.companies(q)));
    }

    @GetMapping("/positions")
    public Result<CatalogListResponse<PositionSummaryResponse>> positions(
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(required = false) Long categoryId) {
        return Result.ok(CatalogListResponse.of(catalog.positions(q, categoryId)));
    }

    /** 岗位方向目录（公开：首页筛选与投稿联想共用；管理员在治理时可新增）。 */
    @GetMapping("/position-categories")
    public Result<CatalogListResponse<PositionCategorySummaryResponse>> positionCategories() {
        return Result.ok(CatalogListResponse.of(catalog.positionCategories().stream()
                .map(c -> new PositionCategorySummaryResponse(c.getId(), c.getName(), c.getSortOrder()))
                .toList()));
    }

    @GetMapping("/tags")
    public Result<CatalogListResponse<TagSummaryResponse>> tags(
            @RequestParam(required = false) @Size(max = 100) String q) {
        return Result.ok(CatalogListResponse.of(catalog.tags(q)));
    }
}
