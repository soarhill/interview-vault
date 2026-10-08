package com.interviewvault.interview.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 来源 URL 基础同源归一（线上能力）：trim、去尾部斜杠、scheme/host 小写。仅作重复线索，不做全局唯一。 */
public final class UrlNormalizer {

    private static final Pattern SCHEME_HOST = Pattern.compile("^(https?://)([^/]+)(.*)$", Pattern.CASE_INSENSITIVE);

    private UrlNormalizer() {
    }

    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return raw;
        }
        String url = raw.strip();
        Matcher m = SCHEME_HOST.matcher(url);
        if (m.matches()) {
            url = m.group(1).toLowerCase() + m.group(2).toLowerCase() + m.group(3);
        }
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }
}
