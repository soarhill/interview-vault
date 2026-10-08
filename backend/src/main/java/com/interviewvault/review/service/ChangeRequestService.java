package com.interviewvault.review.service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewvault.auth.entity.User;
import com.interviewvault.auth.repository.UserMapper;
import com.interviewvault.auth.service.CurrentUserReader;
import com.interviewvault.auth.service.CurrentUserReader.CurrentUser;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.dto.request.FollowUpInput;
import com.interviewvault.interview.dto.request.InterviewUpsertRequest;
import com.interviewvault.interview.dto.request.QuestionInput;
import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.interview.dto.response.CatalogSelectionView;
import com.interviewvault.interview.dto.response.MyInterviewResponse;
import com.interviewvault.interview.dto.response.TagSelectionView;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.entity.InterviewSource;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.enums.RoundType;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.service.InterviewAggregateReader;
import com.interviewvault.interview.service.InterviewAggregateReader.Aggregate;
import com.interviewvault.interview.service.InterviewAggregateValidator;
import com.interviewvault.review.dto.request.ChangeRequestUpsertRequest;
import com.interviewvault.review.dto.response.AdminChangeRequestDetailResponse;
import com.interviewvault.review.dto.response.AdminChangeRequestListItemResponse;
import com.interviewvault.review.dto.response.AdminChangeRequestListResponse;
import com.interviewvault.review.dto.response.AuthorRef;
import com.interviewvault.review.dto.response.ChangeRequestDecisionResponse;
import com.interviewvault.review.dto.response.ChangeRequestView;
import com.interviewvault.review.dto.response.MyChangeRequestBaselineResponse;
import com.interviewvault.review.entity.ChangeRequest;
import com.interviewvault.review.enums.ChangeRequestStatus;
import com.interviewvault.review.enums.ChangeRequestType;
import com.interviewvault.review.repository.ChangeRequestMapper;

/**
 * 已发布内容的修改 / 删除申请（api-design 作者变更申请与管理员审批章节）：
 * - 同一面经同一时间最多一个 PENDING（部分唯一索引兜底，覆盖 / 互切走同一条记录）；
 * - 审批与创建都先 FOR UPDATE 锁行再校验（关闭 check-then-act 竞态）；
 * - approve UPDATE：解析 payload 中的目录提议（管理员动作，直接创建/复用正式项），
 *   应用完整目标版本到正式内容，version+1；approve DELETE：正式进入 REMOVED；
 * - 拒绝不修改正式 InterviewRecord，version 不递增。
 */
@Service
public class ChangeRequestService {

    private final InterviewRecordMapper interviews;
    private final ChangeRequestMapper changeRequests;
    private final UserMapper users;
    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final InterviewAggregateReader aggregateReader;
    private final InterviewAggregateValidator aggregateValidator;
    private final PublishedInterviewAdminService publishedAdminService;
    private final CurrentUserReader currentUser;
    private final ObjectMapper objectMapper;

    public ChangeRequestService(InterviewRecordMapper interviews, ChangeRequestMapper changeRequests,
                                UserMapper users, CompanyMapper companies, PositionMapper positions,
                                InterviewAggregateReader aggregateReader,
                                InterviewAggregateValidator aggregateValidator,
                                PublishedInterviewAdminService publishedAdminService,
                                CurrentUserReader currentUser, ObjectMapper objectMapper) {
        this.interviews = interviews;
        this.changeRequests = changeRequests;
        this.users = users;
        this.companies = companies;
        this.positions = positions;
        this.aggregateReader = aggregateReader;
        this.aggregateValidator = aggregateValidator;
        this.publishedAdminService = publishedAdminService;
        this.currentUser = currentUser;
        this.objectMapper = objectMapper;
    }

    // ---------- 作者侧 ----------

    /** 读取编辑基线与当前 PENDING 申请：无申请也 200，不是 404（api-design「读取编辑基线与当前 PENDING 申请」）。 */
    @Transactional(readOnly = true)
    public MyChangeRequestBaselineResponse readBaseline(long id) {
        CurrentUser user = currentUser.require();
        InterviewRecord record = ownPublished(user, id);
        ChangeRequest pending = publishedAdminService.findPending(id);
        return new MyChangeRequestBaselineResponse(
                aggregateReader.canonical(record, aggregateReader.load(record)),
                pending == null ? null : toView(pending));
    }

