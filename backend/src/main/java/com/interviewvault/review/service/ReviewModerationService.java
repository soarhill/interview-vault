package com.interviewvault.review.service;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.catalog.service.CatalogRegistrar;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.common.response.Warning;
import com.interviewvault.interview.dto.request.InterviewUpsertRequest;
import com.interviewvault.interview.dto.response.InterviewMutationResponse;
import com.interviewvault.interview.dto.response.InterviewSaveResponse;
import com.interviewvault.interview.entity.InterviewCandidate;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.entity.InterviewTag;
import com.interviewvault.interview.enums.CandidateType;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.repository.InterviewCandidateMapper;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.repository.InterviewTagMapper;
import com.interviewvault.interview.service.InterviewAggregateReader;
import com.interviewvault.interview.service.InterviewAggregateReader.Aggregate;
import com.interviewvault.interview.service.InterviewSubmissionService;
import com.interviewvault.review.dto.request.CandidateResolveRequest;
import com.interviewvault.review.dto.response.CandidateResolveResponse;

/**
 * 审核治理动作：管理员编辑待审核内容 / Candidate resolve（版本链）/ 发布 / 拒绝。
 * resolve 与发布都携带 version：每次成功 resolve 使 version+1，前端必须用响应中的新 version 继续。
 */
@Service
public class ReviewModerationService {

    private final InterviewRecordMapper interviews;
    private final InterviewCandidateMapper candidates;
    private final InterviewTagMapper interviewTags;
    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final TagMapper tags;
    private final CatalogRegistrar catalogRegistrar;
    private final InterviewAggregateReader aggregateReader;
    private final InterviewSubmissionService submissionService;

    public ReviewModerationService(InterviewRecordMapper interviews, InterviewCandidateMapper candidates,
                                   InterviewTagMapper interviewTags, CompanyMapper companies,
                                   PositionMapper positions, TagMapper tags, CatalogRegistrar catalogRegistrar,
                                   InterviewAggregateReader aggregateReader,
                                   InterviewSubmissionService submissionService) {
        this.interviews = interviews;
        this.candidates = candidates;
        this.interviewTags = interviewTags;
        this.companies = companies;
        this.positions = positions;
        this.tags = tags;
        this.catalogRegistrar = catalogRegistrar;
        this.aggregateReader = aggregateReader;
        this.submissionService = submissionService;
    }

    /** 管理员编辑审核内容（api-design「管理员编辑审核内容」）：PENDING_REVIEW 保存后保持状态、version+1、返回 canonical。 */
    @Transactional
    public InterviewSaveResponse edit(long id, InterviewUpsertRequest request) {
        return submissionService.adminSave(id, request);
    }

