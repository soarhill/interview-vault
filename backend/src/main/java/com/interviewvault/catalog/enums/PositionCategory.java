package com.interviewvault.catalog.enums;

/** 岗位筛选大类（V1 收口五类，V6 迁移同步数据库 CHECK 约束）；label 供筛选联动计数接口返回展示文案。 */
public enum PositionCategory {
    AGENT("Agent 开发"),
    AI_APPLICATION("AI 应用"),
    PLATFORM_INFRA("AI Infra"),
    BACKEND("后端开发"),
    OTHER("其他");

    private final String label;

    PositionCategory(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
