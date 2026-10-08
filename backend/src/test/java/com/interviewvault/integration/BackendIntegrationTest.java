package com.interviewvault.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.PositionCategoryRow;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionCategoryMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.catalog.service.NameNormalizer;
import com.interviewvault.interview.entity.FollowUp;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.entity.InterviewRound;
import com.interviewvault.interview.entity.InterviewSource;
import com.interviewvault.interview.entity.InterviewTag;
import com.interviewvault.interview.entity.Question;
import com.interviewvault.interview.enums.InterviewDatePrecision;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.enums.QuestionType;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.enums.RoundType;
import com.interviewvault.interview.repository.FollowUpMapper;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.repository.InterviewRoundMapper;
import com.interviewvault.interview.repository.InterviewSourceMapper;
import com.interviewvault.interview.repository.InterviewTagMapper;
import com.interviewvault.interview.repository.QuestionMapper;
import com.jayway.jsonpath.JsonPath;

/**
 * 真库集成测试：Testcontainers 启动一次性 PostgreSQL（postgres:18），
 * Flyway 建表 + 固定面经数据（mapper 直插）+ 公开读接口语义。
 * 与开发库（localhost:5433）完全隔离；无 Docker 环境时自动跳过。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class BackendIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InterviewRecordMapper interviews;
    @Autowired
    private InterviewRoundMapper rounds;
    @Autowired
    private QuestionMapper questions;
    @Autowired
    private FollowUpMapper followUps;
    @Autowired
    private InterviewSourceMapper sources;
    @Autowired
    private InterviewTagMapper interviewTags;
    @Autowired
    private CompanyMapper companies;
    @Autowired
    private PositionMapper positions;
    @Autowired
    private TagMapper tags;
    @Autowired
    private PositionCategoryMapper positionCategories;

    private static boolean seeded;

    /**
     * 固定数据底座：两份已发布面经覆盖公开读接口的全部断言语义——
     * 字节 A（日精度、双轮、算法题、追问、双来源、双标签）与拼多多 B（月精度、跨问题命中、META 命中）。
     */
    private void seedOnce() {
        if (seeded) {
            return;
        }
        Long bytedance = ensureCompany("字节跳动");
        Long pinduoduo = ensureCompany("拼多多");
        Long backendPosition = ensurePosition("后端开发", "后端开发");

        InterviewRecord a = new InterviewRecord(null, bytedance, backendPosition, "抖音电商",
                "后端开发", null, null, RecruitType.CAMPUS, InterviewStatus.PUBLISHED);
        interviews.insert(a);
        interviewTags.insert(new InterviewTag(a.getId(), ensureTag("Redis")));
        interviewTags.insert(new InterviewTag(a.getId(), ensureTag("MySQL")));
        sources.insert(new InterviewSource(a.getId(), "https://example.com/1", "https://example.com/1"));
        sources.insert(new InterviewSource(a.getId(), "https://example.com/2", "https://example.com/2"));

        InterviewRound a1 = new InterviewRound(a.getId(), RoundType.TECHNICAL, 1, null,
                LocalDate.of(2026, 9, 23), InterviewDatePrecision.DAY, 1);
        rounds.insert(a1);
        insertQuestion(a1.getId(), "自我介绍。", 1, QuestionType.NORMAL, "项目与实习", null);
        Question aRedisLock = insertQuestion(a1.getId(), "Redis 分布式锁怎么实现？", 2,
                QuestionType.NORMAL, "项目与实习", "候选人介绍的是 CR Agent 项目。");
        followUps.insert(new FollowUp(aRedisLock.getId(), "为什么使用 SETNX？", 1));
        followUps.insert(new FollowUp(aRedisLock.getId(), "锁过期但业务没执行完怎么办？", 2));
        insertQuestion(a1.getId(), "慢查询里 user_id 索引该怎么建？QPS 涨到 100% 怎么办？", 3,
                QuestionType.NORMAL, "项目与实习", null);
        Question aAlgorithm = new Question(a1.getId(), "最大子数组和", 4, QuestionType.ALGORITHM,
                "算法", null, "最大子数组和", "最大子数组和", "手撕；说明时间复杂度", 53,
                "https://leetcode.cn/problems/maximum-subarray/");
        questions.insert(aAlgorithm);
        followUps.insert(new FollowUp(aAlgorithm.getId(), "思路是什么？", 1));
        questions.insert(new Question(a1.getId(), "数字构造题干", 5, QuestionType.ALGORITHM,
                "逻辑题", null, "数字构造题干",
                "给定整数 N 和一组允许使用的数字，数字能否重复使用需要现场确认", "手撕", null, null));
        rounds.insert(new InterviewRound(a.getId(), RoundType.TECHNICAL, 2, null,
                null, null, 2));

        InterviewRecord b = new InterviewRecord(null, pinduoduo, backendPosition, null,
                null, "Java后端", null, RecruitType.INTERN, InterviewStatus.PUBLISHED);
        interviews.insert(b);
        sources.insert(new InterviewSource(b.getId(), "https://example.com/pdd", "https://example.com/pdd"));
        InterviewRound b1 = new InterviewRound(b.getId(), RoundType.UNKNOWN, null, "技术面",
                LocalDate.of(2026, 7, 1), InterviewDatePrecision.MONTH, 1);
        rounds.insert(b1);
        Question bRedis = insertQuestion(b1.getId(), "讲讲 Redis 持久化。", 1,
                QuestionType.NORMAL, "中间件", null);
        followUps.insert(new FollowUp(bRedis.getId(), "RDB 和 AOF 的区别？", 1));
        insertQuestion(b1.getId(), "分布式锁有哪些实现方式？", 2, QuestionType.NORMAL, "中间件", null);

        seeded = true;
    }

    private Question insertQuestion(Long roundId, String content, int sortOrder,
                                    QuestionType type, String sectionLabel, String contextNote) {
        Question question = new Question(roundId, content, sortOrder, type,
                sectionLabel, contextNote, null, null, null, null, null);
        questions.insert(question);
        return question;
    }

    private Long ensureCompany(String name) {
        String normalized = NameNormalizer.normalize(name);
        Company found = companies.selectOne(new LambdaQueryWrapper<Company>()
                .eq(Company::getNormalizedName, normalized));
        if (found == null) {
            Company created = new Company(name.strip(), normalized);
            companies.insert(created);
            return created.getId();
        }
        return found.getId();
    }

    private Long ensurePosition(String name, String categoryName) {
        Long categoryId = positionCategories.selectOne(new LambdaQueryWrapper<PositionCategoryRow>()
                .eq(PositionCategoryRow::getName, categoryName)).getId();
        String normalized = NameNormalizer.normalize(name);
        Position found = positions.selectOne(new LambdaQueryWrapper<Position>()
                .eq(Position::getNormalizedName, normalized));
        if (found == null) {
            Position created = new Position(name.strip(), normalized, categoryId);
            positions.insert(created);
            return created.getId();
        }
        return found.getId();
    }

    private Long ensureTag(String name) {
        String normalized = NameNormalizer.normalize(name);
        Tag found = tags.selectOne(new LambdaQueryWrapper<Tag>()
                .eq(Tag::getNormalizedName, normalized));
        if (found == null) {
            Tag created = new Tag(name.strip(), normalized);
            tags.insert(created);
            return created.getId();
        }
        return found.getId();
    }

    @Test
    void keyword_with_underscore_and_percent_still_produces_matches() throws Exception {
        // P1-01 回归：SQL 转义参数不得回流到 Java 片段匹配（user_id / % 曾丢失片段）
        seedOnce();
        mvc.perform(get("/api/v1/interviews").param("q", "user_id"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].matches.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].matches[0].kind").value("QUESTION"))
                .andExpect(jsonPath("$.data.items[0].matches[0].snippet",
                        org.hamcrest.Matchers.containsString("user_id")));
        mvc.perform(get("/api/v1/interviews").param("q", "%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].matches[0].kind").value("QUESTION"));
    }

    @Test
    void algorithm_description_hit_produces_question_match() throws Exception {
        // P1-01 回归：SQL 命中算法描述时，片段必须生成（数字能否重复使用 曾 total=1 matches=[]）
        seedOnce();
        mvc.perform(get("/api/v1/interviews").param("q", "数字能否重复使用"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].matches.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].matches[0].kind").value("QUESTION"))
                .andExpect(jsonPath("$.data.items[0].matches[0].snippet",
                        org.hamcrest.Matchers.containsString("数字能否重复使用")));
    }

    @Test
    void list_supports_filters_and_pagination_shape() throws Exception {
        seedOnce();
        mvc.perform(get("/api/v1/interviews").param("size", "1").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2))
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].company.name").value("字节跳动"))
                .andExpect(jsonPath("$.data.items[0].department").value("抖音电商"))
                .andExpect(jsonPath("$.data.items[0].position.name").value("后端开发"))
                .andExpect(jsonPath("$.data.items[0].rounds").isArray())
                .andExpect(jsonPath("$.data.items[0].firstInterviewDatePrecision").value("DAY"));
    }

    @Test
    void search_covers_keywords_across_questions_with_month_precision() throws Exception {
        seedOnce();
        // 跨问题命中：A 单题覆盖两词；B 两词分散在两题——整篇都算命中
        mvc.perform(get("/api/v1/interviews").param("q", "Redis 分布式锁"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2));

        // 追问命中带 followUpId 定位；月精度历史日期不冒充具体日
        mvc.perform(get("/api/v1/interviews").param("q", "SETNX"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].matches[0].kind").value("FOLLOW_UP"))
                .andExpect(jsonPath("$.data.items[0].matches[0].followUpId").isNumber())
                .andExpect(jsonPath("$.data.items[0].matches[0].roundName").value("一面"));

        mvc.perform(get("/api/v1/interviews").param("q", "RDB"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].firstInterviewDatePrecision").value("MONTH"));
    }

    @Test
    void meta_only_match_returns_meta_kind() throws Exception {
        seedOnce();
        mvc.perform(get("/api/v1/interviews").param("q", "拼多多"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].matches[0].kind").value("META"))
                .andExpect(jsonPath("$.data.items[0].matches[0].snippet",
                        org.hamcrest.Matchers.containsString("拼多多")));
    }

    @Test
    void search_is_case_insensitive_and_keyword_and() throws Exception {
        seedOnce();
        mvc.perform(get("/api/v1/interviews").param("q", "redis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(2)); // 两份都含 redis
        mvc.perform(get("/api/v1/interviews").param("q", "redis 不存在的词"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(0)); // AND：一个词不命中即不命中
    }

    @Test
    void filters_count_each_dimension_excluding_own_selection() throws Exception {
        seedOnce();
        MvcResult base = mvc.perform(get("/api/v1/interview-filters")).andReturn();
        assertThat(JsonPath.<Integer>read(base.getResponse().getContentAsString(), "$.data.total"))
                .isEqualTo(2);
        // 公司维度不受自身限制：两家公司都有计数
        mvc.perform(get("/api/v1/interview-filters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.companies.length()").value(2))
                .andExpect(jsonPath("$.data.recruitTypes.length()").value(2));

        // 已选字节时，招聘类型只统计字节的一份（联动计数排除自身维度）
        Integer bytedanceId = JsonPath.read(base.getResponse().getContentAsString(),
                "$.data.companies[0].id");
        MvcResult filtered = mvc.perform(get("/api/v1/interview-filters")
                        .param("companyId", String.valueOf(bytedanceId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andReturn();
        JsonNode types = objectMapper.readTree(filtered.getResponse().getContentAsString())
                .path("data").path("recruitTypes");
        long total = 0;
        for (JsonNode t : types) {
            total += t.path("count").asLong();
        }
        assertThat(total).isEqualTo(1);
    }

    @Test
    void catalog_lists_return_seeded_dictionaries() throws Exception {
        seedOnce();
        mvc.perform(get("/api/v1/companies"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(2));
        // q 大小写不敏感（redis 命中 Redis）
        mvc.perform(get("/api/v1/tags").param("q", "redis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].name").value("Redis"));
    }

    @Test
    void detail_returns_full_tree() throws Exception {
        seedOnce();
        MvcResult listResult = mvc.perform(get("/api/v1/interviews").param("q", "SETNX")).andReturn();
        int id = JsonPath.read(listResult.getResponse().getContentAsString(), "$.data.items[0].id");

        mvc.perform(get("/api/v1/interviews/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.department").value("抖音电商"))
                .andExpect(jsonPath("$.data.position.name").value("后端开发"))
                .andExpect(jsonPath("$.data.firstInterviewDate").value("2026-09-23"))
                .andExpect(jsonPath("$.data.rounds.length()").value(2))
                .andExpect(jsonPath("$.data.rounds[0].displayName").value("一面"))
                .andExpect(jsonPath("$.data.rounds[0].questions.length()").value(5))
                .andExpect(jsonPath("$.data.rounds[0].questions[3].questionType").value("ALGORITHM"))
                .andExpect(jsonPath("$.data.rounds[0].questions[3].leetcodeNumber").value(53))
                .andExpect(jsonPath("$.data.rounds[1].questions.length()").value(0))
                .andExpect(jsonPath("$.data.sources.length()").value(2));
    }

    @Test
    void contract_errors_end_to_end() throws Exception {
        seedOnce();
        mvc.perform(get("/api/v1/interviews").param("companyId", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/interviews/999999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INTERVIEW_NOT_FOUND"));
    }

    @Test
    void security_semantics_end_to_end() throws Exception {
        seedOnce();
        // 公开读接口匿名可用（安全链开启后全量回归仍通过）
        mvc.perform(get("/api/v1/interviews").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("SUCCESS"));
        // 匿名 me → 401 + AUTH_REQUIRED；匿名 admin → 401（先认证后授权）
        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
        mvc.perform(get("/api/v1/admin/reviews/interviews"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
        // CSRF 初始化写出 XSRF-TOKEN Cookie
        mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.headerName").value("X-XSRF-TOKEN"));
        // 未带 CSRF Token 的写请求被拒
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .post("/api/v1/auth/logout"))
                .andExpect(status().isForbidden());
    }
}
