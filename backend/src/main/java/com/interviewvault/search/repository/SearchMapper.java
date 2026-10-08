package com.interviewvault.search.repository;

import java.time.LocalDate;
import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.interviewvault.interview.enums.RecruitType;

/**
 * 搜索模块数据访问：复杂 SQL 全部在 resources/mapper/SearchMapper.xml。
 * 语义（公开范围仅 PUBLISHED、整篇关键词 AND、命中范围、转义、排序）见 API 设计与数据库设计「搜索查询」。
 */
@Mapper
public interface SearchMapper {

    /** 查询条件：null 表示该维度不筛选。MyBatis 参数对象需要 getter 访问器。 */
    class SearchFilter {

        private final Long companyId;
        private final Long categoryId;
        private final RecruitType type;

        public SearchFilter(Long companyId, Long categoryId, RecruitType type) {
            this.companyId = companyId;
            this.categoryId = categoryId;
            this.type = type;
        }

        public Long getCompanyId() {
            return companyId;
        }

        public Long getCategoryId() {
            return categoryId;
        }

        public RecruitType getType() {
            return type;
        }
    }

    /** 列表卡片所需的 interview 行投影（id 用于有序映射；firstDate/Precision 为派生字段）。 */
    record CardRow(Long id, Long companyId, String companyName, String department,
                   Long positionId, String positionName, String positionCategory,
                   String recruitType, LocalDate firstDate, String firstPrecision) {
    }

    /** 命中片段所需的 question 行投影（按原记录顺序返回）。算法描述/要求与 SQL 检索范围一致。 */
    record QuestionText(Long interviewId, Long questionId, String roundType, Integer roundNo,
                        String roundRemark, String content, String algorithmDescription,
                        String algorithmRequirements) {
    }

    /** 追问文本投影（followUpId 供 FOLLOW_UP 命中定位）。 */
    record FollowUpText(Long questionId, Long followUpId, String content) {
    }

    record RoundDisplayRow(Long interviewId, String roundType, Integer roundNo, String remark) {
    }

    record TagRow(Long interviewId, String name) {
    }

    record CompanyCount(Long id, String name, Long count) {
    }

    record CategoryCount(Long categoryId, String name, Long count) {
    }

    record RecruitmentCount(String recruitType, Long count) {
    }

    List<Long> findInterviewIds(@Param("filter") SearchFilter filter,
                                @Param("patterns") List<String> patterns,
                                @Param("limit") int limit,
                                @Param("offset") int offset);

    long countInterviews(@Param("filter") SearchFilter filter, @Param("patterns") List<String> patterns);

    List<CompanyCount> countByCompany(@Param("filter") SearchFilter filter,
                                      @Param("patterns") List<String> patterns);

    List<CategoryCount> countByCategory(@Param("filter") SearchFilter filter,
                                        @Param("patterns") List<String> patterns);

    List<RecruitmentCount> countByRecruitType(@Param("filter") SearchFilter filter,
                                              @Param("patterns") List<String> patterns);

    List<CardRow> findCards(@Param("ids") List<Long> ids);

    List<RoundDisplayRow> findRoundDisplays(@Param("ids") List<Long> ids);

    List<TagRow> findTags(@Param("ids") List<Long> ids);

    List<QuestionText> findQuestionTexts(@Param("ids") List<Long> ids);

    List<FollowUpText> findFollowUpTexts(@Param("ids") List<Long> ids);
}
