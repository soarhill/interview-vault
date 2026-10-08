package com.interviewvault.catalog.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/** 岗位方向目录（首页筛选大类）：管理员可新增，不再由代码枚举冻结。 */
@TableName("position_category")
public class PositionCategoryRow {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;
    private String normalizedName;
    private Integer sortOrder;

    protected PositionCategoryRow() {
    }

    public PositionCategoryRow(String name, String normalizedName, Integer sortOrder) {
        this.name = name;
        this.normalizedName = normalizedName;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getNormalizedName() {
        return normalizedName;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }
}
