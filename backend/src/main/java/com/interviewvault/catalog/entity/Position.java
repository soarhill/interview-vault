package com.interviewvault.catalog.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/** 具体岗位（如「Java 后端开发」）；categoryId 指向岗位方向（position_category 目录，管理员可扩展）。 */
@TableName("position")
public class Position {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;
    private String normalizedName;
    private Long categoryId;

    protected Position() {
    }

    public Position(String name, String normalizedName, Long categoryId) {
        this.name = name;
        this.normalizedName = normalizedName;
        this.categoryId = categoryId;
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

    public Long getCategoryId() {
        return categoryId;
    }
}