    /** 创建或覆盖 PENDING 申请（api-design「创建或覆盖 ChangeRequest」）：UPDATE↔DELETE 可互切，记录 id 不变。 */
    @Transactional
    public ChangeRequestView upsert(long id, ChangeRequestUpsertRequest request) {
        CurrentUser user = currentUser.require();
        // 先锁面经行再校验 baseVersion 与 PENDING，避免与审批 / 直改竞态
        InterviewRecord record = interviews.selectByIdForUpdate(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (!user.id().equals(record.getAuthorId())) {
            throw BizException.interviewNotOwner();
        }
        if (record.getStatus() != InterviewStatus.PUBLISHED) {
            throw BizException.interviewStatusConflict();
        }
        if (!record.getVersion().equals(request.baseVersion())) {
            throw BizException.interviewVersionConflict();
        }
        ChangeRequestType type = parseType(request.type());
        String payloadJson = null;
        if (type == ChangeRequestType.UPDATE) {
            if (request.payload() == null || request.payload().isNull() || request.payload().isEmpty()) {
                throw BizException.validation("UPDATE 申请必须携带完整目标版本 payload");
            }
            // 入口即做目标聚合的格式与完整性校验：不完整 payload 不落库，
            // 落库的是反序列化后的规范形（附带剔除未知字段，防止把任意大 JSON 存进 JSONB）
            InterviewUpsertRequest payload = readPayload(request.payload());
            validatePayload(payload);
            // 与当前正式内容完全一致的 UPDATE 是空跑申请，不进入审核队列（api-design 创建规则）
            if (serialize(withoutVersion(payload))
                    .equals(serialize(currentChangePayload(record)))) {
                throw BizException.validation("内容没有任何变化，无需提交修改申请");
            }
            payloadJson = serialize(payload);
        }

        ChangeRequest pending = publishedAdminService.findPending(id);
        if (pending != null) {
            int affected = changeRequests.overwritePending(pending.getId(), type,
                    request.baseVersion(), payloadJson,
                    request.reason() == null || request.reason().isBlank()
                            ? null : request.reason().strip());
            if (affected == 0) {
                throw changeRequestConflict();
            }
            return toView(changeRequests.selectById(pending.getId()));
        }
        ChangeRequest created = new ChangeRequest(id, user.id(), type, request.baseVersion(),
                payloadJson, request.reason() == null || request.reason().isBlank()
                        ? null : request.reason().strip());
        try {
            changeRequests.insert(created);
        } catch (DuplicateKeyException e) {
            // 并发创建撞 PENDING 部分唯一索引
            throw changeRequestConflict();
        }
        return toView(publishedAdminService.findPending(id));
    }

    // ---------- 管理员侧 ----------

    @Transactional(readOnly = true)
    public AdminChangeRequestListResponse list(ChangeRequestStatus status, ChangeRequestType type,
                                               int page, int size) {
        LambdaQueryWrapper<ChangeRequest> conditions = new LambdaQueryWrapper<ChangeRequest>()
                .eq(status != null, ChangeRequest::getStatus, status)
                .eq(type != null, ChangeRequest::getType, type);
        long total = changeRequests.selectCount(conditions);
        List<ChangeRequest> records = changeRequests.selectList(
                new LambdaQueryWrapper<ChangeRequest>()
                        .eq(status != null, ChangeRequest::getStatus, status)
                        .eq(type != null, ChangeRequest::getType, type)
                        .orderByAsc(ChangeRequest::getCreateTime)
                        .orderByAsc(ChangeRequest::getId)
                        .last("LIMIT " + size + " OFFSET " + (page - 1) * size));

        List<AdminChangeRequestListItemResponse> items = new ArrayList<>();
        for (ChangeRequest cr : records) {
            InterviewRecord interview = interviews.selectById(cr.getInterviewId());
            items.add(new AdminChangeRequestListItemResponse(
                    cr.getId(), cr.getType().name(), cr.getStatus().name(), cr.getBaseVersion(), cr.getRequestVersion(),
                    interviewSummary(interview),
                    authorRef(cr.getRequesterId()),
                    cr.getReason(), cr.getCreateTime(), cr.getUpdateTime()));
        }
        return new AdminChangeRequestListResponse(items, total, page, size);
    }

    @Transactional(readOnly = true)
    public AdminChangeRequestDetailResponse detail(long id) {
        ChangeRequest cr = changeRequests.selectById(id);
        if (cr == null) {
            throw new BizException("CHANGE_REQUEST_NOT_FOUND",
                    org.springframework.http.HttpStatus.NOT_FOUND, "变更申请不存在");
        }
        InterviewRecord interview = interviews.selectById(cr.getInterviewId());
        return new AdminChangeRequestDetailResponse(
                toView(cr),
                interview == null ? null
                        : publishedAdminService.publishedCanonical(interview, aggregateReader.load(interview)),
                authorRef(cr.getRequesterId()));
    }

    /**
     * 批准：UPDATE 校验 baseVersion → 复核 payload 完整性 → 应用目标版本；DELETE → 正式 REMOVED。
     * 锁顺序与 upsert 一致（先 interview_record 再 change_request），两事务并发不会互相等死锁；
     * 普通读取拿 interviewId，加锁后复查申请状态，关闭 check-then-act 竞态。
     */
    @Transactional
    public ChangeRequestDecisionResponse approve(long id, long expectedRequestVersion) {
        long adminId = currentUser.require().id();
        ChangeRequest preview = changeRequests.selectById(id);
        if (preview == null) {
            throw new BizException("CHANGE_REQUEST_NOT_FOUND",
                    org.springframework.http.HttpStatus.NOT_FOUND, "变更申请不存在");
        }
        InterviewRecord record = interviews.selectByIdForUpdate(preview.getInterviewId());
        if (record == null || record.getStatus() != InterviewStatus.PUBLISHED) {
            throw changeRequestConflict();
        }
        ChangeRequest cr = changeRequests.selectByIdForUpdate(id);
        if (cr == null || cr.getStatus() != ChangeRequestStatus.PENDING) {
            throw changeRequestConflict();
        }

        requireRequestVersion(cr, expectedRequestVersion);

        InterviewRecord updated;
        if (cr.getType() == ChangeRequestType.UPDATE) {
            if (!record.getVersion().equals(cr.getBaseVersion())) {
                throw changeRequestConflict();
            }
            // 批准前复核（历史申请可能早于入口校验落库）：不完整 payload 一律拒绝，不触碰正式内容
            InterviewUpsertRequest payload = readPayload(cr.getPayload());
            validatePayload(payload);
            Long companyId = publishedAdminService.resolveSelection(payload.company(), "COMPANY",
                    companies::selectById, true);
            Long positionId = publishedAdminService.resolveSelection(payload.position(), "POSITION",
                    positions::selectById, true);
            List<Long> tagIds = publishedAdminService.resolveTagIds(payload.safeTagIds(),
                    payload.safeProposedTags());
            publishedAdminService.recordRevision(record);
            publishedAdminService.applyToPublished(record, companyId, positionId,
                    payload.department(), payload.recruitType(), tagIds, payload.safeRounds(),
                    mergeSources(record, payload.sourceUrl()));
            updated = interviews.selectById(record.getId());
        } else {
            int affected = interviews.update(null, new LambdaUpdateWrapper<InterviewRecord>()
                    .eq(InterviewRecord::getId, record.getId())
                    .eq(InterviewRecord::getStatus, InterviewStatus.PUBLISHED)
                    .set(InterviewRecord::getStatus, InterviewStatus.REMOVED)
                    .set(InterviewRecord::getUpdateTime, OffsetDateTime.now())
                    .setSql("version = version + 1"));
            if (affected == 0) {
                throw changeRequestConflict();
            }
            updated = interviews.selectById(record.getId());
        }

        markDecision(cr, ChangeRequestStatus.APPROVED, adminId);
        return new ChangeRequestDecisionResponse(
                new ChangeRequestDecisionResponse.ChangeRequestRef(cr.getId(),
                        ChangeRequestStatus.APPROVED.name(), OffsetDateTime.now()),
                new ChangeRequestDecisionResponse.InterviewRef(updated.getId(), updated.getStatus().name(),
                        updated.getVersion()));
    }

    /** 拒绝：正式内容保持原样，version 不递增。 */
    @Transactional
    public ChangeRequestDecisionResponse reject(long id, long expectedRequestVersion) {
        long adminId = currentUser.require().id();
        ChangeRequest cr = changeRequests.selectByIdForUpdate(id);
        if (cr == null) {
            throw new BizException("CHANGE_REQUEST_NOT_FOUND",
                    org.springframework.http.HttpStatus.NOT_FOUND, "变更申请不存在");
        }
        if (cr.getStatus() != ChangeRequestStatus.PENDING) {
            throw changeRequestConflict();
        }
        requireRequestVersion(cr, expectedRequestVersion);
        markDecision(cr, ChangeRequestStatus.REJECTED, adminId);
        InterviewRecord record = interviews.selectById(cr.getInterviewId());
        return new ChangeRequestDecisionResponse(
                new ChangeRequestDecisionResponse.ChangeRequestRef(cr.getId(),
                        ChangeRequestStatus.REJECTED.name(), OffsetDateTime.now()),
                new ChangeRequestDecisionResponse.InterviewRef(record.getId(), record.getStatus().name(),
                        record.getVersion()));
    }

    // ---------- 内部 ----------

    private void requireRequestVersion(ChangeRequest cr, long expectedRequestVersion) {
        if (cr.getRequestVersion() != expectedRequestVersion) {
            throw changeRequestConflict();
        }
    }

    private void markDecision(ChangeRequest cr, ChangeRequestStatus status, long adminId) {
        int affected = changeRequests.update(null, new LambdaUpdateWrapper<ChangeRequest>()
                .eq(ChangeRequest::getId, cr.getId())
                .eq(ChangeRequest::getStatus, ChangeRequestStatus.PENDING)
                .set(ChangeRequest::getStatus, status)
                .set(ChangeRequest::getReviewerId, adminId)
                .set(ChangeRequest::getReviewTime, OffsetDateTime.now())
                .set(ChangeRequest::getUpdateTime, OffsetDateTime.now()));
        if (affected == 0) {
            throw changeRequestConflict();
        }
    }

    private ChangeRequestView toView(ChangeRequest cr) {
        return new ChangeRequestView(cr.getId(), cr.getInterviewId(), cr.getType().name(),
                cr.getStatus().name(), cr.getBaseVersion(), cr.getRequestVersion(), readTree(cr.getPayload()), cr.getReason(),
                cr.getCreateTime(), cr.getUpdateTime());
    }

    private JsonNode readTree(String payload) {
        if (payload == null || payload.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(payload);
        } catch (Exception e) {
            throw new IllegalStateException("申请 payload 反序列化失败", e);
        }
    }

    private InterviewUpsertRequest readPayload(JsonNode payload) {
        try {
            return objectMapper.treeToValue(payload, InterviewUpsertRequest.class);
        } catch (Exception e) {
            throw BizException.validation("UPDATE 申请 payload 形状非法，无法解析为目标版本");
        }
    }

    private InterviewUpsertRequest readPayload(String payload) {
        try {
            return objectMapper.readValue(payload, InterviewUpsertRequest.class);
        } catch (Exception e) {
            throw BizException.interviewIncomplete("UPDATE 申请 payload 无法解析为完整目标版本");
        }
    }

    private String serialize(InterviewUpsertRequest payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("申请 payload 序列化失败", e);
        }
    }

