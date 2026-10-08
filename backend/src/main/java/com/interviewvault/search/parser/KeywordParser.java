package com.interviewvault.search.parser;

import java.util.Arrays;
import java.util.List;

/** 关键词处理：按空白切分、lower；SQL LIKE 转义仅在生成参数时进行。匹配语义全在后端，前端不复刻。 */
public final class KeywordParser {

    public static final int MAX_LENGTH = 100;

    private KeywordParser() {
    }

    /** 空白分隔、lower——保留原始词形，供 Java 文本匹配（contains）使用；空白输入返回空列表。 */
    public static List<String> parse(String q) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return Arrays.stream(q.trim().split("\\s+"))
                .map(String::toLowerCase)
                .toList();
    }

    public static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    /** 生成 SQL LIKE 参数：转义 % _ \ 后两侧加通配符。禁止把返回值用于 Java 文本匹配。 */
    public static String sqlLikePattern(String keyword) {
        return "%" + escapeLike(keyword) + "%";
    }
}
