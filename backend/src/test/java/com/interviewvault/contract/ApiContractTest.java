package com.interviewvault.contract;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.interviewvault.catalog.controller.CatalogController;
import com.interviewvault.catalog.dto.response.CompanySummaryResponse;
import com.interviewvault.catalog.dto.response.PositionSummaryResponse;
import com.interviewvault.catalog.dto.response.TagSummaryResponse;
import com.interviewvault.catalog.service.CatalogQueryService;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.controller.InterviewController;
import com.interviewvault.interview.dto.response.InterviewDetailResponse;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.service.InterviewDetailService;
import com.interviewvault.search.controller.SearchController;
import com.interviewvault.search.dto.response.InterviewFiltersResponse;
import com.interviewvault.search.dto.response.InterviewListResponse;
import com.interviewvault.search.service.SearchService;

/** 契约形状测试：Result 包装、路径、参数校验、统一错误格式（服务层 mock，语义由集成测试覆盖；
 *  安全语义由 AuthContractTest / BackendIntegrationTest 覆盖，本切片关闭安全过滤器）。 */
@WebMvcTest(controllers = {SearchController.class, InterviewController.class, CatalogController.class})
@org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc(addFilters = false)
class ApiContractTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private SearchService searchService;

    @MockitoBean
    private InterviewDetailService detailService;

    @MockitoBean
    private CatalogQueryService catalogQueryService;

    @Test
    void list_returns_result_envelope() throws Exception {
        given(searchService.list(isNull(), isNull(), isNull(), isNull(), eq(1), eq(20)))
                .willReturn(new InterviewListResponse(List.of(), 108, 1, 20));

        mvc.perform(get("/api/v1/interviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"))
                .andExpect(jsonPath("$.data.total").value(108))
                .andExpect(jsonPath("$.data.page").value(1))
                .andExpect(jsonPath("$.data.size").value(20))
                .andExpect(jsonPath("$.data.items").isArray());
    }

    @Test
    void list_passes_params_and_accepts_enums() throws Exception {
        given(searchService.list(eq(1L), eq(4L), eq(RecruitType.CAMPUS),
                eq("redis"), eq(2), eq(50)))
                .willReturn(new InterviewListResponse(List.of(), 1, 2, 50));

        mvc.perform(get("/api/v1/interviews")
                        .param("companyId", "1")
                        .param("positionCategory", "4")
                        .param("recruitType", "CAMPUS")
                        .param("q", "redis")
                        .param("page", "2")
                        .param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void invalid_enum_yields_400() throws Exception {
        mvc.perform(get("/api/v1/interviews").param("recruitType", "FOO"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void invalid_pagination_and_company_id_yield_400() throws Exception {
        mvc.perform(get("/api/v1/interviews").param("page", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/interviews").param("size", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/interviews").param("companyId", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void detail_not_found_and_removed_have_distinct_codes() throws Exception {
        given(detailService.detail(999L)).willThrow(BizException.interviewNotFound());
        given(detailService.detail(888L)).willThrow(BizException.interviewRemoved());

        mvc.perform(get("/api/v1/interviews/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INTERVIEW_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("面经不存在"));
        mvc.perform(get("/api/v1/interviews/888"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INTERVIEW_REMOVED"))
                .andExpect(jsonPath("$.message").value("该面经已下架"));
    }

    @Test
    void filters_returns_faceted_shape() throws Exception {
        given(searchService.filters(isNull(), isNull(), isNull(), isNull()))
                .willReturn(new InterviewFiltersResponse(18, 18, 18, 18,
                        List.of(new InterviewFiltersResponse.CompanyOption(1L, "字节跳动", 12L)),
                        List.of(new InterviewFiltersResponse.CategoryOption("BACKEND", "后端开发", 15L)),
                        List.of(new InterviewFiltersResponse.RecruitTypeOption("INTERN", "实习", 5L))));

        mvc.perform(get("/api/v1/interview-filters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(18))
                .andExpect(jsonPath("$.data.companies[0].name").value("字节跳动"))
                .andExpect(jsonPath("$.data.companies[0].count").value(12))
                .andExpect(jsonPath("$.data.positionCategories[0].label").value("后端开发"))
                .andExpect(jsonPath("$.data.recruitTypes[0].value").value("INTERN"));
    }

    @Test
    void catalog_lists_return_items() throws Exception {
        given(catalogQueryService.companies(isNull()))
                .willReturn(List.of(new CompanySummaryResponse(1L, "字节跳动")));
        given(catalogQueryService.positions(isNull(), eq(4L)))
                .willReturn(List.of(new PositionSummaryResponse(12L, "Java 后端开发", "BACKEND")));
        given(catalogQueryService.tags(eq("Redis")))
                .willReturn(List.of(new TagSummaryResponse(3L, "Redis")));

        mvc.perform(get("/api/v1/companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value(1))
                .andExpect(jsonPath("$.data.items[0].name").value("字节跳动"));
        mvc.perform(get("/api/v1/positions").param("categoryId", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].name").value("Java 后端开发"));
        mvc.perform(get("/api/v1/tags").param("q", "Redis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].id").value(3));
    }
}
