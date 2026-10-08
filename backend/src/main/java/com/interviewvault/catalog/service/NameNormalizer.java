package com.interviewvault.catalog.service;

/** 目录名称规范化：trim、连续空白归一、英文统一小写；用于 normalizedName 唯一性判断。 */
public final class NameNormalizer {

    private NameNormalizer() {
    }

    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String collapsed = raw.strip().replaceAll("\\s+", " ");
        return collapsed.isEmpty() ? null : collapsed.toLowerCase();
    }
}
