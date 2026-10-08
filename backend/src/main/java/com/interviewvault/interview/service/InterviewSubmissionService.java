package com.interviewvault.interview.service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewvault.auth.service.CurrentUserReader;
import com.interviewvault.auth.service.CurrentUserReader.CurrentUser;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.common.response.Warning;
import com.interviewvault.interview.dto.request.InterviewUpsertRequest;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.interview.dto.response.ActionAvailability;
import com.interviewvault.interview.dto.response.DraftDeleteResponse;
import com.interviewvault.interview.dto.response.InterviewMutationResponse;
import com.interviewvault.interview.dto.response.InterviewSaveResponse;
import com.interviewvault.interview.dto.response.MyInterviewDetailResponse;
import com.interviewvault.interview.dto.response.MyInterviewListItemResponse;
import com.interviewvault.interview.dto.response.MyInterviewListResponse;
import com.interviewvault.interview.dto.response.MyInterviewResponse;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.entity.InterviewSource;
import com.interviewvault.interview.entity.SubmissionSnapshot;
import com.interviewvault.interview.enums.CandidateType;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.repository.InterviewRoundMapper;
import com.interviewvault.interview.repository.InterviewSourceMapper;
import com.interviewvault.interview.repository.SubmissionSnapshotMapper;
import com.interviewvault.interview.service.InterviewAggregateReader.Aggregate;

/**
 * 投稿用例编排：创建草稿 / 我的投稿列表 / 编辑基线 / 整份聚合保存 / 删除纯草稿 / 提交审核，
 * 以及管理员编辑待审核内容（adminSave，供 review 模块编排）。
 * 状态语义（api-design「保存整份草稿 / 待审核投稿」与「提交审核」）：保存 DRAFT→DRAFT、PENDING_REVIEW→PENDING_REVIEW、
 * REJECTED→DRAFT（清空拒绝原因）；提交审核只从 DRAFT 发起。
 */
@Service
public class InterviewSubmissionService {

    private final InterviewRecordMapper interviews;
    private final InterviewRoundMapper rounds;
    private final InterviewSourceMapper sources;
    private final SubmissionSnapshotMapper snapshots;
    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final InterviewAggregateWriter aggregateWriter;
    private final InterviewAggregateReader aggregateReader;
    private final InterviewAggregateValidator aggregateValidator;
    private final CurrentUserReader currentUser;
    private final ObjectMapper objectMapper;

    public InterviewSubmissionService(InterviewRecordMapper interviews, InterviewRoundMapper rounds,
                                      InterviewSourceMapper sources, SubmissionSnapshotMapper snapshots,
                                      CompanyMapper companies, PositionMapper positions,
                                      InterviewAggregateWriter aggregateWriter,
                                      InterviewAggregateReader aggregateReader,
                                      InterviewAggregateValidator aggregateValidator,
                                      CurrentUserReader currentUser,
                                      ObjectMapper objectMapper) {
        this.interviews = interviews;
        this.rounds = rounds;
        this.sources = sources;
        this.snapshots = snapshots;
        this.companies = companies;
        this.positions = positions;
        this.aggregateWriter = aggregateWriter;
        this.aggregateReader = aggregateReader;
        this.aggregateValidator = aggregateValidator;
        this.currentUser = currentUser;
        this.objectMapper = objectMapper;
    }

    // ---------- 用例 ----------

    @Transactional
    public InterviewMutationResponse createDraft() {
        CurrentUser user = currentUser.require();
        InterviewRecord draft = new InterviewRecord(user.id(), null, null, null,
                null, null, null, null, InterviewStatus.DRAFT);
        interviews.insert(draft);
        return toMutation(interviews.selectById(draft.getId()), List.of());
    }

