package com.interviewvault.catalog.service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.interviewvault.catalog.dto.response.CompanySummaryResponse;
import com.interviewvault.catalog.dto.response.PositionSummaryResponse;
import com.interviewvault.catalog.dto.response.TagSummaryResponse;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.PositionCategoryRow;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionCategoryMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;

/** 正式目录读取：投稿选择器、管理员目录选择器等「查正式目录」场景；不承担首页筛选计数。 */
@Service
public class CatalogQueryService {

    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final TagMapper tags;
    private final PositionCategoryMapper positionCategories;

    public CatalogQueryService(CompanyMapper companies, PositionMapper positions, TagMapper tags,
                               PositionCategoryMapper positionCategories) {
        this.companies = companies;
        this.positions = positions;
        this.tags = tags;
        this.positionCategories = positionCategories;
    }

    @Transactional(readOnly = true)
    public List<CompanySummaryResponse> companies(String q) {
        LambdaQueryWrapper<Company> wrapper = new LambdaQueryWrapper<Company>()
                .orderByAsc(Company::getName);
        if (q != null && !q.isBlank()) {
            wrapper.apply("lower(name) LIKE {0} ESCAPE '\\'", likePattern(q));
        }
        return companies.selectList(wrapper).stream()
                .map(c -> new CompanySummaryResponse(c.getId(), c.getName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PositionSummaryResponse> positions(String q, Long categoryId) {
        LambdaQueryWrapper<Position> wrapper = new LambdaQueryWrapper<Position>()
                .orderByAsc(Position::getName);
        if (q != null && !q.isBlank()) {
            wrapper.apply("lower(name) LIKE {0} ESCAPE '\\'", likePattern(q));
        }
        if (categoryId != null) {
            wrapper.eq(Position::getCategoryId, categoryId);
        }
        Map<Long, String> categoryNames = categoryNames();
        return positions.selectList(wrapper).stream()
                .map(p -> new PositionSummaryResponse(p.getId(), p.getName(),
                        categoryNames.get(p.getCategoryId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PositionCategoryRow> positionCategories() {
        return positionCategories.selectList(new LambdaQueryWrapper<PositionCategoryRow>()
                .orderByAsc(PositionCategoryRow::getSortOrder));
    }

    private Map<Long, String> categoryNames() {
        return positionCategories().stream()
                .collect(Collectors.toMap(PositionCategoryRow::getId, PositionCategoryRow::getName));
    }

    @Transactional(readOnly = true)
    public List<TagSummaryResponse> tags(String q) {
        LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<Tag>()
                .orderByAsc(Tag::getName);
        if (q != null && !q.isBlank()) {
            wrapper.apply("lower(name) LIKE {0} ESCAPE '\\'", likePattern(q));
        }
        return tags.selectList(wrapper).stream()
                .map(t -> new TagSummaryResponse(t.getId(), t.getName()))
                .toList();
    }

    /** 大小写不敏感包含匹配参数；% _ \ 按普通文本转义。 */
    private String likePattern(String q) {
        String escaped = q.trim().toLowerCase()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
