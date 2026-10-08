package com.interviewvault.search.snippet;

/** 命中片段：取关键词首次出现位置前后约 30 字符的窗口，超长加省略号。 */
public final class SnippetGenerator {

    private static final int RADIUS = 30;

    private SnippetGenerator() {
    }

    public static String window(String text, String keyword) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        int idx = text.toLowerCase().indexOf(keyword);
        if (idx < 0) {
            return truncate(text);
        }
        int start = Math.max(0, idx - RADIUS);
        int end = Math.min(text.length(), idx + keyword.length() + RADIUS);
        StringBuilder sb = new StringBuilder();
        if (start > 0) {
            sb.append("…");
        }
        sb.append(text, start, end);
        if (end < text.length()) {
            sb.append("…");
        }
        return sb.toString();
    }

    private static String truncate(String text) {
        return text.length() <= RADIUS * 2 + 10 ? text
                : text.substring(0, RADIUS * 2 + 10) + "…";
    }
}
