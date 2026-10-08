package com.interviewvault.interview.dto.response;

/** 读响应中的标签视图：正式绑定 OFFICIAL，候选 PROPOSED。 */
public record TagSelectionView(Long id, String name, String source) {

    public static final String OFFICIAL = "OFFICIAL";
    public static final String PROPOSED = "PROPOSED";
}
