package com.interviewvault.review.service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewvault.auth.service.CurrentUserReader;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.catalog.service.CatalogRegistrar;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.common.response.Warning;
import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.repository.InterviewSourceMapper;
import com.interviewvault.interview.repository.InterviewTagMapper;
import com.interviewvault.interview.service.InterviewAggregateReader;
import com.interviewvault.interview.service.InterviewAggregateReader.Aggregate;
import com.interviewvault.interview.service.InterviewAggregateValidator;
import com.interviewvault.interview.service.InterviewAggregateWriter;
import com.interviewvault.interview.service.UrlNormalizer;
import com.interviewvault.review.dto.request.AdminPublishedInterviewUpdateRequest;
import com.interviewvault.review.dto.response.AdminPublishedEditBaselineResponse;
import com.interviewvault.review.dto.response.AdminPublishedInterviewResponse;
import com.interviewvault.review.dto.response.AdminPublishedSaveResponse;
import com.interviewvault.review.entity.ChangeRequest;
import com.interviewvault.review.entity.InterviewRevision;
import com.interviewvault.review.enums.ChangeRequestStatus;
import com.interviewvault.review.repository.ChangeRequestMapper;
import com.interviewvault.review.repository.InterviewRevisionMapper;

/**
 * 管理员读取 / 直接修改已发布面经（api-design「管理员读取 / 直接修改已发布面经」）：
 * - 读取返回编辑基线 + pendingChangeRequest 联动（canEditDirectly）；
 * - 直改先 FOR UPDATE 锁行，存在 PENDING 申请一律 409 CHANGE_REQUEST_CONFLICT；
 * - 同一事务写入 interview_revision（修改前的完整正式版本）；不落 Candidate，
 *   proposedName 直接创建 / 复用正式目录；sourceUrls[] 完整替换多来源；
 * - 迁移只读字段（originalPositionName / inferredPositionName / note）按历史真实性只读保留。
 */
@Service
public class PublishedInterviewAdminService {

    private final InterviewRecordMapper interviews;
    private final InterviewTagMapper interviewTags;
    private final InterviewSourceMapper sources;
    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final TagMapper tags;
    private final CatalogRegistrar catalogRegistrar;
    private final InterviewAggregateReader aggregateReader;
    private final InterviewAggregateValidator aggregateValidator;
    private final InterviewAggregateWriter aggregateWriter;
    private final InterviewRevisionMapper revisions;
    private final ChangeRequestMapper changeRequests;
    private final CurrentUserReader currentUser;
    private final ObjectMapper objectMapper;

