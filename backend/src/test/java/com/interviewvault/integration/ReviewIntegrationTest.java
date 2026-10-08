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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.interviewvault.auth.entity.User;
import com.interviewvault.auth.enums.UserRole;
import com.interviewvault.auth.repository.UserMapper;
import com.interviewvault.interview.dto.request.FollowUpInput;
import com.interviewvault.interview.dto.request.InterviewSubmitRequest;
import com.interviewvault.interview.dto.request.InterviewUpsertRequest;
import com.interviewvault.interview.dto.request.QuestionInput;
import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.review.entity.InterviewRevision;
import com.interviewvault.interview.enums.InterviewDatePrecision;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.enums.RoundType;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.review.entity.ChangeRequest;
import com.interviewvault.review.repository.ChangeRequestMapper;
import com.interviewvault.review.repository.InterviewRevisionMapper;
import com.jayway.jsonpath.JsonPath;

/**
 * 审核 / 直改 / 变更申请三刀的真库集成测试：
 * 审核全流程（列表→详情→resolve 版本链→发布校验→发布/拒绝）、
 * 管理员直改（revision 审计 + sourceUrls + PENDING 冲突禁止）、
 * ChangeRequest（单 PENDING 覆盖与互切 / approve UPDATE 应用 payload / approve DELETE 下架 / reject）。
 */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class ReviewIntegrationTest {

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
    private InterviewRecordMapper interviews;
    @Autowired
    private InterviewRevisionMapper revisions;
    @Autowired
    private ChangeRequestMapper changeRequests;

    private long newUser(String login, UserRole role) {
        User user = new User(System.nanoTime(), login, null, role);
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

    private String body(Object request) throws Exception {
        return objectMapper.writeValueAsString(request);
    }

    private long createDraft(long user) throws Exception {
        MvcResult result = mvc.perform(post("/api/v1/me/interviews").with(asUser(user)).with(csrf()))
                .andExpect(status().isCreated()).andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.data.id")).longValue();
    }

    /** 完整投稿（正式公司 + 一轮一问），返回保存后 version（=1）。 */
    private long submitComplete(long user, long companyId, long positionId, String companyProposal,
                                String content) throws Exception {
        long id = createDraft(user);
        InterviewUpsertRequest request = new InterviewUpsertRequest(0L,
                companyProposal == null ? new SelectionInput(companyId, null)
                        : new SelectionInput(null, companyProposal),
                new SelectionInput(positionId, null),
                null, RecruitType.CAMPUS, null, null,
                List.of(new RoundInput(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 5),
                        List.of(new QuestionInput(null, content, null,
                        List.of(new FollowUpInput(null, "追问一")))))),
                null);
        mvc.perform(put("/api/v1/me/interviews/{id}", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(request)))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/me/interviews/{id}/submit", id).with(asUser(user)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(1L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_REVIEW"))
                .andExpect(jsonPath("$.data.version").value(2));
        return id;
    }

    @Autowired
    private com.interviewvault.catalog.repository.CompanyMapper companies;
    @Autowired
    private com.interviewvault.catalog.repository.PositionMapper positions;

    @Autowired
    private com.interviewvault.catalog.repository.PositionCategoryMapper positionCategories;


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

    // ==================== 第 2 刀：审核 ====================

    @Test
    void review_full_flow_list_detail_resolve_publish() throws Exception {
        long admin = newUser("admin-flow", UserRole.ADMIN);
        long author = newUser("author-flow", UserRole.USER);
        long positionId = position("审核流程后端");
        long id = submitComplete(author, 0L, positionId, "新公司科技", "如何设计限流");

        // 待审核列表
        mvc.perform(get("/api/v1/admin/reviews/interviews").with(asAdmin(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.id==" + id + ")].status")
                        .value(org.hamcrest.Matchers.hasItem("PENDING_REVIEW")));

        // 审核详情：候选 + 建议匹配 + 快照 content 为对象
        mvc.perform(get("/api/v1/admin/reviews/interviews/{id}", id).with(asAdmin(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.company.source").value("PROPOSED"))
                .andExpect(jsonPath("$.data.candidates.length()").value(1))
                .andExpect(jsonPath("$.data.candidates[0].type").value("COMPANY"))
                .andExpect(jsonPath("$.data.submissionSnapshot.content.company.proposedName")
                        .value("新公司科技"));

        // 未处理候选直接发布 → 400
        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/publish", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(2L))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INTERVIEW_INCOMPLETE"));

        // resolve CREATE_NEW（版本链：响应返回新 version）
        String detail = mvc.perform(get("/api/v1/admin/reviews/interviews/{id}", id).with(asAdmin(admin)))
                .andReturn().getResponse().getContentAsString();
        long candidateId = ((Number) JsonPath.read(detail, "$.data.candidates[0].id")).longValue();
        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/candidates/{cid}/resolve", id, candidateId)
                        .with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.CandidateResolveRequest(
                                2L, "CREATE_NEW", null, "新公司科技", null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.resolvedCandidateId").value(candidateId))
                .andExpect(jsonPath("$.data.interview.version").value(3));

        // 用旧 version 发布 → 409；用新 version → 200 PUBLISHED
        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/publish", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(2L))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INTERVIEW_VERSION_CONFLICT"));
        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/publish", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(3L))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.version").value(4));

        // 公开详情可访问，公司已是正式项
        mvc.perform(get("/api/v1/interviews/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.company.name").value("新公司科技"));
    }

    @Test
    void reject_writes_reason_visible_to_author() throws Exception {
        long admin = newUser("admin-reject", UserRole.ADMIN);
        long author = newUser("author-reject", UserRole.USER);
        long companyId = company("被拒审查科技");
        long positionId = position("审查后端");
        long id = submitComplete(author, companyId, positionId, null, "讲讲幂等");

        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/reject", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.RejectRequest(2L, "来源无法确认"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"));
        mvc.perform(get("/api/v1/me/interviews").with(asUser(author)))
                .andExpect(jsonPath("$.data.items[?(@.id==" + id + ")].rejectionReason")
                        .value(org.hamcrest.Matchers.hasItem("来源无法确认")));
    }

    // ==================== 第 3 刀：管理员直改 ====================

    @Test
    void direct_edit_writes_revision_and_handles_pending_conflict() throws Exception {
        long admin = newUser("admin-direct", UserRole.ADMIN);
        long author = newUser("author-direct", UserRole.USER);
        long companyId = company("直改科技");
        long positionId = position("直改后端");
        long id = submitComplete(author, companyId, positionId, null, "直改前的问题");
        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/publish", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(2L))))
                .andExpect(status().isOk());

        // 基线：可直改 + 多来源
        MvcResult baseline = mvc.perform(get("/api/v1/admin/interviews/{id}", id).with(asAdmin(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.actions.canEditDirectly").value(true))
                .andExpect(jsonPath("$.data.interview.sources.length()").value(0))
                .andReturn();
        long version = ((Number) JsonPath.read(baseline.getResponse().getContentAsString(),
                "$.data.interview.version")).longValue();

        // 直改：新增来源 x2 + 修改问题文本 + proposedTag 直接建正式标签（不落候选）
        com.interviewvault.review.dto.request.AdminPublishedInterviewUpdateRequest directEdit =
                new com.interviewvault.review.dto.request.AdminPublishedInterviewUpdateRequest(
                        version,
                        new SelectionInput(companyId, null),
                        new SelectionInput(positionId, null),
                        "直改部门", RecruitType.CAMPUS, null, List.of("直改新标签"),
                        List.of(new RoundInput(null, RoundType.TECHNICAL, 1, LocalDate.of(2026, 10, 5),
                                List.of(new QuestionInput(null,
                                "直改后的问题", null,
                                List.of())))),
                        List.of("https://a.example.com/x", "https://b.example.com/y"));
        mvc.perform(put("/api/v1/admin/interviews/{id}", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(directEdit)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.version").value(version + 1))
                .andExpect(jsonPath("$.data.interview.sources.length()").value(2))
                .andExpect(jsonPath("$.data.interview.department").value("直改部门"))
                .andExpect(jsonPath("$.data.interview.tags[?(@.name=='直改新标签')]").isNotEmpty());

        // 审计落库：revision 保存修改前版本（含原问题文本）
        List<InterviewRevision> audit = revisions.selectList(
                new LambdaQueryWrapper<InterviewRevision>().eq(InterviewRevision::getInterviewId, id));
        assertThat(audit).hasSize(1);
        assertThat(audit.get(0).getPayload()).contains("直改前的问题");

        // 存在 PENDING 申请后：基线 canEditDirectly=false，PUT 409 CHANGE_REQUEST_CONFLICT
        long updatedVersion = version + 1;
        createDeleteRequest(author, id, updatedVersion);
        mvc.perform(get("/api/v1/admin/interviews/{id}", id).with(asAdmin(admin)))
                .andExpect(jsonPath("$.data.actions.canEditDirectly").value(false))
                .andExpect(jsonPath("$.data.pendingChangeRequest.type").value("DELETE"));
        mvc.perform(put("/api/v1/admin/interviews/{id}", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(
                        new com.interviewvault.review.dto.request.AdminPublishedInterviewUpdateRequest(
                                updatedVersion, null, null, null, null, null, null, List.of(), List.of()))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CHANGE_REQUEST_CONFLICT"));
    }

    // ==================== 第 4 刀：ChangeRequest ====================

    @Test
    void change_request_upsert_overwrite_switch_and_approve_delete() throws Exception {
        long admin = newUser("admin-cr", UserRole.ADMIN);
        long author = newUser("author-cr", UserRole.USER);
        long companyId = company("申请科技");
        long positionId = position("申请后端");
        long id = submitComplete(author, companyId, positionId, null, "申请前的问题");
        publish(id, 2L, admin);

        // 无申请读取：changeRequest null（不是 404）
        mvc.perform(get("/api/v1/me/interviews/{id}/change-request", id).with(asUser(author)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.changeRequest").doesNotExist())
                .andExpect(jsonPath("$.data.interview.version").value(3));

        // 创建 UPDATE 申请（目标版本改内容 + 提议新标签）
        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("company", objectMapper.valueToTree(new SelectionInput(companyId, null)));
        payload.set("position", objectMapper.valueToTree(new SelectionInput(positionId, null)));
        payload.put("department", "申请后部门");
        payload.put("recruitType", "CAMPUS");
        payload.set("tagIds", objectMapper.createArrayNode());
        payload.set("proposedTags", objectMapper.valueToTree(List.of("申请新标签")));
        payload.set("rounds", objectMapper.valueToTree(List.of(new RoundInput(null, RoundType.TECHNICAL,
                1, LocalDate.of(2026, 10, 5), List.of(new QuestionInput(null,
                "申请后的问题", null, List.of()))))));
        payload.put("sourceUrl", "https://cr.example.com/a");
        MvcResult created = mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestUpsertRequest(
                                "UPDATE", 3L, payload, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type").value("UPDATE"))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.payload.department").value("申请后部门"))
                .andReturn();
        long crId = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.data.id")).longValue();

        // 覆盖为 DELETE：同一 PENDING 记录互切（id 不变），payload 清空
        mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestUpsertRequest(
                                "DELETE", 3L, null, "不希望继续公开"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(crId))
                .andExpect(jsonPath("$.data.type").value("DELETE"))
                .andExpect(jsonPath("$.data.reason").value("不希望继续公开"));

        // 管理员列表（默认查询）与详情
        mvc.perform(get("/api/v1/admin/change-requests").with(asAdmin(admin)))
                .andExpect(jsonPath("$.data.items[?(@.id==" + crId + ")].type")
                        .value(org.hamcrest.Matchers.hasItem("DELETE")));
        mvc.perform(get("/api/v1/admin/change-requests/{id}", crId).with(asAdmin(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.changeRequest.reason").value("不希望继续公开"))
                .andExpect(jsonPath("$.data.currentInterview.status").value("PUBLISHED"));

        // 批准 DELETE：正式下架，公开详情 404 INTERVIEW_REMOVED
        mvc.perform(post("/api/v1/admin/change-requests/{id}/approve", crId).with(asAdmin(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestDecisionRequest(
                                changeRequests.selectById(crId).getRequestVersion()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.changeRequest.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.interview.status").value("REMOVED"));
        mvc.perform(get("/api/v1/interviews/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INTERVIEW_REMOVED"));
        // 重复批准 → 409
        mvc.perform(post("/api/v1/admin/change-requests/{id}/approve", crId).with(asAdmin(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestDecisionRequest(
                                changeRequests.selectById(crId).getRequestVersion()))))
                .andExpect(status().isConflict());

        // 已下架（REMOVED）作者可编辑复活：保存 → DRAFT，重新提交 → 待审核
        MvcResult removedDetail = mvc.perform(get("/api/v1/me/interviews/{id}", id).with(asUser(author)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REMOVED"))
                .andReturn();
        long currentVersion = ((Number) JsonPath.read(
                removedDetail.getResponse().getContentAsString(), "$.data.version")).longValue();
        MvcResult revivedSave = mvc
                .perform(put("/api/v1/me/interviews/{id}", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new InterviewUpsertRequest(currentVersion,
                                new SelectionInput(companyId, null),
                                new SelectionInput(positionId, null),
                                null, RecruitType.CAMPUS, null, null,
                                List.of(new RoundInput(null, RoundType.TECHNICAL, 1,
                                        LocalDate.of(2026, 10, 20),
                                        List.of(new QuestionInput(null, "复活后的问题", null, List.of())))),
                                null))))
                .andReturn();
        System.out.println("REVIVED-BODY=" + revivedSave.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        org.springframework.test.web.servlet.ResultMatcher expectOk =
                org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk();
        if (revivedSave.getResponse().getStatus() != 200) {
            throw new AssertionError(
                    "removed save failed: " + revivedSave.getResponse().getStatus()
                            + " body above");
        }
        Object revivedStatus = JsonPath.read(revivedSave.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8),
                "$.data.interview.status");
        org.assertj.core.api.Assertions.assertThat(String.valueOf(revivedStatus))
                .isEqualTo("DRAFT");
        mvc.perform(post("/api/v1/me/interviews/{id}/submit", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.interview.dto.request.InterviewSubmitRequest(
                                ((Number) JsonPath.read(revivedSave.getResponse()
                                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8),
                                        "$.data.interview.version")).longValue()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING_REVIEW"));
    }

    @Test
    void change_request_approve_update_applies_payload() throws Exception {
        long admin = newUser("admin-cr2", UserRole.ADMIN);
        long author = newUser("author-cr2", UserRole.USER);
        long companyId = company("批准科技");
        long positionId = position("批准后端");
        long id = submitComplete(author, companyId, positionId, null, "批准前的问题");
        publish(id, 2L, admin);

        ObjectNode payload = objectMapper.createObjectNode();
        payload.set("company", objectMapper.valueToTree(new SelectionInput(companyId, null)));
        payload.set("position", objectMapper.valueToTree(new SelectionInput(positionId, null)));
        payload.put("recruitType", "CAMPUS");
        payload.set("tagIds", objectMapper.createArrayNode());
        payload.set("proposedTags", objectMapper.valueToTree(List.of("批准新标签")));
        payload.set("rounds", objectMapper.valueToTree(List.of(new RoundInput(null, RoundType.TECHNICAL,
                1, LocalDate.of(2026, 10, 6), List.of(new QuestionInput(null,
                "批准后的问题", null, List.of()))))));
        MvcResult created = mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id)
                        .with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestUpsertRequest(
                                "UPDATE", 3L, payload, null))))
                .andExpect(status().isOk()).andReturn();
        long crId = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.data.id")).longValue();

        // 审核期间正式内容保持旧版本
        mvc.perform(get("/api/v1/interviews/{id}", id))
                .andExpect(jsonPath("$.data.rounds[0].questions[0].content").value("批准前的问题"));

        mvc.perform(post("/api/v1/admin/change-requests/{id}/approve", crId).with(asAdmin(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestDecisionRequest(
                                changeRequests.selectById(crId).getRequestVersion()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.interview.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.interview.version").value(4));
        // 目标版本已应用（含提议标签直接转正）
        mvc.perform(get("/api/v1/interviews/{id}", id))
                .andExpect(jsonPath("$.data.rounds[0].questions[0].content").value("批准后的问题"))
                .andExpect(jsonPath("$.data.tags[?(@.name=='批准新标签')]").isNotEmpty());
    }

    @Test
    void change_request_reject_keeps_interview_untouched() throws Exception {
        long admin = newUser("admin-cr3", UserRole.ADMIN);
        long author = newUser("author-cr3", UserRole.USER);
        long companyId = company("拒绝科技");
        long positionId = position("拒绝后端");
        long id = submitComplete(author, companyId, positionId, null, "拒绝前的问题");
        publish(id, 2L, admin);
        createDeleteRequest(author, id, 3L);

        long crId = changeRequests.selectList(new LambdaQueryWrapper<ChangeRequest>()
                .eq(ChangeRequest::getInterviewId, id)).get(0).getId();
        mvc.perform(post("/api/v1/admin/change-requests/{id}/reject", crId).with(asAdmin(admin)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestDecisionRequest(
                                changeRequests.selectById(crId).getRequestVersion()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.changeRequest.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.interview.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.interview.version").value(3)); // 拒绝不递增
        // 拒绝后可再次发起新申请（单 PENDING 约束解除）
        createDeleteRequest(author, id, 3L);
        assertThat(changeRequests.selectCount(new LambdaQueryWrapper<ChangeRequest>()
                .eq(ChangeRequest::getInterviewId, id)
                .eq(ChangeRequest::getStatus, com.interviewvault.review.enums.ChangeRequestStatus.PENDING)))
                .isEqualTo(1);
    }

    // ---------- 辅助 ----------

    private void publish(long id, long version, long admin) throws Exception {
        mvc.perform(post("/api/v1/admin/reviews/interviews/{id}/publish", id).with(asAdmin(admin)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(new InterviewSubmitRequest(version))))
                .andExpect(status().isOk());
    }

    private void createDeleteRequest(long author, long id, long baseVersion) throws Exception {
        mvc.perform(put("/api/v1/me/interviews/{id}/change-request", id).with(asUser(author)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(new com.interviewvault.review.dto.request.ChangeRequestUpsertRequest(
                                "DELETE", baseVersion, null, "下架申请"))))
                .andExpect(status().isOk());
    }
}