    /** version 不参与空跑比对（申请的版本语义走外层 baseVersion）。 */
    private InterviewUpsertRequest withoutVersion(InterviewUpsertRequest payload) {
        return new InterviewUpsertRequest(null, payload.company(), payload.position(),
                payload.department(), payload.recruitType(), payload.tagIds(),
                payload.proposedTags(), payload.rounds(), payload.sourceUrl());
    }

    /** 当前正式内容转成目标版本形状，作为空跑比对基准；映射与前端 payloadFromInterview 保持一致。 */
    private InterviewUpsertRequest currentChangePayload(InterviewRecord record) {
        MyInterviewResponse current = aggregateReader.canonical(record, aggregateReader.load(record));
        return new InterviewUpsertRequest(
                null,
                officialSelection(current.company()),
                officialSelection(current.position()),
                current.department(),
                current.recruitType() == null ? null : RecruitType.valueOf(current.recruitType()),
                current.tags().stream()
                        .flatMap(tag -> tag.id() == null ? Stream.empty() : Stream.of(tag.id()))
                        .toList(),
                current.tags().stream()
                        .filter(tag -> tag.id() == null)
                        .map(TagSelectionView::name)
                        .toList(),
                current.rounds().stream()
                        .map(round -> new RoundInput(
                                round.id(),
                                round.roundType() == null ? null : RoundType.valueOf(round.roundType()),
                                round.roundNo(),
                                round.interviewDate(),
                                round.questions().stream()
                                        .map(question -> new QuestionInput(
                                                question.id(),
                                                question.content(),
                                                question.referenceUrl(),
                                                question.followUps().stream()
                                                        .map(followUp -> new FollowUpInput(
                                                                followUp.id(), followUp.content()))
                                                        .toList()))
                                        .toList()))
                        .toList(),
                current.sourceUrl());
    }