    /**
     * 处理 Candidate（api-design「处理 Candidate」）：绑定已有正式项 / 新建正式项 / 删除不合理标签候选，
     * 随后移除候选并 version+1；重复处理按实际先后返回版本冲突或 CANDIDATE_ALREADY_RESOLVED。
     */
    @Transactional
    public CandidateResolveResponse resolve(long id, long candidateId, CandidateResolveRequest request) {
        InterviewRecord record = interviews.selectByIdForUpdate(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (record.getStatus() != InterviewStatus.PENDING_REVIEW) {
            throw BizException.interviewStatusConflict();
        }
        if (record.getVersion() != request.version().longValue()) {
            throw BizException.interviewVersionConflict();
        }
        InterviewCandidate candidate = candidates.selectById(candidateId);
        if (candidate == null || !candidate.getInterviewId().equals(id)) {
            throw new BizException("CANDIDATE_NOT_FOUND",
                    org.springframework.http.HttpStatus.NOT_FOUND, "候选项不存在");
        }

        Long companyId = record.getCompanyId();
        Long positionId = record.getPositionId();
        boolean bindTag = false;
        Long tagId = null;
        switch (request.action()) {
            case CandidateResolveRequest.USE_EXISTING -> {
                if (request.targetId() == null) {
                    throw BizException.validation("USE_EXISTING 必须携带 targetId");
                }
                switch (candidate.getType()) {
                    case COMPANY -> {
                        Company company = companies.selectById(request.targetId());
                        if (company == null) {
                            throw BizException.catalogNotFound("COMPANY", request.targetId());
                        }
                        companyId = company.getId();
                    }
                    case POSITION -> {
                        Position position = positions.selectById(request.targetId());
                        if (position == null) {
                            throw BizException.catalogNotFound("POSITION", request.targetId());
                        }
                        positionId = position.getId();
                    }
                    case TAG -> {
                        Tag tag = tags.selectById(request.targetId());
                        if (tag == null) {
                            throw BizException.catalogNotFound("TAG", request.targetId());
                        }
                        bindTag = true;
                        tagId = tag.getId();
                    }
                }
            }
            case CandidateResolveRequest.CREATE_NEW -> {
                if (request.name() == null || request.name().isBlank()) {
                    throw BizException.validation("CREATE_NEW 必须携带 name");
                }
                switch (candidate.getType()) {
                    // CREATE_NEW 严格新建：同规范化名已存在 → 409，管理员应改用 USE_EXISTING
                    case COMPANY -> companyId = catalogRegistrar.createNewCompany(request.name()).getId();
                    case POSITION -> {
                        // 方向目录化：categoryName 按规范化名合并复用，管理员可随手开新方向
                        Long categoryId = request.categoryName() == null || request.categoryName().isBlank()
                                ? catalogRegistrar.defaultPositionCategory().getId()
                                : catalogRegistrar
                                        .getOrCreatePositionCategory(request.categoryName())
                                        .getId();
                        positionId = catalogRegistrar.createNewPosition(request.name(), categoryId).getId();
                    }
                    case TAG -> {
                        tagId = catalogRegistrar.createNewTag(request.name()).getId();
                        bindTag = true;
                    }
                }
            }
            case CandidateResolveRequest.REMOVE -> {
                if (candidate.getType() != CandidateType.TAG) {
                    // 必填语义的公司 / 岗位不允许静默删除
                    throw BizException.validation("公司 / 岗位候选不能移除，请选择已有项或新建");
                }
            }
            default -> throw BizException.validation("未知处理动作: " + request.action());
        }

        // 移除候选：影响 0 行 = 并发已被处理
        int removed = candidates.deleteById(candidateId);
        if (removed == 0) {
            throw new BizException("CANDIDATE_ALREADY_RESOLVED",
                    org.springframework.http.HttpStatus.CONFLICT, "候选项已被处理");
        }
        // 同一标签可能已绑在面经上（作者既有正式绑定又提议同名候选）：只清候选，不重复插关系
        if (bindTag && tagId != null && !interviewTags.existsByInterviewAndTag(id, tagId)) {
            interviewTags.insert(new InterviewTag(id, tagId));
        }

        int affected = interviews.update(null, new LambdaUpdateWrapper<InterviewRecord>()
                .eq(InterviewRecord::getId, id)
                .eq(InterviewRecord::getVersion, request.version())
                .eq(InterviewRecord::getStatus, InterviewStatus.PENDING_REVIEW)
                .set(InterviewRecord::getCompanyId, companyId)
                .set(InterviewRecord::getPositionId, positionId)
                .set(InterviewRecord::getUpdateTime, OffsetDateTime.now())
                .setSql("version = version + 1"));
        if (affected == 0) {
            throw BizException.interviewVersionConflict();
        }
        InterviewRecord updated = interviews.selectById(id);
        return new CandidateResolveResponse(candidateId,
                new CandidateResolveResponse.InterviewVersionView(updated.getId(), updated.getStatus().name(),
                        updated.getVersion(), updated.getUpdateTime()));
    }

    /** 发布（api-design「发布」）：全清单校验 + 条件更新 → PUBLISHED + publishTime + version+1。 */
    @Transactional
    public InterviewMutationResponse publish(long id, long version) {
        InterviewRecord record = interviews.selectById(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (record.getStatus() != InterviewStatus.PENDING_REVIEW) {
            throw BizException.interviewStatusConflict();
        }
        Aggregate aggregate = aggregateReader.load(record);
        List<String> problems = new java.util.ArrayList<>();
        if (record.getCompanyId() == null) {
            problems.add("公司未确定");
        }
        if (record.getPositionId() == null) {
            problems.add("岗位未确定");
        }
        if (record.getRecruitType() == null) {
            problems.add("招聘类型未确定");
        }
        if (!aggregate.candidates().isEmpty()) {
            problems.add("存在未处理候选（" + aggregate.candidates().size() + " 项）");
        }
        if (aggregate.rounds().isEmpty() || aggregate.questions().isEmpty()) {
            problems.add("缺少轮次或问题");
        }
        if (!problems.isEmpty()) {
            throw BizException.interviewIncomplete("发布前需处理: " + String.join("；", problems));
        }

        int affected = interviews.update(null, new LambdaUpdateWrapper<InterviewRecord>()
                .eq(InterviewRecord::getId, id)
                .eq(InterviewRecord::getVersion, version)
                .eq(InterviewRecord::getStatus, InterviewStatus.PENDING_REVIEW)
                .set(InterviewRecord::getStatus, InterviewStatus.PUBLISHED)
                .set(InterviewRecord::getPublishTime, OffsetDateTime.now())
                .set(InterviewRecord::getUpdateTime, OffsetDateTime.now())
                .setSql("version = version + 1"));
        if (affected == 0) {
            throw BizException.interviewVersionConflict();
        }
        InterviewRecord updated = interviews.selectById(id);
        return new InterviewMutationResponse(updated.getId(), updated.getStatus().name(),
                updated.getVersion(), updated.getUpdateTime(), List.of());
    }

    /** 拒绝（api-design「拒绝」）：REJECTED + 拒绝原因 + version+1；作者编辑保存后回 DRAFT 并清空原因。 */
    @Transactional
    public InterviewMutationResponse reject(long id, long version, String reason) {
        if (reason == null || reason.isBlank()) {
            throw BizException.validation("拒绝原因不能为空");
        }
        InterviewRecord record = interviews.selectById(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        if (record.getStatus() != InterviewStatus.PENDING_REVIEW) {
            throw BizException.interviewStatusConflict();
        }
        int affected = interviews.update(null, new LambdaUpdateWrapper<InterviewRecord>()
                .eq(InterviewRecord::getId, id)
                .eq(InterviewRecord::getVersion, version)
                .eq(InterviewRecord::getStatus, InterviewStatus.PENDING_REVIEW)
                .set(InterviewRecord::getStatus, InterviewStatus.REJECTED)
                .set(InterviewRecord::getRejectionReason, reason.strip())
                .set(InterviewRecord::getUpdateTime, OffsetDateTime.now())
                .setSql("version = version + 1"));
        if (affected == 0) {
            throw BizException.interviewVersionConflict();
        }
        InterviewRecord updated = interviews.selectById(id);
        return new InterviewMutationResponse(updated.getId(), updated.getStatus().name(),
                updated.getVersion(), updated.getUpdateTime(), List.of());
    }

    /** 供直改 / 变更申请场景复用：候选绑定用的正式目录行（当前聚合内无候选时不需要）。 */
    public long countPendingCandidates(long interviewId) {
        return candidates.selectCount(new LambdaQueryWrapper<InterviewCandidate>()
                .eq(InterviewCandidate::getInterviewId, interviewId));
    }
}
