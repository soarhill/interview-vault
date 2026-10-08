package com.interviewvault.interview.dto.response;

/** 读响应中的公司 / 岗位选择视图：候选值时 id=null、source=PROPOSED；前端不再自行拼接 Candidate。 */
public record CatalogSelectionView(Long id, String name, String source, String category) {

    public static final String OFFICIAL = "OFFICIAL";
    public static final String PROPOSED = "PROPOSED";

    public static CatalogSelectionView official(Long id, String name, String category) {
        return new CatalogSelectionView(id, name, OFFICIAL, category);
    }

    public static CatalogSelectionView proposed(String name) {
        return new CatalogSelectionView(null, name, PROPOSED, null);
    }
}
