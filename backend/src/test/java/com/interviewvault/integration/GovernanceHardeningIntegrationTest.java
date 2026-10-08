package com.interviewvault.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.OAuth2LoginRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.interviewvault.auth.entity.User;
import com.interviewvault.auth.enums.UserRole;
import com.interviewvault.auth.repository.UserMapper;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.interview.dto.request.FollowUpInput;
import com.interviewvault.interview.dto.request.InterviewSubmitRequest;
import com.interviewvault.interview.dto.request.InterviewUpsertRequest;
import com.interviewvault.interview.dto.request.QuestionInput;
import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.enums.RoundType;
import com.interviewvault.review.dto.request.AdminPublishedInterviewUpdateRequest;
import com.interviewvault.review.dto.request.ChangeRequestUpsertRequest;
import com.interviewvault.review.entity.ChangeRequest;
import com.interviewvault.review.enums.ChangeRequestStatus;
import com.interviewvault.review.enums.ChangeRequestType;
import com.interviewvault.review.repository.ChangeRequestMapper;
import com.jayway.jsonpath.JsonPath;

/**
 * 治理加固回归（对应开源就绪审计）：
 * R1 变更申请不完整 payload 入口拒绝 / 批准前复核；
 * R2 管理员直改 stale version 409；R3 白名单撤权即时生效；
 * R4 匿名加油限流；R5 分页与长度上限；R9 作者变更不删隐藏来源；
 * R10 重复 tag / 已绑定候选 resolve；R11 列表默认 PENDING；R14 稳定错误文案。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class GovernanceHardeningIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18");

    @Autowired
    private MockMvc mvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserMapper users;
    @Autowired
    private CompanyMapper companies;
    @Autowired
    private PositionMapper positions;

    @Autowired
    private com.interviewvault.catalog.repository.PositionCategoryMapper positionCategories;
    @Autowired
    private TagMapper tags;
    @Autowired
    private ChangeRequestMapper changeRequests;
    @Autowired
    private ConfigurableEnvironment environment;

    private long newUser(String login) {
        User user = new User(System.nanoTime(), login, null, UserRole.USER);
        users.insert(user);
        return user.getId();
    }

    private long newAdmin(String login) {
        User user = new User(System.nanoTime(), login, null, UserRole.ADMIN);
        users.insert(user);
        return user.getId();
    }

    private OAuth2LoginRequestPostProcessor asUser(long userId) {
        return oauth2Login().attributes(a -> a.put("userId", userId))
                .authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }

    private OAuth2LoginRequestPostProcessor asAdmin(long userId) {
        return oauth2Login().attributes(a -> a.put("userId", userId))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    /** 带真实 GitHub 数字 id 的管理员主体（R3 白名单裁决读 attributes.id）。 */
    private OAuth2LoginRequestPostProcessor asAdminWithGithubId(long userId, long githubId) {
        return oauth2Login().attributes(a -> {
            a.put("userId", userId);
            a.put("id", githubId);
        }).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private String body(Object request) throws Exception {
        return objectMapper.writeValueAsString(request);
    }

    private long company(String name) {
        var existing = companies.selectOne(new LambdaQueryWrapper<com.interviewvault.catalog.entity.Company>()
                .eq(com.interviewvault.catalog.entity.Company::getNormalizedName, name.toLowerCase()));
        if (existing != null) {
            return existing.getId();
        }
        var created = new com.interviewvault.catalog.entity.Company(name, name.toLowerCase());
        companies.insert(created);
        return created.getId();
    }


    private Long backendCategoryId() {
        var row = positionCategories.selectOne(
                new LambdaQueryWrapper<com.interviewvault.catalog.entity.PositionCategoryRow>()
                        .eq(com.interviewvault.catalog.entity.PositionCategoryRow::getName, "后端开发"));
        if (row == null) {
            var seeded = new com.interviewvault.catalog.entity.PositionCategoryRow(
                    "后端开发", "后端开发", 4);
            positionCategories.insert(seeded);
            return seeded.getId();
        }
        return row.getId();
    }

    private long position(String name) {
        var existing = positions.selectOne(new LambdaQueryWrapper<com.interviewvault.catalog.entity.Position>()
                .eq(com.interviewvault.catalog.entity.Position::getNormalizedName, name.toLowerCase()));
        if (existing != null) {
            return existing.getId();
        }
        var created = new com.interviewvault.catalog.entity.Position(name, name.toLowerCase(),
                backendCategoryId());
        positions.insert(created);
        return created.getId();
    }

    private long createDraft(long user) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/me/interviews").with(asUser(user)).with(csrf()))
                .andExpect(status().isCreated()).andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.data.id")).longValue();
    }

    /** 完整投稿 → 提交 → 发布，返回 id（PUBLISHED，version=3）。 */
    private long publishedInterview(long author, long companyId, long positionId, String content,
                                    long admin) throws Exception {
        long id = createDraft(author);
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new InterviewUpsertRequest(0L,
                                new SelectionInput(companyId, null), new SelectionInput(positionId, null),
                                null, RecruitType.CAMPUS, null, null,
                                List.of(new RoundInput(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 5),
                                        List.of(new QuestionInput(null, content, null, List.of())))),
                                null))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/me/interviews/{id}/submit", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(1L))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/publish", id)
                        .with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(2L))))
                .andExpect(status().isOk());
        return id;
    }

    private ObjectNode completeUpdatePayload(long companyId, long positionId, String question,
                                             String sourceUrl) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("company", objectMapper.valueToTree(new SelectionInput(companyId, null)));
        payload.set("position", objectMapper.valueToTree(new SelectionInput(positionId, null)));
        payload.put("recruitType", "CAMPUS");
        payload.set("tagIds", objectMapper.createArrayNode());
        payload.set("proposedTags", objectMapper.createArrayNode());
        payload.set("rounds", objectMapper.valueToTree(List.of(new RoundInput(null, RoundType.TECHNICAL,
                1, LocalDate.of(2026, 10, 6),
                List.of(new QuestionInput(null, question, null, List.of()))))));
        if (sourceUrl != null) {
            payload.put("sourceUrl", sourceUrl);
        }
        return payload;
    }

    // ==================== R1：不完整 payload ====================

    @Test
    void change_request_upsert_rejects_noop_payload() throws Exception {
        long admin = newAdmin("admin-r1noop");
        long author = newUser("author-r1noop");
        long companyId = company("R1NOOP科技");
        long id = publishedInterview(author, companyId, position("R1NOOP后端"), "R1NOOP 原问题", admin);

        // 基线 canonical 按前端 payloadFromInterview 同一套映射转成目标版本：与当前内容逐字段一致
        JsonNode interview = objectMapper.readTree(mvc
                .perform(get("/api/v1/me/interviews/{id}/change-request", id).with(asUser(author)))
                .andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("data").path("interview");
        ObjectNode noop = objectMapper.createObjectNode();
        noop.set("company", objectMapper.createObjectNode()
                .put("existingId", interview.path("company").path("id").asLong()));
        noop.set("position", objectMapper.createObjectNode()
                .put("existingId", interview.path("position").path("id").asLong()));
        noop.putNull("department");
        noop.put("recruitType", interview.path("recruitType").asText());
        noop.set("tagIds", objectMapper.createArrayNode());
        noop.set("proposedTags", objectMapper.createArrayNode());
        ArrayNode rounds = objectMapper.createArrayNode();
        for (JsonNode round : interview.path("rounds")) {
            ObjectNode roundNode = objectMapper.createObjectNode();
            roundNode.put("id", round.path("id").asLong());
            roundNode.put("roundType", round.path("roundType").asText());
            roundNode.put("roundNo", round.path("roundNo").asInt());
            roundNode.put("interviewDate", round.path("interviewDate").asText());
            ArrayNode questions = objectMapper.createArrayNode();
            for (JsonNode question : round.path("questions")) {
                ObjectNode questionNode = objectMapper.createObjectNode();
                questionNode.put("id", question.path("id").asLong());
                questionNode.put("content", question.path("content").asText());
                questionNode.putNull("referenceUrl");
                questionNode.set("followUps", objectMapper.createArrayNode());
                questions.add(questionNode);
            }
            roundNode.set("questions", questions);
            rounds.add(roundNode);
        }
        noop.set("rounds", rounds);
        noop.putNull("sourceUrl");

        // 空跑申请：400，且不产生 PENDING 记录
        mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("UPDATE", 3L, noop, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("内容没有任何变化，无需提交修改申请"));
        assertThat(changeRequests.selectCount(new LambdaQueryWrapper<ChangeRequest>()
                .eq(ChangeRequest::getInterviewId, id))).isZero();

        // 同一 payload 改一个字即恢复可提交，防止比对误伤
        ObjectNode real = noop.deepCopy();
        ((ObjectNode) real.path("rounds").get(0).path("questions").get(0))
                .put("content", "R1NOOP 新问题");
        mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("UPDATE", 3L, real, null))))
                .andExpect(status().isOk());
    }

    @Test
    void change_request_upsert_rejects_incomplete_payload() throws Exception {
        long admin = newAdmin("admin-r1a");
        long author = newUser("author-r1a");
        long id = publishedInterview(author, company("R1科技"), position("R1后端"), "R1 原问题", admin);

        // 非空但不完整：缺公司 / 岗位 / 轮次
        ObjectNode partial = objectMapper.createObjectNode();
        partial.put("department", "只有部门");
        mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("UPDATE", 3L, partial, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INTERVIEW_INCOMPLETE"));
        assertThat(changeRequests.selectCount(new LambdaQueryWrapper<ChangeRequest>()
                .eq(ChangeRequest::getInterviewId, id))).isZero();

        // 空 rounds 同理拒绝（曾有漏洞：批准后清空已发布聚合）
        ObjectNode noRounds = completeUpdatePayload(company("R1科技"), position("R1后端"), "R1 新问题", null);
        noRounds.set("rounds", objectMapper.createArrayNode());
        mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("UPDATE", 3L, noRounds, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INTERVIEW_INCOMPLETE"));
    }

    @Test
    void change_request_upsert_strips_unknown_fields_and_rejects_bad_urls() throws Exception {
        long admin = newAdmin("admin-r1b");
        long author = newUser("author-r1b");
        long companyId = company("R1B科技");
        long id = publishedInterview(author, companyId, position("R1B后端"), "R1B 原问题", admin);

        // javascript: URL 不进库
        ObjectNode evil = completeUpdatePayload(companyId, position("R1B后端"), "R1B 新问题", null);
        evil.set("rounds", objectMapper.valueToTree(List.of(new RoundInput(null, RoundType.TECHNICAL,
                1, LocalDate.of(2026, 10, 6),
                List.of(new QuestionInput(null, "R1B 新问题", "javascript:alert(1)", List.of()))))));
        mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("UPDATE", 3L, evil, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        // 合法 payload 夹带未知字段：落库的是规范形，未知字段被剔除
        ObjectNode payload = completeUpdatePayload(companyId, position("R1B后端"), "R1B 新问题", null);
        payload.put("junk", "should-not-persist");
        MvcResult created = mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("UPDATE", 3L, payload, null))))
                .andExpect(status().isOk()).andReturn();
        assertThat(created.getResponse().getContentAsString()).doesNotContain("should-not-persist");
    }

    @Test
    void approve_rechecks_payload_completeness_for_legacy_requests() throws Exception {
        long admin = newAdmin("admin-r1c");
        long author = newUser("author-r1c");
        long id = publishedInterview(author, company("R1C科技"), position("R1C后端"), "R1C 原问题", admin);

        // 绕过 API 直接落一条不完整 PENDING 申请（模拟入口校验上线前的历史数据）
        ChangeRequest legacy = new ChangeRequest(id, author, ChangeRequestType.UPDATE, 3L,
                "{\"department\":\"不完整历史payload\"}", "历史申请");
        changeRequests.insert(legacy);

        mvc.perform(post("/api/v1/admin/change-requests/{id}/approve", legacy.getId())
                        .with(asAdmin(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestDecisionRequest(
                                changeRequests.selectById(legacy.getId()).getRequestVersion()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INTERVIEW_INCOMPLETE"));

        // 正式内容与申请状态都没动
        mvc.perform(get("/api/v1/interviews/{id}", id))
                .andExpect(jsonPath("$.data.rounds[0].questions[0].content").value("R1C 原问题"));
        assertThat(changeRequests.selectById(legacy.getId()).getStatus())
                .isEqualTo(ChangeRequestStatus.PENDING);
    }

    // ==================== R2：直改乐观锁 ====================

    @Test
    void admin_direct_edit_with_stale_version_returns_409() throws Exception {
        long admin = newAdmin("admin-r2");
        long author = newUser("author-r2");
        long companyId = company("R2科技");
        long positionId = position("R2后端");
        long id = publishedInterview(author, companyId, positionId, "R2 原问题", admin);

        AdminPublishedInterviewUpdateRequest firstEdit = new AdminPublishedInterviewUpdateRequest(
                3L, new SelectionInput(companyId, null), new SelectionInput(positionId, null),
                null, RecruitType.CAMPUS, null, null,
                List.of(new RoundInput(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 5),
                        List.of(new QuestionInput(null, "R2 第一次修改", null, List.of())))),
                List.of());
        mvc.perform(put("/api/v1/admin/interviews/{id}", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(firstEdit)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.version").value(4));

        // 另一个管理员还开着 version=3 的旧编辑页：保存必须 409，而不是静默覆盖
        AdminPublishedInterviewUpdateRequest staleEdit = new AdminPublishedInterviewUpdateRequest(
                3L, new SelectionInput(companyId, null), new SelectionInput(positionId, null),
                null, RecruitType.CAMPUS, null, null,
                List.of(new RoundInput(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 5),
                        List.of(new QuestionInput(null, "R2 旧页面覆盖", null, List.of())))),
                List.of());
        mvc.perform(put("/api/v1/admin/interviews/{id}", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(staleEdit)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_VERSION_CONFLICT"));
        mvc.perform(get("/api/v1/interviews/{id}", id))
                .andExpect(jsonPath("$.data.rounds[0].questions[0].content").value("R2 第一次修改"));
    }

    // ==================== R3：白名单撤权 ====================

    @Test
    void admin_authority_revoked_by_whitelist_immediately() throws Exception {
        long adminUserId = newAdmin("admin-r3");
        java.util.HashMap<String, Object> whitelistConfig = new java.util.HashMap<>();
        whitelistConfig.put("iv.auth.admin-github-ids", "424242424");
        MapPropertySource whitelist = new MapPropertySource("test-admin-whitelist", whitelistConfig);
        environment.getPropertySources().addFirst(whitelist);
        try {
            // 会话里仍是 ROLE_ADMIN，但 GitHub id=999 不在新白名单 → 立即 403
            mvc.perform(get("/api/v1/admin/change-requests")
                            .with(asAdminWithGithubId(adminUserId, 999L)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

            // 白名单换人后正确 id 放行（同一会话主体语义）
            whitelistConfig.put("iv.auth.admin-github-ids", "999");
            mvc.perform(get("/api/v1/admin/change-requests")
                            .with(asAdminWithGithubId(adminUserId, 999L)))
                    .andExpect(status().isOk());
        } finally {
            environment.getPropertySources().remove("test-admin-whitelist");
        }
    }

    // ==================== R4：匿名加油限流 ====================

    @Test
    void anonymous_cheer_is_rate_limited_per_ip() throws Exception {
        RequestPostProcessor fromIp = req -> {
            req.setRemoteAddr("198.51.100.77");
            return req;
        };
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/v1/cheers").with(csrf()).with(fromIp))
                    .andExpect(status().isOk());
        }
        mvc.perform(post("/api/v1/cheers").with(csrf()).with(fromIp))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("CHEER_RATE_LIMITED"));
        // 不同 IP 不受牵连
        mvc.perform(post("/api/v1/cheers").with(csrf()).with(req -> {
                    req.setRemoteAddr("198.51.100.88");
                    return req;
                }))
                .andExpect(status().isOk());
    }

    // ==================== R5：参数与负载上限 ====================

    @Test
    void pagination_and_length_limits_return_stable_400() throws Exception {
        mvc.perform(get("/api/v1/interviews").param("page", "99999"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/interviews").param("q", "关键词".repeat(34)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        long author = newUser("author-r5");
        long id = createDraft(author);
        // 部门超 100 字符 → 400
        InterviewUpsertRequest tooLong = new InterviewUpsertRequest(0L, null, null,
                "部".repeat(101), null, null, null, null, null);
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(tooLong)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void oversized_request_body_rejected_with_413() throws Exception {
        long author = newUser("author-r5b");
        long id = createDraft(author);
        String huge = objectMapper.writeValueAsString(new InterviewUpsertRequest(0L, null, null,
                "x".repeat(1024 * 1024 + 100), null, null, null, null, null));
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(huge))
                .andExpect(status().isRequestEntityTooLarge())
                .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
    }

    // ==================== R9：作者变更不删隐藏来源 ====================

    @Test
    void approve_update_replaces_only_author_visible_source() throws Exception {
        long admin = newAdmin("admin-r9");
        long author = newUser("author-r9");
        long companyId = company("R9科技");
        long positionId = position("R9后端");
        long id = publishedInterview(author, companyId, positionId, "R9 原问题", admin);

        // 管理员补充多来源 [A, B]
        AdminPublishedInterviewUpdateRequest multiSource = new AdminPublishedInterviewUpdateRequest(
                3L, new SelectionInput(companyId, null), new SelectionInput(positionId, null),
                null, RecruitType.CAMPUS, null, null,
                List.of(new RoundInput(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 5),
                        List.of(new QuestionInput(null, "R9 原问题", null, List.of())))),
                List.of("https://a.r9.example.com", "https://b.r9.example.com"));
        mvc.perform(put("/api/v1/admin/interviews/{id}", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(multiSource)))
                .andExpect(status().isOk());

        // 作者（基线只见第一条 A）把来源改为 C 并修改问题，批准后：A→C，B 保留
        ObjectNode payload = completeUpdatePayload(companyId, positionId, "R9 新问题",
                "https://c.r9.example.com");
        MvcResult created = mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("UPDATE", 4L, payload, null))))
                .andExpect(status().isOk()).andReturn();
        long crId = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.data.id")).longValue();

        mvc.perform(post("/api/v1/admin/change-requests/{id}/approve", crId)
                        .with(asAdmin(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestDecisionRequest(
                                changeRequests.selectById(crId).getRequestVersion()))))
                .andExpect(status().isOk());

        String detail = mvc.perform(get("/api/v1/admin/interviews/{id}", id).with(asAdmin(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(detail).contains("https://c.r9.example.com");
        assertThat(detail).contains("https://b.r9.example.com");
        assertThat(detail).doesNotContain("https://a.r9.example.com");
    }

    // ==================== R10：重复 tag / 已绑定候选 ====================

    @Test
    void duplicate_tag_ids_rejected_instead_of_500() throws Exception {
        long author = newUser("author-r10");
        Tag tag = new Tag("R10标签", "r10标签");
        tags.insert(tag);
        long id = createDraft(author);
        InterviewUpsertRequest request = new InterviewUpsertRequest(0L, null, null, null, null,
                List.of(tag.getId(), tag.getId()), null, null, null);
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void resolving_tag_candidate_already_bound_is_idempotent() throws Exception {
        long admin = newAdmin("admin-r10b");
        long author = newUser("author-r10b");
        long companyId = company("R10B科技");
        long positionId = position("R10B后端");
        Tag tag = new Tag("R10B已绑定", "r10b已绑定");
        tags.insert(tag);

        // 面经已正式绑定该 tag，作者又提议了同名候选
        long id = createDraft(author);
        InterviewUpsertRequest request = new InterviewUpsertRequest(0L,
                new SelectionInput(companyId, null), new SelectionInput(positionId, null),
                null, RecruitType.CAMPUS, List.of(tag.getId()), List.of(tag.getName()),
                List.of(new RoundInput(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 5),
                        List.of(new QuestionInput(null, "R10B 问题", null, List.of())))),
                null);
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/me/interviews/{id}/submit", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(1L))))
                .andExpect(status().isOk());

        String detail = mvc.perform(get("/api/v1/admin/reviews/interviews/{id}", id).with(asAdmin(admin)))
                .andReturn().getResponse().getContentAsString();
        long candidateId = ((Number) JsonPath.read(detail, "$.data.candidates[0].id")).longValue();
        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/candidates/{cid}/resolve",
                        id, candidateId).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.CandidateResolveRequest(
                                2L, "USE_EXISTING", tag.getId(), null, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.version").value(3));
    }

    // ==================== R11：列表默认 PENDING ====================

    @Test
    void change_request_list_defaults_to_pending() throws Exception {
        long admin = newAdmin("admin-r11");
        long author = newUser("author-r11");
        long idA = publishedInterview(author, company("R11A科技"), position("R11A后端"), "R11A 问题", admin);
        long idB = publishedInterview(author, company("R11B科技"), position("R11B后端"), "R11B 问题", admin);

        // A 的申请批准（变 APPROVED），B 的保持 PENDING
        MvcResult createdA = mvc.perform(put("/api/v1/me/interviews/{id}/change-request", idA)
                        .with(asUser(author)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("DELETE", 3L, null, "下架 A"))))
                .andExpect(status().isOk()).andReturn();
        long crA = ((Number) JsonPath.read(createdA.getResponse().getContentAsString(), "$.data.id")).longValue();
        mvc.perform(post("/api/v1/admin/change-requests/{id}/approve", crA)
                        .with(asAdmin(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestDecisionRequest(
                                changeRequests.selectById(crA).getRequestVersion()))))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/me/interviews/{id}/change-request", idB)
                        .with(asUser(author)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new ChangeRequestUpsertRequest("DELETE", 3L, null, "下架 B"))))
                .andExpect(status().isOk());

        // 默认（不带 status）只看 PENDING；显式 APPROVED 才含已批准
        String defaultList = mvc.perform(get("/api/v1/admin/change-requests").with(asAdmin(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(defaultList).contains("下架 B");
        assertThat(defaultList).doesNotContain("下架 A");

        String approvedList = mvc.perform(get("/api/v1/admin/change-requests")
                        .param("status", "APPROVED").with(asAdmin(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(approvedList).contains("下架 A");
        assertThat(approvedList).doesNotContain("下架 B");
    }

    // ==================== R14：稳定错误文案 ====================

    @Test
    void malformed_json_returns_stable_message_without_framework_details() throws Exception {
        long author = newUser("author-r14");
        mvc.perform(put("/api/v1/me/interviews/{id}", 1).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\": bad"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("请求参数非法"));
    }
}