    private SelectionInput officialSelection(CatalogSelectionView view) {
        return view == null || view.id() == null ? null : new SelectionInput(view.id(), null);
    }

    /** 目标版本必须同时通过格式校验与 PUBLISHED 完整性（入口与批准各查一次）。 */
    private void validatePayload(InterviewUpsertRequest payload) {
        aggregateValidator.validateFormat(payload.company(), payload.position(), payload.department(),
                payload.recruitType(), payload.safeTagIds(), payload.safeProposedTags(),
                payload.safeRounds(), payload.sourceUrl() == null || payload.sourceUrl().isBlank()
                        ? List.of() : List.of(payload.sourceUrl()));
        aggregateValidator.requirePublishedComplete(payload.company(), payload.position(),
                payload.recruitType(), payload.safeRounds());
    }

    /**
     * 来源合并：作者基线只暴露第一条来源（canonical 的 sourceUrl），批准 UPDATE 时
     * payload 的 sourceUrl 只替换这第一条；管理员维护的其余来源不参与作者编辑，原样保留。
     */
    private List<String> mergeSources(InterviewRecord record, String payloadSourceUrl) {
        Aggregate aggregate = aggregateReader.load(record);
        List<String> existing = aggregate.sources().stream()
                .map(InterviewSource::getUrl).toList();
        String replacement = payloadSourceUrl == null || payloadSourceUrl.isBlank()
                ? null : payloadSourceUrl.strip();
        if (existing.isEmpty()) {
            return replacement == null ? List.of() : List.of(replacement);
        }
        List<String> merged = new ArrayList<>();
        if (replacement != null) {
            merged.add(replacement);
        }
        merged.addAll(existing.subList(1, existing.size()));
        return merged;
    }

