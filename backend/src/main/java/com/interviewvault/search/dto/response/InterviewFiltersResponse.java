package com.interviewvault.search.dto.response;

import java.util.List;

/** 首页筛选选项与联动计数（faceted：各维度计数忽略自身已选值，q 恒参与）。 */
public record InterviewFiltersResponse(
        long total,
        /** 「全部」计数 = 忽略该维度、保留其余条件后的结果数（未分类记录计入 positionCategoryTotal）。 */
        long companyTotal,
        long positionCategoryTotal,
        long recruitTypeTotal,
        List<CompanyOption> companies,
        List<CategoryOption> positionCategories,
        List<RecruitTypeOption> recruitTypes) {

    public record CompanyOption(Long id, String name, long count) {
    }

    public record CategoryOption(String value, String label, long count) {
    }

    public record RecruitTypeOption(String value, String label, long count) {
    }
}