    @Transactional(readOnly = true)
    public MyInterviewListResponse list(InterviewStatus status, int page, int size) {
        CurrentUser user = currentUser.require();
        long total = interviews.selectCount(listWrapper(user, status));
        List<InterviewRecord> records = interviews.selectList(
                listWrapper(user, status)
                        .orderByDesc(InterviewRecord::getUpdateTime)
                        .orderByDesc(InterviewRecord::getId)
                        .last("LIMIT " + size + " OFFSET " + (page - 1) * size));

        List<MyInterviewListItemResponse> items = new ArrayList<>();
        for (InterviewRecord record : records) {
            Aggregate aggregate = aggregateReader.load(record);
            boolean hasSnapshot = hasSnapshot(record.getId());
            boolean hasPending = interviews.countPendingChangeRequests(record.getId()) > 0;
            var firstRound = aggregateReader.firstDatedRound(aggregate.rounds());
            items.add(new MyInterviewListItemResponse(
                    record.getId(),
                    aggregateReader.companyView(aggregate),
                    aggregateReader.positionView(aggregate),
                    record.getDepartment(),
                    record.getRecruitType() == null ? null : record.getRecruitType().name(),
                    record.getStatus().name(),
                    record.getVersion(),
                    record.getRejectionReason(),
                    firstRound == null ? null : firstRound.getInterviewDate(),
                    firstRound == null || firstRound.getInterviewDatePrecision() == null
                            ? null : firstRound.getInterviewDatePrecision().name(),
                    aggregate.rounds().size(),
                    (int) rounds.countQuestions(record.getId()),
                    hasPending,
                    record.getCreateTime(),
                    record.getUpdateTime(),
                    actions(record.getStatus(), hasSnapshot, hasPending)));
        }
        return new MyInterviewListResponse(items, total, page, size);
    }

    @Transactional(readOnly = true)
    public MyInterviewDetailResponse detail(long id) {
        CurrentUser user = currentUser.require();
        InterviewRecord record = ownRecord(user, id);
        MyInterviewResponse base = canonical(record);
        return new MyInterviewDetailResponse(
                base.id(), base.status(), base.version(), record.getRejectionReason(),
                base.company(), base.position(), base.department(), base.recruitType(),
                base.tags(), base.rounds(), base.sourceUrl(),
                record.getCreateTime(), record.getUpdateTime(),
                actions(record.getStatus(), hasSnapshot(id),
                        interviews.countPendingChangeRequests(id) > 0));
    }

    @Transactional
    public InterviewSaveResponse save(long id, InterviewUpsertRequest request) {
        CurrentUser user = currentUser.require();
        InterviewRecord record = ownRecord(user, id);
        requireEditableStatus(record);
        return doSave(record, request,
                record.getStatus() == InterviewStatus.REJECTED
                        || record.getStatus() == InterviewStatus.REMOVED);
    }