    public PublishedInterviewAdminService(InterviewRecordMapper interviews, InterviewTagMapper interviewTags,
                                          InterviewSourceMapper sources, CompanyMapper companies,
                                          PositionMapper positions, TagMapper tags,
                                          CatalogRegistrar catalogRegistrar,
                                          InterviewAggregateReader aggregateReader,
                                          InterviewAggregateValidator aggregateValidator,
                                          InterviewAggregateWriter aggregateWriter,
                                          InterviewRevisionMapper revisions,
                                          ChangeRequestMapper changeRequests,
                                          CurrentUserReader currentUser, ObjectMapper objectMapper) {
        this.interviews = interviews;
        this.interviewTags = interviewTags;
        this.sources = sources;
        this.companies = companies;
        this.positions = positions;
        this.tags = tags;
        this.catalogRegistrar = catalogRegistrar;
        this.aggregateReader = aggregateReader;
        this.aggregateValidator = aggregateValidator;
        this.aggregateWriter = aggregateWriter;
        this.revisions = revisions;
        this.changeRequests = changeRequests;
        this.currentUser = currentUser;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public AdminPublishedEditBaselineResponse baseline(long id) {
        InterviewRecord record = requirePublished(id);
        ChangeRequest pending = findPending(id);
        return new AdminPublishedEditBaselineResponse(
                publishedCanonical(record, aggregateReader.load(record)),
                pending == null ? null : toPendingRef(pending),
                new AdminPublishedEditBaselineResponse.Actions(pending == null));
    }

    @Transactional
    public AdminPublishedSaveResponse update(long id, AdminPublishedInterviewUpdateRequest request) {
        // 短事务行级锁：先锁行，再检查 version 与 PENDING 申请（关闭 check-then-act 竞态）
        InterviewRecord record = interviews.selectByIdForUpdate(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (record.getStatus() != InterviewStatus.PUBLISHED) {
            throw BizException.interviewStatusConflict();
        }
        // 乐观锁：编辑页基线 version 与锁内最新版本不一致 → 409，防止旧页面静默覆盖他人修改
        if (!record.getVersion().equals(request.version())) {
            throw BizException.interviewVersionConflict();
        }
        if (findPending(id) != null) {
            // 先处理用户申请再编辑，避免旧 baseVersion 申请被批准覆盖新内容
            throw new BizException("CHANGE_REQUEST_CONFLICT",
                    org.springframework.http.HttpStatus.CONFLICT, "存在待处理的修改/删除申请，请先处理");
        }
        // 直改同样必须通过格式校验与 PUBLISHED 完整性（api-design「管理员直接修改已发布面经」）
        aggregateValidator.validateFormat(request.company(), request.position(), request.department(),
                request.recruitType(), request.safeTagIds(), request.safeProposedTags(),
                request.safeRounds(), request.safeSourceUrls());
        aggregateValidator.requirePublishedComplete(request.company(), request.position(),
                request.recruitType(), request.safeRounds());

        // 审计：保存修改前的完整正式版本（含 sources 与只读字段）
        recordRevision(record);

        Long companyId = resolveSelection(request.company(), "COMPANY", companies::selectById, true);
        Long positionId = resolveSelection(request.position(), "POSITION", positions::selectById, true);
        List<Long> tagIds = resolveTagIds(request.safeTagIds(), request.safeProposedTags());

        applyToPublished(record, companyId, positionId, request.department(), request.recruitType(),
                tagIds, request.safeRounds(), request.safeSourceUrls());

        InterviewRecord updated = interviews.selectById(id);
        return new AdminPublishedSaveResponse(
                publishedCanonical(updated, aggregateReader.load(updated)), List.of());
    }

    /** 直改与批准申请共用：在业务事务内保存完整旧正式版本。 */
    public void recordRevision(InterviewRecord record) {
        Aggregate before = aggregateReader.load(record);
        revisions.insert(new InterviewRevision(record.getId(), currentUser.require().id(), record.getVersion(),
                serialize(buildAuditPayload(record, before))));
    }

    /**
     * 已发布内容的完整写入（直改与 ChangeRequest approve 共用）：
     * 不落 Candidate；子实体差异更新；sources 整体替换；version+1。
     */
    public void applyToPublished(InterviewRecord record, Long companyId, Long positionId,
                                 String department, com.interviewvault.interview.enums.RecruitType recruitType,
                                 List<Long> tagIds, List<RoundInput> rounds, List<String> sourceUrls) {
        long id = record.getId();
        aggregateWriter.writeChildren(id, rounds, record.getVersion());
        aggregateWriter.writeTags(id, tagIds);
        // 多来源完整替换（历史记录不降维）
        sources.delete(new LambdaQueryWrapper<com.interviewvault.interview.entity.InterviewSource>()
                .eq(com.interviewvault.interview.entity.InterviewSource::getInterviewId, id));
        for (String raw : sourceUrls) {
            if (raw != null && !raw.isBlank()) {
                sources.insert(new com.interviewvault.interview.entity.InterviewSource(
                        id, raw.strip(), UrlNormalizer.normalize(raw)));
            }
        }
        int affected = interviews.update(null, new LambdaUpdateWrapper<InterviewRecord>()
                .eq(InterviewRecord::getId, id)
                .eq(InterviewRecord::getVersion, record.getVersion())
                .eq(InterviewRecord::getStatus, InterviewStatus.PUBLISHED)
                .set(InterviewRecord::getCompanyId, companyId)
                .set(InterviewRecord::getPositionId, positionId)
                .set(InterviewRecord::getDepartment, department == null || department.isBlank()
                        ? null : department.strip())
                .set(InterviewRecord::getRecruitType, recruitType)
                .set(InterviewRecord::getUpdateTime, OffsetDateTime.now())
                .setSql("version = version + 1"));
        if (affected == 0) {
            throw BizException.interviewVersionConflict();
        }
    }

    /** 治理事务内把 proposed 值直接解析为正式目录（getOrCreate 合并复用，不落 Candidate）。 */
    public Long resolveSelection(SelectionInput input, String kind,
                                 java.util.function.Function<Long, ?> loader, boolean allowProposed) {
        if (input == null || !input.hasExisting()) {
            if (input != null && input.hasProposed()) {
                if (!allowProposed) {
                    throw BizException.validation(kind + "不允许提议新值");
                }
                return switch (kind) {
                    case "COMPANY" -> catalogRegistrar.getOrCreateCompany(input.proposedName()).getId();
                    case "POSITION" -> catalogRegistrar
                            .getOrCreatePosition(input.proposedName(), null).getId();
                    default -> throw BizException.validation("未知目录类型: " + kind);
                };
            }
            return null;
        }
        if (loader.apply(input.existingId()) == null) {
            throw BizException.catalogNotFound(kind, input.existingId());
        }
        return input.existingId();
    }

    public List<Long> resolveTagIds(List<Long> tagIds, List<String> proposedTags) {
        Set<Long> resolved = new java.util.LinkedHashSet<>(tagIds);
        for (Long tagId : tagIds) {
            if (tags.selectById(tagId) == null) {
                throw BizException.catalogNotFound("TAG", tagId);
            }
        }
        Set<String> seen = new HashSet<>();
        for (String name : proposedTags) {
            String normalized = name.strip().toLowerCase();
            if (normalized.isEmpty() || !seen.add(normalized)) {
                throw BizException.validation("新标签不能为空且不能自重复: " + name);
            }
            resolved.add(catalogRegistrar.getOrCreateTag(name).getId());
        }
        return new ArrayList<>(resolved);
    }

    /** 已发布 canonical 视图（多来源 + 只读历史字段）。 */
    public AdminPublishedInterviewResponse publishedCanonical(InterviewRecord record, Aggregate aggregate) {
        return new AdminPublishedInterviewResponse(
                record.getId(),
                record.getStatus().name(),
                record.getVersion(),
                aggregate.company() == null ? null
                        : new AdminPublishedInterviewResponse.CompanyRef(
                        aggregate.company().getId(), aggregate.company().getName()),
                record.getDepartment(),
                aggregate.position() == null ? null
                        : new AdminPublishedInterviewResponse.PositionRef(aggregate.position().getId(),
                        aggregate.position().getName(),
                        aggregateReader.positionCategoryNameOf(aggregate.position().getCategoryId())),
                record.getRecruitType() == null ? null : record.getRecruitType().name(),
                InterviewAggregateReader.TagViews.of(aggregate).stream()
                        .filter(t -> t.id() != null)
                        .map(t -> new AdminPublishedInterviewResponse.TagRef(t.id(), t.name()))
                        .toList(),
                record.getOriginalPositionName(),
                record.getInferredPositionName(),
                record.getNote(),
                aggregateReader.canonical(record, aggregate).rounds(),
                aggregate.sources().stream()
                        .map(s -> new AdminPublishedInterviewResponse.SourceRef(s.getId(), s.getUrl()))
                        .toList(),
                record.getUpdateTime());
    }

    /** 修改前完整版本审计 payload：SubmissionPayload 形状 + 多来源 + 只读历史字段。 */
    public java.util.LinkedHashMap<String, Object> buildAuditPayload(InterviewRecord record,
                                                                     Aggregate aggregate) {
        InterviewAggregateReader.SubmissionPayload base =
                aggregateReader.buildSubmissionPayload(record, aggregate);
        java.util.LinkedHashMap<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("company", base.company());
        payload.put("position", base.position());
        payload.put("department", base.department());
        payload.put("recruitType", base.recruitType());
        payload.put("tagIds", base.tagIds());
        payload.put("proposedTags", base.proposedTags());
        payload.put("rounds", aggregateReader.canonical(record, aggregate).rounds());
        payload.put("sourceUrls", aggregate.sources().stream()
                .map(s -> s.getUrl()).toList());
        payload.put("originalPositionName", record.getOriginalPositionName());
        payload.put("inferredPositionName", record.getInferredPositionName());
        payload.put("note", record.getNote());
        return payload;
    }

    public ChangeRequest findPending(long interviewId) {
        List<ChangeRequest> pending = changeRequests.selectList(
                new LambdaQueryWrapper<ChangeRequest>()
                        .eq(ChangeRequest::getInterviewId, interviewId)
                        .eq(ChangeRequest::getStatus, ChangeRequestStatus.PENDING)
                        .last("LIMIT 1"));
        return pending.isEmpty() ? null : pending.get(0);
    }

    private AdminPublishedEditBaselineResponse.PendingChangeRequestRef toPendingRef(ChangeRequest cr) {
        return new AdminPublishedEditBaselineResponse.PendingChangeRequestRef(
                cr.getId(), cr.getType().name(), cr.getBaseVersion(), cr.getUpdateTime());
    }

    private InterviewRecord requirePublished(long id) {
        InterviewRecord record = interviews.selectById(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (record.getStatus() != InterviewStatus.PUBLISHED) {
            throw BizException.interviewStatusConflict();
        }
        return record;
    }

    private String serialize(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("审计 payload 序列化失败", e);
        }
    }
}