    private ChangeRequestType parseType(String raw) {
        try {
            return ChangeRequestType.valueOf(raw);
        } catch (Exception e) {
            throw BizException.validation("未知申请类型: " + raw);
        }
    }

    private BizException changeRequestConflict() {
        return new BizException("CHANGE_REQUEST_CONFLICT",
                org.springframework.http.HttpStatus.CONFLICT, "变更申请状态已变化，请刷新后重试");
    }

    private InterviewRecord ownPublished(CurrentUser user, long id) {
        InterviewRecord record = interviews.selectById(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (!user.id().equals(record.getAuthorId())) {
            throw BizException.interviewNotOwner();
        }
        if (record.getStatus() != InterviewStatus.PUBLISHED) {
            throw BizException.interviewStatusConflict();
        }
        return record;
    }

    private AdminChangeRequestListItemResponse.InterviewSummary interviewSummary(InterviewRecord record) {
        if (record == null) {
            return null;
        }
        Company company = record.getCompanyId() == null ? null : companies.selectById(record.getCompanyId());
        Position position = record.getPositionId() == null ? null : positions.selectById(record.getPositionId());
        return new AdminChangeRequestListItemResponse.InterviewSummary(record.getId(),
                company == null ? null : company.getName(),
                position == null ? null : position.getName(),
                record.getStatus().name(), record.getVersion());
    }

    private AuthorRef authorRef(Long userId) {
        if (userId == null) {
            return null;
        }
        User user = users.selectById(userId);
        return user == null ? null : new AuthorRef(user.getId(), user.getGithubLogin(), user.getAvatarUrl());
    }
}
