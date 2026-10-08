package com.interviewvault.catalog.service;

import org.springframework.stereotype.Component;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.PositionCategoryRow;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionCategoryMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.common.exception.BizException;

/**
 * 正式目录写入（仅管理员治理动作调用；普通用户走 Candidate 流程）：
 * getOrCreate 合并复用已有同规范化名项；createNew 严格新建，重名返回 409。
 * 岗位方向（position_category）同为目录：管理员可 getOrCreate 新方向。
 */
@Component
public class CatalogRegistrar {

    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final TagMapper tags;
    private final PositionCategoryMapper positionCategories;

    public CatalogRegistrar(CompanyMapper companies, PositionMapper positions, TagMapper tags,
                            PositionCategoryMapper positionCategories) {
        this.companies = companies;
        this.positions = positions;
        this.tags = tags;
        this.positionCategories = positionCategories;
    }

    /** 岗位方向：按规范化名合并复用；新方向排到末尾（其他类排序 99 之前）。 */
    public PositionCategoryRow getOrCreatePositionCategory(String name) {
        String normalized = NameNormalizer.normalize(name);
        PositionCategoryRow existing = positionCategories.selectOne(
                new LambdaQueryWrapper<PositionCategoryRow>()
                        .eq(PositionCategoryRow::getNormalizedName, normalized));
        if (existing != null) {
            return existing;
        }
        Integer maxOrder = positionCategories.selectList(new LambdaQueryWrapper<PositionCategoryRow>()
                .lt(PositionCategoryRow::getSortOrder, 99)
                .orderByDesc(PositionCategoryRow::getSortOrder)
                .last("LIMIT 1"))
                .stream().findFirst().map(PositionCategoryRow::getSortOrder).orElse(0);
        PositionCategoryRow created = new PositionCategoryRow(name.strip(), normalized, maxOrder + 1);
        positionCategories.insert(created);
        return created;
    }

    public PositionCategoryRow defaultPositionCategory() {
        return positionCategories.selectOne(new LambdaQueryWrapper<PositionCategoryRow>()
                .eq(PositionCategoryRow::getName, "其他"));
    }

    public Company getOrCreateCompany(String name) {
        String normalized = NameNormalizer.normalize(name);
        Company existing = companies.selectOne(new LambdaQueryWrapper<Company>()
                .eq(Company::getNormalizedName, normalized));
        if (existing != null) {
            return existing;
        }
        Company created = new Company(name.strip(), normalized);
        companies.insert(created);
        return created;
    }

    public Company createNewCompany(String name) {
        String normalized = NameNormalizer.normalize(name);
        Company existing = companies.selectOne(new LambdaQueryWrapper<Company>()
                .eq(Company::getNormalizedName, normalized));
        if (existing != null) {
            throw duplicate(normalized);
        }
        Company created = new Company(name.strip(), normalized);
        companies.insert(created);
        return created;
    }

    public Position getOrCreatePosition(String name, Long categoryId) {
        String normalized = NameNormalizer.normalize(name);
        Position existing = positions.selectOne(new LambdaQueryWrapper<Position>()
                .eq(Position::getNormalizedName, normalized));
        if (existing != null) {
            return existing;
        }
        Long safeCategory = categoryId != null ? categoryId : defaultPositionCategory().getId();
        Position created = new Position(name.strip(), normalized, safeCategory);
        positions.insert(created);
        return created;
    }

    public Position createNewPosition(String name, Long categoryId) {
        if (categoryId == null) {
            throw BizException.validation("新建岗位必须选择方向");
        }
        String normalized = NameNormalizer.normalize(name);
        Position existing = positions.selectOne(new LambdaQueryWrapper<Position>()
                .eq(Position::getNormalizedName, normalized));
        if (existing != null) {
            throw duplicate(normalized);
        }
        Position created = new Position(name.strip(), normalized, categoryId);
        positions.insert(created);
        return created;
    }

    public Tag getOrCreateTag(String name) {
        String normalized = NameNormalizer.normalize(name);
        Tag existing = tags.selectOne(new LambdaQueryWrapper<Tag>()
                .eq(Tag::getNormalizedName, normalized));
        if (existing != null) {
            return existing;
        }
        Tag created = new Tag(name.strip(), normalized);
        tags.insert(created);
        return created;
    }

    public Tag createNewTag(String name) {
        String normalized = NameNormalizer.normalize(name);
        Tag existing = tags.selectOne(new LambdaQueryWrapper<Tag>()
                .eq(Tag::getNormalizedName, normalized));
        if (existing != null) {
            throw duplicate(normalized);
        }
        Tag created = new Tag(name.strip(), normalized);
        tags.insert(created);
        return created;
    }

    private BizException duplicate(String normalized) {
        return new BizException("DUPLICATE_NORMALIZED_NAME",
                org.springframework.http.HttpStatus.CONFLICT, "同名正式项已存在: " + normalized);
    }
}
