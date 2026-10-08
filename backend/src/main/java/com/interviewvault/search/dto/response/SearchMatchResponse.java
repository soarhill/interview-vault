package com.interviewvault.search.dto.response;

/**
 * 搜索命中片段：QUESTION 命中主问题（followUpId null）、FOLLOW_UP 命中追问（两者有值）、
 * META 仅元信息命中（两者 null，不生成问题定位）。
 */
public record SearchMatchResponse(
        Long questionId,
        Long followUpId,
        String roundName,
        MatchKind kind,
        String snippet) {

    public enum MatchKind {
        QUESTION, FOLLOW_UP, META
    }

    public static SearchMatchResponse question(Long questionId, String roundName, String snippet) {
        return new SearchMatchResponse(questionId, null, roundName, MatchKind.QUESTION, snippet);
    }

    public static SearchMatchResponse followUp(Long questionId, Long followUpId, String roundName,
                                               String snippet) {
        return new SearchMatchResponse(questionId, followUpId, roundName, MatchKind.FOLLOW_UP, snippet);
    }

    public static SearchMatchResponse meta(String snippet) {
        return new SearchMatchResponse(null, null, null, MatchKind.META, snippet);
    }
}
