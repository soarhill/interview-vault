package com.interviewvault.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oauth2Login;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.OAuth2LoginRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.dockerjava.zerodep.shaded.org.apache.hc.core5.http.HttpHeaders;
import com.interviewvault.auth.entity.User;
import com.interviewvault.auth.enums.UserRole;
import com.interviewvault.auth.repository.UserMapper;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.enums.PositionCategory;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.interview.dto.request.FollowUpInput;
import com.interviewvault.interview.dto.request.InterviewSubmitRequest;
import com.interviewvault.interview.dto.request.InterviewUpsertRequest;
import com.interviewvault.interview.dto.request.QuestionInput;
import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.interview.entity.InterviewCandidate;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.entity.InterviewRound;
import com.interviewvault.interview.entity.Question;
import com.interviewvault.interview.entity.SubmissionSnapshot;
import com.interviewvault.interview.enums.CandidateType;
import com.interviewvault.interview.enums.InterviewDatePrecision;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.enums.RoundType;
import com.interviewvault.interview.repository.InterviewCandidateMapper;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.repository.InterviewRoundMapper;
import com.interviewvault.interview.repository.QuestionMapper;
import com.interviewvault.interview.repository.SubmissionSnapshotMapper;
import com.jayway.jsonpath.JsonPath;

/**
 * 投稿聚合真库集成测试：差异更新引擎（id 稳定 / 跨轮移动 / 缺失删除 / 重排）、
 * 状态语义（REJECTED→DRAFT、PENDING_REVIEW 保持）、版本冲突、纯草稿删除、
 * 资源级权限、Candidate 单值、提交审核完整性 + Snapshot。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class SubmissionIntegrationTest {

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
    private InterviewRecordMapper interviews;
    @Autowired
    private InterviewCandidateMapper candidates;
    @Autowired
    private SubmissionSnapshotMapper snapshots;

    @Autowired
    private QuestionMapper questions;

    @Autowired
    private InterviewRoundMapper rounds;

    /** 每个测试自建用户与目录，互不干扰。 */
    private long newUser(String login) {
        User user = new User(System.nanoTime(), login, null, UserRole.USER);
        users.insert(user);
        return user.getId();
    }

    private long newCompany(String name) {
        Company existing = companies.selectOne(new LambdaQueryWrapper<Company>()
                .eq(Company::getNormalizedName, name.toLowerCase()));
        if (existing != null) {
            return existing.getId();
        }
        Company company = new Company(name, name.toLowerCase());
        companies.insert(company);
        return company.getId();
    }

    private long newPosition(String name) {
        Position existing = positions.selectOne(new LambdaQueryWrapper<Position>()
                .eq(Position::getNormalizedName, name.toLowerCase()));
        if (existing != null) {
            return existing.getId();
        }
        Position position = new Position(name, name.toLowerCase(), backendCategoryId());
        positions.insert(position);
        return position.getId();
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

    private OAuth2LoginRequestPostProcessor asUser(long userId) {
        return oauth2Login()
                .attributes(a -> a.put("userId", userId))
                .authorities(new SimpleGrantedAuthority("ROLE_USER"));
    }

    private long createDraft(long userId) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/me/interviews").with(asUser(userId)).with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.version").value(0))
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.data.id")).longValue();
    }

    private String body(Object request) throws Exception {
        return objectMapper.writeValueAsString(request);
    }

    // record 构造辅助（不用 builder，直接组装）
    private InterviewUpsertRequest upsert(long version, Long companyId, Long positionId,
                                          String proposedCompany, List<RoundInput> rounds) {
        return new InterviewUpsertRequest(version,
                companyId != null || proposedCompany == null
                        ? new SelectionInput(companyId, null) : new SelectionInput(null, proposedCompany),
                new SelectionInput(positionId, null),
                null, RecruitType.CAMPUS, null, null, rounds, null);
    }

    private RoundInput round(Long id, RoundType type, Integer no, LocalDate date, List<QuestionInput> questions) {
        return new RoundInput(id, type, no, date, questions);
    }

    private QuestionInput question(Long id, String content, List<FollowUpInput> followUps) {
        return new QuestionInput(id, content, null, followUps);
    }

    @Test
    void aggregate_save_diff_engine_keeps_ids_moves_and_deletes() throws Exception {
        long user = newUser("diff-user");
        long companyId = newCompany("差异科技");
        long positionId = newPosition("后端开发");
        long id = createDraft(user);

        // 第一次保存：两轮三问两追问（全部新建）
        InterviewUpsertRequest first = upsert(0, companyId, positionId, null, List.of(
                round(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 9, 20), List.of(
                        question(null, "Q1 Redis 持久化", List.of(new FollowUpInput(null, "F1 RDB 区别"))),
                        question(null, "Q2 MVCC", List.of()))),
                round(null, RoundType.HR, null, null, List.of(
                        question(null, "Q3 职业规划", List.of(
                                new FollowUpInput(null, "F2 为什么"),
                                new FollowUpInput(null, "F3 期望薪资")))))));
        MvcResult saved1 = mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(first)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.version").value(1))
                .andReturn();
        String json1 = saved1.getResponse().getContentAsString();
        long round1Id = ((Number) JsonPath.read(json1, "$.data.interview.rounds[0].id")).longValue();
        long round2Id = ((Number) JsonPath.read(json1, "$.data.interview.rounds[1].id")).longValue();
        long q1Id = ((Number) JsonPath.read(json1, "$.data.interview.rounds[0].questions[0].id")).longValue();
        long q3Id = ((Number) JsonPath.read(json1, "$.data.interview.rounds[1].questions[0].id")).longValue();
        long f2Id = ((Number) JsonPath.read(json1, "$.data.interview.rounds[1].questions[0].followUps[0].id")).longValue();

        // 第二次保存（version=1）：Q2 删除、Q1 挪到 HR 轮、追问 F3 删除、轮次重排（HR 提前）
        InterviewUpsertRequest second = new InterviewUpsertRequest(1L,
                new SelectionInput(companyId, null), new SelectionInput(positionId, null),
                null, RecruitType.CAMPUS, null, null, List.of(
                // 原 HR 轮（id 不变）提前到第 1 位，Q3 带原 id、保留 F2 删 F3，并接收 Q1
                round(round2Id, RoundType.HR, null, null, List.of(
                        question(q3Id, "Q3 职业规划", List.of(new FollowUpInput(f2Id, "为什么"))),
                        question(q1Id, "Q1 Redis 持久化", List.of(new FollowUpInput(null, "F1 RDB 区别"))))),
                // 原技术一轮（id 不变）排第 2
                round(round1Id, RoundType.TECHNICAL, 1, LocalDate.of(2026, 9, 20), List.of())),
                null);
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(second)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.version").value(2))
                .andExpect(jsonPath("$.data.interview.rounds.length()").value(2))
                // id 全部稳定：轮次 id 不变、Q1/Q3 id 不变、F2 id 不变
                .andExpect(jsonPath("$.data.interview.rounds[0].id").value(round2Id))
                .andExpect(jsonPath("$.data.interview.rounds[1].id").value(round1Id))
                .andExpect(jsonPath("$.data.interview.rounds[0].questions[0].id").value(q3Id))
                .andExpect(jsonPath("$.data.interview.rounds[0].questions[0].followUps[0].id").value(f2Id))
                // Q1 移动后仍在（id 稳定），Q2 已删除
                .andExpect(jsonPath("$.data.interview.rounds[0].questions[1].id").value(q1Id))
                .andExpect(jsonPath("$.data.interview.rounds[1].questions.length()").value(0));

        // 详情基线与 canonical 一致
        mvc.perform(get("/api/v1/me/interviews/{id}", id).with(asUser(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.version").value(2))
                .andExpect(jsonPath("$.data.actions.canEdit").value(true))
                .andExpect(jsonPath("$.data.actions.canDeleteDraft").value(true))
                .andExpect(jsonPath("$.data.actions.canSubmit").value(true));
    }

    @Test
    void reference_url_infers_algorithm_and_preserves_legacy_fields() throws Exception {
        long user = newUser("link-user");
        long companyId = newCompany("链接科技");
        long positionId = newPosition("后端开发");
        long id = createDraft(user);

        // 新投稿：带题目链接的问题 → ALGORITHM；无链接 → NORMAL
        InterviewUpsertRequest first = upsert(0, companyId, positionId, null, List.of(
                round(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 2), List.of(
                        new QuestionInput(null, "手写 LRU",
                                "https://leetcode.com/problems/lru-cache/", List.of()),
                        question(null, "讲一下 MVCC", List.of())))));
        MvcResult saved = mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(first)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.rounds[0].questions[0].referenceUrl")
                        .value("https://leetcode.com/problems/lru-cache/"))
                .andExpect(jsonPath("$.data.interview.rounds[0].questions[0].questionType").value("ALGORITHM"))
                .andExpect(jsonPath("$.data.interview.rounds[0].questions[1].questionType").value("NORMAL"))
                .andReturn();
        String json = saved.getResponse().getContentAsString();
        long roundId = ((Number) JsonPath.read(json, "$.data.interview.rounds[0].id")).longValue();
        long q1Id = ((Number) JsonPath.read(json, "$.data.interview.rounds[0].questions[0].id")).longValue();
        long q2Id = ((Number) JsonPath.read(json, "$.data.interview.rounds[0].questions[1].id")).longValue();

        // 改成「历史导入」形态：reference_url 清空、legacy 字段与月精度写入库
        questions.update(new LambdaUpdateWrapper<Question>()
                .eq(Question::getId, q1Id)
                .set(Question::getReferenceUrl, null)
                .set(Question::getSectionLabel, "算法")
                .set(Question::getContextNote, "历史上下文")
                .set(Question::getLeetcodeNumber, 146)
                .set(Question::getLeetcodeUrl, "https://leetcode.cn/problems/lru-cache/"));
        rounds.update(new LambdaUpdateWrapper<InterviewRound>()
                .eq(InterviewRound::getId, roundId)
                .set(InterviewRound::getInterviewDatePrecision, InterviewDatePrecision.MONTH));

        // 编辑基线：referenceUrl 由 legacy leetcode_url 兜底返回
        mvc.perform(get("/api/v1/me/interviews/{id}", id).with(asUser(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rounds[0].questions[0].referenceUrl")
                        .value("https://leetcode.cn/problems/lru-cache/"))
                .andExpect(jsonPath("$.data.rounds[0].questions[0].leetcodeNumber").value(146));

        // 保存（编辑表单把兜底链接 seed 回 referenceUrl、日期未变）：legacy 字段与月精度全部原样保留
        InterviewUpsertRequest second = upsert(1, companyId, positionId, null, List.of(
                round(roundId, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 2), List.of(
                        new QuestionInput(q1Id, "手写 LRU",
                                "https://leetcode.cn/problems/lru-cache/", List.of(
                                new FollowUpInput(null, "要求 O(1)")))))));
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(second)))
                .andExpect(status().isOk());
        Question row = questions.selectById(q1Id);
        assertThat(row.getReferenceUrl()).isEqualTo("https://leetcode.cn/problems/lru-cache/");
        assertThat(row.getLeetcodeNumber()).isEqualTo(146);
        assertThat(row.getSectionLabel()).isEqualTo("算法");
        assertThat(row.getContextNote()).isEqualTo("历史上下文");
        assertThat(rounds.selectById(roundId).getInterviewDatePrecision())
                .isEqualTo(InterviewDatePrecision.MONTH);
        // Q2 未回传 → 删除（差异引擎语义），与字段保护互不影响
        assertThat(questions.selectById(q2Id)).isNull();

        // 清空链接保存 → 用户删除链接：reference_url 与 legacy leetcode_url 同步清空，类型只升不降
        InterviewUpsertRequest third = upsert(2, companyId, positionId, null, List.of(
                round(roundId, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 3), List.of(
                        question(q1Id, "手写 LRU", List.of())))));
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(third)))
                .andExpect(status().isOk());
        Question cleared = questions.selectById(q1Id);
        assertThat(cleared.getReferenceUrl()).isNull();
        assertThat(cleared.getLeetcodeUrl()).isNull();
        assertThat(cleared.getLeetcodeNumber()).isEqualTo(146);
        assertThat(cleared.getQuestionType().name()).isEqualTo("ALGORITHM");
        // 日期变化 → 按 DAY 写入
        assertThat(rounds.selectById(roundId).getInterviewDatePrecision())
                .isEqualTo(InterviewDatePrecision.DAY);
    }

    @Test
    void stale_version_yields_409() throws Exception {
        long user = newUser("version-user");
        long id = createDraft(user);
        InterviewUpsertRequest request = upsert(0, newCompany("版本科技"), newPosition("后端开发"), null, List.of());
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isOk());
        // 重复使用旧 version=0 → 409
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_VERSION_CONFLICT"));
    }

    @Test
    void submit_validates_completeness_and_writes_snapshot() throws Exception {
        long user = newUser("submit-user");
        long positionId = newPosition("Agent 开发");
        long id = createDraft(user);

        // 提出候选公司 + 正式岗位 + 一轮一问
        InterviewUpsertRequest request = upsert(0, null, positionId, "OpenAI", List.of(
                round(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 1), List.of(
                        question(null, "如何设计记忆系统", List.of())))));
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.company.source").value("PROPOSED"))
                .andExpect(jsonPath("$.data.interview.company.name").value("OpenAI"))
                .andExpect(jsonPath("$.data.interview.position.source").value("OFFICIAL"));

        // COMPANY 候选单值（partial unique 兜底之上，业务替换语义）
        assertThat(candidates.selectList(new LambdaQueryWrapper<InterviewCandidate>()
                .eq(InterviewCandidate::getInterviewId, id)
                .eq(InterviewCandidate::getType, CandidateType.COMPANY))).hasSize(1);

        mvc.perform(post("/api/v1/me/interviews/{id}/submit", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new InterviewSubmitRequest(1L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_REVIEW"))
                .andExpect(jsonPath("$.data.version").value(2));

        List<SubmissionSnapshot> stored = snapshots.selectList(
                new LambdaQueryWrapper<SubmissionSnapshot>().eq(SubmissionSnapshot::getInterviewId, id));
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getPayload()).contains("OpenAI");

        // 我的投稿列表：状态与计数
        mvc.perform(get("/api/v1/me/interviews").with(asUser(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].status").value("PENDING_REVIEW"))
                .andExpect(jsonPath("$.data.items[0].roundCount").value(1))
                .andExpect(jsonPath("$.data.items[0].questionCount").value(1))
                .andExpect(jsonPath("$.data.items[0].actions.canDeleteDraft").value(false))
                .andExpect(jsonPath("$.data.items[0].actions.canEdit").value(true));
    }

    @Test
    void submit_incomplete_yields_400() throws Exception {
        long user = newUser("incomplete-user");
        long id = createDraft(user);
        InterviewUpsertRequest empty = upsert(0, null, null, null, List.of());
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(empty)))
                .andExpect(status().isOk()); // 草稿允许不完整
        mvc.perform(post("/api/v1/me/interviews/{id}/submit", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new InterviewSubmitRequest(1L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INTERVIEW_INCOMPLETE"));
    }

    @Test
    void rejected_save_returns_to_draft_and_clears_reason() throws Exception {
        long user = newUser("rejected-user");
        long companyId = newCompany("被拒科技");
        long positionId = newPosition("后端开发");
        long id = createDraft(user);
        // 完整内容：一轮一问（满足 submit 完整性）
        InterviewUpsertRequest request = upsert(0L, companyId, positionId, null, List.of(
                round(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 9, 21), List.of(
                        question(null, "讲讲事务隔离", List.of())))));
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/me/interviews/{id}/submit", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(1L))))
                .andExpect(status().isOk());

        // 模拟被拒（真实拒绝动作在审核切片落地）：此时已有快照 → 进入过审核历史
        interviews.update(null, new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<InterviewRecord>()
                .eq(InterviewRecord::getId, id)
                .set(InterviewRecord::getStatus, InterviewStatus.REJECTED)
                .set(InterviewRecord::getRejectionReason, "来源无法确认"));

        InterviewUpsertRequest fix = new InterviewUpsertRequest(2L,
                new SelectionInput(companyId, null), new SelectionInput(positionId, null),
                null, RecruitType.CAMPUS, null, null, List.of(
                round(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 9, 21), List.of(
                        question(null, "讲讲事务隔离", List.of())))), "https://example.com/proof");
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(fix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.status").value("DRAFT"))
                .andReturn();
        mvc.perform(get("/api/v1/me/interviews/{id}", id).with(asUser(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.rejectionReason").doesNotExist())
                // 提交过（有快照）→ 回到 DRAFT 也不可物理删除
                .andExpect(jsonPath("$.data.actions.canDeleteDraft").value(false));
    }

    @Test
    void draft_delete_rules() throws Exception {
        long user = newUser("delete-user");
        long pure = createDraft(user); // 纯草稿：从未保存过任何内容
        mvc.perform(delete("/api/v1/me/interviews/{id}", pure).with(asUser(user)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.deleted").value(true));
        assertThat(interviews.selectById(pure)).isNull();

        long submitted = createDraft(user);
        InterviewUpsertRequest request = upsert(0L, newCompany("删除科技"), newPosition("后端开发"), null, List.of(
                round(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 3), List.of(
                        question(null, "讲讲索引", List.of())))));
        mvc.perform(put("/api/v1/me/interviews/{id}", submitted).with(asUser(user)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/me/interviews/{id}/submit", submitted).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new InterviewSubmitRequest(1L))))
                .andExpect(status().isOk());
        // 提交过 → 有审计链，禁止物理删除
        mvc.perform(delete("/api/v1/me/interviews/{id}", submitted).with(asUser(user)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_STATUS_CONFLICT"));
    }

    @Test
    void ownership_and_anonymous_are_enforced() throws Exception {
        long owner = newUser("owner-user");
        long other = newUser("other-user");
        long id = createDraft(owner);
        InterviewUpsertRequest request = upsert(0, newCompany("权限科技"), newPosition("后端开发"), null, List.of());
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(owner)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isOk());

        // 他人访问 / 修改 → 403 INTERVIEW_NOT_OWNER
        mvc.perform(get("/api/v1/me/interviews/{id}", id).with(asUser(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("INTERVIEW_NOT_OWNER"));
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(other)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isForbidden());

        // 匿名 → 401（安全链统一）
        mvc.perform(get("/api/v1/me/interviews"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"));
    }

    @Test
    void duplicate_source_url_returns_warning_not_failure() throws Exception {
        long user = newUser("source-user");
        long other = newUser("source-other");
        long otherInterview = createDraft(other);
        InterviewUpsertRequest otherRequest = new InterviewUpsertRequest(0L,
                new SelectionInput(newCompany("来源科技"), null), new SelectionInput(newPosition("后端开发"), null),
                null, RecruitType.CAMPUS, null, null, List.of(), "https://Example.com/A/");
        mvc.perform(put("/api/v1/me/interviews/{id}", otherInterview).with(asUser(other)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(body(otherRequest)))
                .andExpect(status().isOk());

        long id = createDraft(user);
        InterviewUpsertRequest request = new InterviewUpsertRequest(0L,
                new SelectionInput(newCompany("来源科技"), null), new SelectionInput(newPosition("后端开发"), null),
                null, RecruitType.CAMPUS, null, null,
                List.of(round(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 2), List.of(
                        question(null, "讲讲缓存", List.of())))),
                "https://example.com/A"); // 归一后同源（host 大小写 + 尾斜杠）
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isOk()) // Warning 不阻断
                .andExpect(jsonPath("$.data.warnings[0].code").value("SOURCE_URL_DUPLICATE_SUSPECTED"));
    }
}