    /** 管理员编辑待审核内容（api-design「管理员编辑审核内容」）：仅 PENDING_REVIEW，保存后保持待审核、version+1。 */
    @Transactional
    public InterviewSaveResponse adminSave(long id, InterviewUpsertRequest request) {
        InterviewRecord record = interviews.selectById(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (record.getStatus() != InterviewStatus.PENDING_REVIEW) {
            throw BizException.interviewStatusConflict();
        }
        return doSave(record, request, false);
    }

    @Transactional
    public DraftDeleteResponse deleteDraft(long id) {
        CurrentUser user = currentUser.require();
        InterviewRecord record = ownRecord(user, id);
        if (record.getStatus() != InterviewStatus.DRAFT || hasSnapshot(id)) {
            // 进入过审核历史的记录不可物理抹除审计链（api-design「删除纯草稿」）
            throw BizException.interviewStatusConflict();
        }
        interviews.deleteById(id); // 子数据由 FK 级联清理
        return new DraftDeleteResponse(id, true);
    }

    @Transactional
    public InterviewMutationResponse submit(long id, long version) {
        CurrentUser user = currentUser.require();
        InterviewRecord record = ownRecord(user, id);
        if (record.getStatus() != InterviewStatus.DRAFT) {
            throw BizException.interviewStatusConflict();
        }
        Aggregate aggregate = aggregateReader.load(record);
        validateCompleteness(record, aggregate);

        String payload = toJson(aggregateReader.buildSubmissionPayload(record, aggregate));
        snapshots.insert(new SubmissionSnapshot(id, payload));

        int affected = interviews.update(null, new LambdaUpdateWrapper<InterviewRecord>()
                .eq(InterviewRecord::getId, id)
                .eq(InterviewRecord::getVersion, version)
                .eq(InterviewRecord::getStatus, InterviewStatus.DRAFT)
                .set(InterviewRecord::getStatus, InterviewStatus.PENDING_REVIEW)
                .set(InterviewRecord::getUpdateTime, OffsetDateTime.now())
                .setSql("version = version + 1"));
        if (affected == 0) {
            throw BizException.interviewVersionConflict();
        }
        String sourceUrl = aggregate.sources().isEmpty() ? null : aggregate.sources().get(0).getUrl();
        return toMutation(interviews.selectById(id), sourceWarnings(id, sourceUrl));
    }

    // ---------- 共享保存核心 ----------

    private InterviewSaveResponse doSave(InterviewRecord record, InterviewUpsertRequest request,
                                         boolean rejectToDraft) {
        aggregateValidator.validateFormat(request.company(), request.position(), request.department(),
                request.recruitType(), request.safeTagIds(), request.safeProposedTags(),
                request.safeRounds(), singleSource(request.sourceUrl()));
        Long companyId = resolveSelection(request.company(), "COMPANY", companies::selectById);
        Long positionId = resolveSelection(request.position(), "POSITION", positions::selectById);

        long id = record.getId();
        aggregateWriter.writeChildren(id, request.safeRounds(), request.version());
        aggregateWriter.writeTags(id, request.safeTagIds());
        aggregateWriter.writeTagCandidates(id, request.safeProposedTags());
        aggregateWriter.writeSingleCandidate(id, CandidateType.COMPANY,
                request.company() != null && request.company().hasProposed()
                        ? request.company().proposedName() : null);
        aggregateWriter.writeSingleCandidate(id, CandidateType.POSITION,
                request.position() != null && request.position().hasProposed()
                        ? request.position().proposedName() : null);
        aggregateWriter.writeSources(id, request.sourceUrl());

        LambdaUpdateWrapper<InterviewRecord> bump = new LambdaUpdateWrapper<InterviewRecord>()
                .eq(InterviewRecord::getId, id)
                .eq(InterviewRecord::getVersion, request.version())
                .set(InterviewRecord::getCompanyId, companyId)
                .set(InterviewRecord::getPositionId, positionId)
                .set(InterviewRecord::getDepartment, blankToNull(request.department()))
                .set(InterviewRecord::getRecruitType, request.recruitType())
                .set(InterviewRecord::getUpdateTime, OffsetDateTime.now())
                .setSql("version = version + 1");
        if (rejectToDraft) {
            bump.set(InterviewRecord::getStatus, InterviewStatus.DRAFT)
                    .set(InterviewRecord::getRejectionReason, null);
        }
        int affected = interviews.update(null, bump);
        if (affected == 0) {
            throw BizException.interviewVersionConflict();
        }
        InterviewRecord saved = interviews.selectById(id);
        MyInterviewResponse canonical = aggregateReader.canonical(saved, aggregateReader.load(saved));
        return new InterviewSaveResponse(canonical, sourceWarnings(id, request.sourceUrl()));
    }

    // ---------- 校验 ----------

    /** 提交审核的完整业务校验（api-design「提交审核」一节）。 */
    private void validateCompleteness(InterviewRecord record, Aggregate aggregate) {
        if (record.getCompanyId() == null
                && aggregateReader.findCandidate(aggregate, CandidateType.COMPANY) == null) {
            throw BizException.interviewIncomplete("投稿前请选择公司或提出新公司");
        }
        if (record.getPositionId() == null
                && aggregateReader.findCandidate(aggregate, CandidateType.POSITION) == null) {
            throw BizException.interviewIncomplete("投稿前请选择岗位或提出新岗位");
        }
        if (record.getRecruitType() == null) {
            throw BizException.interviewIncomplete("投稿前请选择招聘类型");
        }
        if (aggregate.rounds().isEmpty() || aggregate.questions().isEmpty()) {
            throw BizException.interviewIncomplete("投稿前至少需要一个面试轮次和一个问题");
        }
    }

    // ---------- 辅助 ----------

    private MyInterviewResponse canonical(InterviewRecord record) {
        return aggregateReader.canonical(record, aggregateReader.load(record));
    }

    private boolean hasSnapshot(long id) {
        return snapshots.selectCount(new LambdaQueryWrapper<SubmissionSnapshot>()
                .eq(SubmissionSnapshot::getInterviewId, id)) > 0;
    }

    /** 列表基础条件（计数与取数分别构造——selectCount 不能携带 ORDER BY，PG 聚合下非法）。 */
    private LambdaQueryWrapper<InterviewRecord> listWrapper(CurrentUser user, InterviewStatus status) {
        LambdaQueryWrapper<InterviewRecord> wrapper = new LambdaQueryWrapper<InterviewRecord>()
                .eq(InterviewRecord::getAuthorId, user.id());
        if (status != null) {
            wrapper.eq(InterviewRecord::getStatus, status);
        }
        return wrapper;
    }

    private InterviewRecord ownRecord(CurrentUser user, long id) {
        InterviewRecord record = interviews.selectById(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (!user.id().equals(record.getAuthorId())) {
            throw BizException.interviewNotOwner();
        }
        return record;
    }

    private void requireEditableStatus(InterviewRecord record) {
        if (record.getStatus() != InterviewStatus.DRAFT
                && record.getStatus() != InterviewStatus.PENDING_REVIEW
                && record.getStatus() != InterviewStatus.REJECTED
                && record.getStatus() != InterviewStatus.REMOVED) {
            throw BizException.interviewStatusConflict();
        }
    }

    private Long resolveSelection(SelectionInput input, String kind,
                                  java.util.function.Function<Long, ?> loader) {
        if (input == null || !input.hasExisting()) {
            return null;
        }
        if (loader.apply(input.existingId()) == null) {
            throw BizException.catalogNotFound(kind, input.existingId());
        }
        return input.existingId();
    }

    private ActionAvailability actions(InterviewStatus status, boolean hasSnapshot, boolean hasPending) {
        boolean editable = status == InterviewStatus.DRAFT || status == InterviewStatus.PENDING_REVIEW
                || status == InterviewStatus.REJECTED || status == InterviewStatus.REMOVED;
        boolean published = status == InterviewStatus.PUBLISHED;
        return new ActionAvailability(
                editable,
                status == InterviewStatus.DRAFT || status == InterviewStatus.REMOVED,
                status == InterviewStatus.DRAFT && !hasSnapshot,
                published && !hasPending,
                published && !hasPending);
    }

    /** 同源 URL 疑似重复 → 非阻断 Warning（api-design 错误与 Warning 章节）。 */
    private List<Warning> sourceWarnings(long interviewId, String sourceUrl) {
        if (sourceUrl == null || sourceUrl.isBlank()) {
            return List.of();
        }
        long others = sources.selectCount(
                new LambdaQueryWrapper<InterviewSource>()
                        .eq(InterviewSource::getNormalizedUrl, UrlNormalizer.normalize(sourceUrl))
                        .ne(InterviewSource::getInterviewId, interviewId));
        return others > 0 ? List.of(Warning.sourceUrlDuplicateSuspected()) : List.of();
    }

    private InterviewMutationResponse toMutation(InterviewRecord record, List<Warning> warnings) {
        return new InterviewMutationResponse(record.getId(), record.getStatus().name(),
                record.getVersion(), record.getUpdateTime(), warnings);
    }

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("快照序列化失败", e);
        }
    }

    /** 用户投稿来源：最多一条（多来源是管理员直改与历史数据的语义）。 */
    private List<String> singleSource(String sourceUrl) {
        return sourceUrl == null || sourceUrl.isBlank() ? List.of() : List.of(sourceUrl);
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
