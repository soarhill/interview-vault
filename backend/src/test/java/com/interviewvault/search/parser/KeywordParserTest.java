package com.interviewvault.search.parser;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class KeywordParserTest {

    @Test
    void splits_on_whitespace_and_lowercases() {
        assertThat(KeywordParser.parse("Redis  分布式锁\nagent")).containsExactly("redis", "分布式锁", "agent");
        assertThat(KeywordParser.parse("Agent Memory")).containsExactly("agent", "memory");
    }

    @Test
    void blank_input_means_no_restriction() {
        assertThat(KeywordParser.parse(null)).isEmpty();
        assertThat(KeywordParser.parse("   ")).isEmpty();
    }

    @Test
    void parses_raw_keywords_without_escaping() {
        // Java contains 用原始词形：user_id 不能被转义成 user\_id（P1-01 回归）
        assertThat(KeywordParser.parse("user_id 100%")).containsExactly("user_id", "100%");
    }

    @Test
    void escapes_like_wildcards_only_in_sql_pattern() {
        assertThat(KeywordParser.escapeLike("100%_")).isEqualTo("100\\%\\_");
        assertThat(KeywordParser.sqlLikePattern("a%")).isEqualTo("%a\\%%");
    }
}
