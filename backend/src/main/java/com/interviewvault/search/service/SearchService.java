package com.interviewvault.search.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewvault.catalog.dto.response.CompanySummaryResponse;
import com.interviewvault.catalog.dto.response.PositionSummaryResponse;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.enums.RoundType;
import com.interviewvault.interview.service.RoundDisplayNames;
import com.interviewvault.search.dto.response.InterviewFiltersResponse;
import com.interviewvault.search.dto.response.InterviewFiltersResponse.CategoryOption;
import com.interviewvault.search.dto.response.InterviewFiltersResponse.CompanyOption;
import com.interviewvault.search.dto.response.InterviewFiltersResponse.RecruitTypeOption;
import com.interviewvault.search.dto.response.InterviewListItemResponse;
import com.interviewvault.search.dto.response.InterviewListResponse;
import com.interviewvault.search.dto.response.SearchMatchResponse;
import com.interviewvault.search.parser.KeywordParser;
import com.interviewvault.search.repository.SearchMapper;
import com.interviewvault.search.repository.SearchMapper.CardRow;
import com.interviewvault.search.repository.SearchMapper.FollowUpText;
import com.interviewvault.search.repository.SearchMapper.QuestionText;
import com.interviewvault.search.repository.SearchMapper.SearchFilter;
import com.interviewvault.search.repository.SearchMapper.TagRow;
import com.interviewvault.search.snippet.SnippetGenerator;

/**
 * 搜索用例编排：参数业务校验、命中片段组织（代表片段选择、META 元信息命中）、DTO 组装、联动计数。
 * SQL 在 resources/mapper/SearchMapper.xml（SearchMapper）。
 */
@Service
public class SearchService {

    private final SearchMapper searchMapper;

    public SearchService(SearchMapper searchMapper) {
        this.searchMapper = searchMapper;
    }

    @Transactional(readOnly = true)
    public InterviewListResponse list(Long companyId, Long categoryId, RecruitType type,
                                      String q, int page, int size) {
        checkQ(q);
        SearchFilter filter = new SearchFilter(companyId, categoryId, type);
        List<String> keywords = KeywordParser.parse(q);
        List<String> patterns = keywords.stream().map(KeywordParser::sqlLikePattern).toList();

        List<Long> ids = searchMapper.findInterviewIds(filter, patterns, size, (page - 1) * size);
        long total = searchMapper.countInterviews(filter, patterns);

        List<InterviewListItemResponse> items = ids.isEmpty() ? List.of() : assembleCards(ids, keywords);
        return new InterviewListResponse(items, total, page, size);
    }

    /**
     * 首页筛选联动计数（faceted）：total 应用全部条件；
     * 每个维度计数忽略自身已选值、保留其余维度与搜索词。
     */
    @Transactional(readOnly = true)
    public InterviewFiltersResponse filters(Long companyId, Long categoryId, RecruitType type,
                                            String q) {
        checkQ(q);
        List<String> keywords = KeywordParser.parse(q);
        List<String> patterns = keywords.stream().map(KeywordParser::sqlLikePattern).toList();

        long total = searchMapper.countInterviews(new SearchFilter(companyId, categoryId, type), patterns);
        // 「全部」= 忽略该维度、保留其余条件后的结果数（与各选项计数同一 faceted 基准；
        // 岗位维度的未分类记录不进任何分类计数，因此岗位 Total 不能用分类求和）
        long companyTotal = searchMapper
                .countInterviews(new SearchFilter(null, categoryId, type), patterns);
        long positionCategoryTotal = searchMapper
                .countInterviews(new SearchFilter(companyId, null, type), patterns);
        long recruitTypeTotal = searchMapper
                .countInterviews(new SearchFilter(companyId, categoryId, null), patterns);
        List<CompanyOption> companies = searchMapper
                .countByCompany(new SearchFilter(null, categoryId, type), patterns)
                .stream().map(c -> new CompanyOption(c.id(), c.name(), c.count())).toList();
        List<CategoryOption> categories = searchMapper
                .countByCategory(new SearchFilter(companyId, null, type), patterns)
                .stream().map(c -> new CategoryOption(
                        String.valueOf(c.categoryId()), c.name(), c.count()))
                .toList();
        Map<String, Long> typeCounts = new HashMap<>();
        searchMapper.countByRecruitType(new SearchFilter(companyId, categoryId, null), patterns)
                .forEach(t -> typeCounts.put(t.recruitType(), t.count()));

        List<RecruitTypeOption> recruitTypes = new ArrayList<>();
        for (RecruitType rt : RecruitType.values()) {
            long count = typeCounts.getOrDefault(rt.name(), 0L);
            if (count > 0) {
                recruitTypes.add(new RecruitTypeOption(rt.name(), rt.getLabel(), count));
            }
        }
        return new InterviewFiltersResponse(total, companyTotal, positionCategoryTotal,
                recruitTypeTotal, companies, categories, recruitTypes);
    }

    // ---------- 卡片组装 ----------

