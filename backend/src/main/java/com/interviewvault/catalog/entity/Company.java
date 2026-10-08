package com.interviewvault.catalog.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/** 正式公司；normalizedName 用于唯一性判断，展示使用标准 name。 */
@TableName("company")
public class Company {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;
    private String normalizedName;

    protected Company() {
    }

    public Company(String name, String normalizedName) {
        this.name = name;
        this.normalizedName = normalizedName;
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
}
