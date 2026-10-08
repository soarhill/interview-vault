package com.interviewvault.interview.enums;

/** 招聘类型。label 供筛选联动计数接口返回展示文案；数据库与代码统一大写值。 */
public enum RecruitType {
    INTERN("实习"),
    CAMPUS("校招");

    private final String label;

    RecruitType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