    private List<InterviewListItemResponse> assembleCards(List<Long> ids, List<String> keywords) {
        Map<Long, CardRow> rows = new LinkedHashMap<>();
        searchMapper.findCards(ids).forEach(r -> rows.put(r.id(), r));
        Map<Long, List<String>> roundNames = new LinkedHashMap<>();
        searchMapper.findRoundDisplays(ids).forEach(r -> roundNames
                .computeIfAbsent(r.interviewId(), k -> new ArrayList<>())
                .add(RoundDisplayNames.displayName(RoundType.valueOf(r.roundType()), r.roundNo(), r.remark())));
        Map<Long, List<String>> tags = new LinkedHashMap<>();
        searchMapper.findTags(ids)
                .forEach(t -> tags.computeIfAbsent(t.interviewId(), k -> new ArrayList<>()).add(t.name()));
        Map<Long, List<SearchMatchResponse>> matches = keywords.isEmpty()
                ? Map.of()
                : buildMatches(ids, keywords, rows);

        List<InterviewListItemResponse> items = new ArrayList<>(rows.size());
        for (Map.Entry<Long, CardRow> e : rows.entrySet()) {
            CardRow row = e.getValue();
            items.add(new InterviewListItemResponse(
                    e.getKey(),
                    new CompanySummaryResponse(row.companyId(), row.companyName()),
                    row.department(),
                    row.positionId() == null ? null
                            : new PositionSummaryResponse(row.positionId(), row.positionName(),
                            row.positionCategory()),
                    row.recruitType(),
                    row.firstDate(),
                    row.firstPrecision(),
                    roundNames.getOrDefault(e.getKey(), List.of()),
                    tags.getOrDefault(e.getKey(), List.of()),
                    matches.getOrDefault(e.getKey(), null)));
        }
        return items;
    }

    /**
     * 组装命中片段：按原记录顺序取前两个有代表性的命中；追问片段定位到具体 followUpId；
     * 仅元信息命中时返回单条 META，不伪造问题命中。
     */
    private Map<Long, List<SearchMatchResponse>> buildMatches(List<Long> ids, List<String> keywords,
                                                              Map<Long, CardRow> rows) {
        Map<Long, List<SearchMatchResponse>> perCard = new HashMap<>();
        for (Long id : ids) {
            perCard.put(id, new ArrayList<>());
        }

        List<QuestionText> qRows = searchMapper.findQuestionTexts(ids);
        Map<Long, List<FollowUpText>> followUpsByQuestion = new HashMap<>();
        searchMapper.findFollowUpTexts(ids)
                .forEach(f -> followUpsByQuestion.computeIfAbsent(f.questionId(), k -> new ArrayList<>()).add(f));

        for (QuestionText q : qRows) {
            List<FollowUpText> followUps = followUpsByQuestion.getOrDefault(q.questionId(), List.of());
            // 问题侧匹配范围与 SQL 检索范围一致：主问文本 + 算法描述 + 算法要求（P1-01）
            List<String> questionTexts = List.of(
                    q.content() == null ? "" : q.content(),
                    q.algorithmDescription() == null ? "" : q.algorithmDescription(),
                    q.algorithmRequirements() == null ? "" : q.algorithmRequirements());
            String questionMatchedText = questionTexts.stream()
                    .filter(t -> firstMatched(t, keywords) != null)
                    .findFirst().orElse(null);
            FollowUpText matchedFollowUp = followUps.stream()
                    .filter(f -> firstMatched(f.content(), keywords) != null)
                    .findFirst().orElse(null);

            if (questionMatchedText == null && matchedFollowUp == null) {
                continue;
            }
            List<SearchMatchResponse> cardMatches = perCard.get(q.interviewId());
            if (cardMatches.size() >= 2) {
                continue;
            }
            String roundName = RoundDisplayNames.displayName(
                    RoundType.valueOf(q.roundType()), q.roundNo(), q.roundRemark());
            if (questionMatchedText != null) {
                String matchedKw = firstMatched(questionMatchedText, keywords);
                cardMatches.add(SearchMatchResponse.question(q.questionId(), roundName,
                        SnippetGenerator.window(questionMatchedText, matchedKw)));
            } else {
                cardMatches.add(SearchMatchResponse.followUp(q.questionId(), matchedFollowUp.followUpId(),
                        roundName, "追问：" + SnippetGenerator.window(matchedFollowUp.content(),
                        firstMatched(matchedFollowUp.content(), keywords))));
            }
        }

        for (Long id : ids) {
            List<SearchMatchResponse> matches = perCard.get(id);
            if (matches.isEmpty()) {
                // 没有问题 / 追问命中：仅元信息命中时展示 META
                String meta = metaMatch(rows.get(id), keywords);
                if (meta != null) {
                    matches.add(SearchMatchResponse.meta(meta));
                }
            }
        }
        return perCard;
    }

    /** 返回 META 展示文本，未命中返回 null。 */
    private String metaMatch(CardRow row, List<String> keywords) {
        if (row == null) {
            return null;
        }
        if (containsAny(row.companyName(), keywords)) {
            return "公司：" + row.companyName();
        }
        if (containsAny(row.positionName(), keywords)) {
            return "岗位：" + row.positionName();
        }
        if (row.positionCategory() != null && containsAny(row.positionCategory(), keywords)) {
            return "岗位分类：" + row.positionCategory();
        }
        return null;
    }

    private String firstMatched(String text, List<String> keywords) {
        if (text == null) {
            return null;
        }
        String lower = text.toLowerCase();
        for (String kw : keywords) {
            if (lower.contains(kw)) {
                return kw;
            }
        }
        return null;
    }

    private boolean containsAny(String text, List<String> keywords) {
        return firstMatched(text, keywords) != null;
    }

    // ---------- 参数业务校验 ----------

    private void checkQ(String q) {
        if (q != null && q.length() > KeywordParser.MAX_LENGTH) {
            throw BizException.validation("q 长度超过 " + KeywordParser.MAX_LENGTH + " 字符");
        }
    }
}
