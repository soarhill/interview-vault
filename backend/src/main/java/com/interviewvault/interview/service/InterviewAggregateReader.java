package com.interviewvault.interview.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.interview.dto.request.FollowUpInput;
import com.interviewvault.interview.dto.request.QuestionInput;
import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.interview.dto.response.FollowUpResponse;
import com.interviewvault.interview.dto.response.InterviewRoundResponse;
import com.interviewvault.interview.dto.response.MyInterviewResponse;
import com.interviewvault.interview.dto.response.QuestionResponse;
import com.interviewvault.interview.entity.FollowUp;
import com.interviewvault.interview.entity.InterviewCandidate;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.entity.InterviewRound;
import com.interviewvault.interview.entity.InterviewSource;
import com.interviewvault.interview.entity.InterviewTag;
import com.interviewvault.interview.entity.Question;
import com.interviewvault.interview.enums.CandidateType;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.repository.FollowUpMapper;
import com.interviewvault.interview.repository.InterviewCandidateMapper;
import com.interviewvault.interview.repository.InterviewRoundMapper;
import com.interviewvault.interview.repository.InterviewSourceMapper;
import com.interviewvault.interview.repository.InterviewTagMapper;
import com.interviewvault.interview.repository.QuestionMapper;

/**
 * 聚合读取与视图装配（投稿 / 审核 / 直改 / 变更申请共用）：
 * 一次装载面经全部子数据并组装 canonical 视图、选择视图、快照 payload。
 */
@Component
public class InterviewAggregateReader {

    /** 聚合快照：record + 全部子数据 + 已解析的正式目录实体。 */
    public record Aggregate(InterviewRecord record,
                            List<InterviewRound> rounds,
                            List<Question> questions,
                            List<FollowUp> followUps,
                            List<InterviewSource> sources,
                            List<InterviewTag> tagRelations,
                            List<Tag> tagEntities,
                            List<InterviewCandidate> candidates,
                            Company company,
                            Position position) {
    }

    /** 提交瞬间快照 payload（api-design「审核详情」content 形状；字段名与 InterviewUpsertRequest 对齐、无 version）。 */
    public record SubmissionPayload(SelectionInput company, SelectionInput position, String department,
                                    RecruitType recruitType, List<Long> tagIds, List<String> proposedTags,
                                    List<RoundInput> rounds, String sourceUrl) {
    }

    private final com.interviewvault.catalog.repository.PositionCategoryMapper positionCategories;
    private final InterviewRoundMapper rounds;
    private final QuestionMapper questions;
    private final FollowUpMapper followUps;
    private final InterviewSourceMapper sources;
    private final InterviewTagMapper interviewTags;
    private final InterviewCandidateMapper candidates;
    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final TagMapper tags;

    public InterviewAggregateReader(com.interviewvault.catalog.repository.PositionCategoryMapper positionCategories,
                                    InterviewRoundMapper rounds, QuestionMapper questions,
                                    FollowUpMapper followUps, InterviewSourceMapper sources,
                                    InterviewTagMapper interviewTags, InterviewCandidateMapper candidates,
                                    CompanyMapper companies, PositionMapper positions, TagMapper tags) {
        this.positionCategories = positionCategories;
        this.rounds = rounds;
        this.questions = questions;
        this.followUps = followUps;
        this.sources = sources;
        this.interviewTags = interviewTags;
        this.candidates = candidates;
        this.companies = companies;
        this.positions = positions;
        this.tags = tags;
    }

    @Transactional(readOnly = true)
    public Aggregate load(InterviewRecord record) {
        long id = record.getId();
        List<InterviewRound> roundList = rounds.selectList(
                new LambdaQueryWrapper<InterviewRound>()
                        .eq(InterviewRound::getInterviewId, id)
                        .orderByAsc(InterviewRound::getSortOrder));
        List<Long> roundIds = roundList.stream().map(InterviewRound::getId).toList();
        List<Question> questionList = roundIds.isEmpty() ? List.of()
                : questions.selectList(new LambdaQueryWrapper<Question>()
                .in(Question::getRoundId, roundIds)
                .orderByAsc(Question::getRoundId)
                .orderByAsc(Question::getSortOrder));
        List<Long> questionIds = questionList.stream().map(Question::getId).toList();
        List<FollowUp> followUpList = questionIds.isEmpty() ? List.of()
                : followUps.selectList(new LambdaQueryWrapper<FollowUp>()
                .in(FollowUp::getQuestionId, questionIds)
                .orderByAsc(FollowUp::getQuestionId)
                .orderByAsc(FollowUp::getSortOrder));
        List<InterviewSource> sourceList = sources.selectList(
                new LambdaQueryWrapper<InterviewSource>()
                        .eq(InterviewSource::getInterviewId, id)
                        .orderByAsc(InterviewSource::getId));
        List<InterviewTag> relations = interviewTags.findByInterviewId(id);
        List<Tag> tagEntities = relations.isEmpty() ? List.of()
                : tags.selectBatchIds(relations.stream().map(InterviewTag::getTagId).toList());
        List<InterviewCandidate> candidateList = candidates.selectList(
                new LambdaQueryWrapper<InterviewCandidate>()
                        .eq(InterviewCandidate::getInterviewId, id)
                        .orderByAsc(InterviewCandidate::getId));
        Company company = record.getCompanyId() == null ? null : companies.selectById(record.getCompanyId());
        Position position = record.getPositionId() == null ? null : positions.selectById(record.getPositionId());
        return new Aggregate(record, roundList, questionList, followUpList, sourceList,
                relations, tagEntities, candidateList, company, position);
    }

    /** canonical 聚合视图：保存响应与各编辑基线共用（算法字段完整 round-trip、真实子项 id）。 */
    public MyInterviewResponse canonical(InterviewRecord record, Aggregate aggregate) {
        Map<Long, List<Question>> questionsByRound = aggregate.questions().stream()
                .collect(Collectors.groupingBy(Question::getRoundId));
        Map<Long, List<FollowUp>> followUpsByQuestion = aggregate.followUps().stream()
                .collect(Collectors.groupingBy(FollowUp::getQuestionId));

        List<InterviewRoundResponse> roundResponses = aggregate.rounds().stream()
                .map(r -> new InterviewRoundResponse(
                        r.getId(),
                        r.getRoundType().name(),
                        r.getRoundNo(),
                        RoundDisplayNames.displayName(r),
                        r.getRemark(),
                        r.getInterviewDate(),
                        r.getInterviewDatePrecision() == null ? null
                                : r.getInterviewDatePrecision().name(),
                        questionsByRound.getOrDefault(r.getId(), List.of()).stream()
                                .map(q -> toQuestionResponse(q, followUpsByQuestion))
                                .toList()))
                .toList();

        return new MyInterviewResponse(
                record.getId(),
                record.getStatus().name(),
                record.getVersion(),
                companyView(aggregate),
                positionView(aggregate),
                record.getDepartment(),
                record.getRecruitType() == null ? null : record.getRecruitType().name(),
                TagViews.of(aggregate),
                roundResponses,
                aggregate.sources().isEmpty() ? null : aggregate.sources().get(0).getUrl(),
                record.getUpdateTime());
    }

    /** 快照 payload：提交审核瞬间 / 直改审计（直改额外由调用方附加 sources 与只读字段）。 */
    public SubmissionPayload buildSubmissionPayload(InterviewRecord record, Aggregate aggregate) {
        SelectionInput company = record.getCompanyId() != null
                ? new SelectionInput(record.getCompanyId(), null)
                : candidateInput(aggregate, CandidateType.COMPANY);
        SelectionInput position = record.getPositionId() != null
                ? new SelectionInput(record.getPositionId(), null)
                : candidateInput(aggregate, CandidateType.POSITION);
        Map<Long, List<Question>> questionsByRound = aggregate.questions().stream()
                .collect(Collectors.groupingBy(Question::getRoundId));
        Map<Long, List<FollowUp>> followUpsByQuestion = aggregate.followUps().stream()
                .collect(Collectors.groupingBy(FollowUp::getQuestionId));
        List<RoundInput> roundInputs = aggregate.rounds().stream()
                .map(r -> new RoundInput(r.getId(), r.getRoundType(), r.getRoundNo(),
                        r.getInterviewDate(),
                        questionsByRound.getOrDefault(r.getId(), List.of()).stream()
                                .map(q -> new QuestionInput(q.getId(), q.getContent(),
                                        referenceUrl(q),
                                        followUpsByQuestion.getOrDefault(q.getId(), List.of()).stream()
                                                .map(f -> new FollowUpInput(f.getId(), f.getContent()))
                                                .toList()))
                                .toList()))
                .toList();
        return new SubmissionPayload(company, position, record.getDepartment(), record.getRecruitType(),
                aggregate.tagRelations().stream().map(InterviewTag::getTagId).toList(),
                aggregate.candidates().stream()
                        .filter(c -> c.getType() == CandidateType.TAG)
                        .sorted(Comparator.comparing(InterviewCandidate::getSortOrder))
                        .map(InterviewCandidate::getValue).toList(),
                roundInputs,
                aggregate.sources().isEmpty() ? null : aggregate.sources().get(0).getUrl());
    }

    public InterviewRound firstDatedRound(List<InterviewRound> roundList) {
        return roundList.stream()
                .filter(r -> r.getInterviewDate() != null)
                .min(Comparator.comparing(InterviewRound::getInterviewDate)
                        .thenComparing(r -> r.getInterviewDatePrecision() == null
                                ? 99 : r.getInterviewDatePrecision().ordinal()))
                .orElse(null);
    }

    public com.interviewvault.interview.dto.response.CatalogSelectionView companyView(Aggregate aggregate) {
        if (aggregate.company() != null) {
            return com.interviewvault.interview.dto.response.CatalogSelectionView.official(
                    aggregate.company().getId(), aggregate.company().getName(), null);
        }
        InterviewCandidate candidate = findCandidate(aggregate, CandidateType.COMPANY);
        return candidate == null ? null
                : com.interviewvault.interview.dto.response.CatalogSelectionView.proposed(candidate.getValue());
    }

    public com.interviewvault.interview.dto.response.CatalogSelectionView positionView(Aggregate aggregate) {
        if (aggregate.position() != null) {
            return com.interviewvault.interview.dto.response.CatalogSelectionView.official(
                    aggregate.position().getId(), aggregate.position().getName(),
                    positionCategoryName(aggregate.position().getCategoryId()));
        }
        InterviewCandidate candidate = findCandidate(aggregate, CandidateType.POSITION);
        return candidate == null ? null
                : com.interviewvault.interview.dto.response.CatalogSelectionView.proposed(candidate.getValue());
    }

    /** 标签视图：正式绑定 + 候选（PROPOSED）。 */
    public static final class TagViews {
        private TagViews() {
        }

        public static List<com.interviewvault.interview.dto.response.TagSelectionView> of(Aggregate aggregate) {
            List<com.interviewvault.interview.dto.response.TagSelectionView> views = new java.util.ArrayList<>();
            Map<Long, Tag> byId = aggregate.tagEntities().stream()
                    .collect(Collectors.toMap(Tag::getId, t -> t));
            aggregate.tagRelations().stream()
                    .map(r -> byId.get(r.getTagId()))
                    .filter(t -> t != null)
                    .forEach(t -> views.add(new com.interviewvault.interview.dto.response.TagSelectionView(
                            t.getId(), t.getName(),
                            com.interviewvault.interview.dto.response.TagSelectionView.OFFICIAL)));
            aggregate.candidates().stream()
                    .filter(c -> c.getType() == CandidateType.TAG)
                    .sorted(Comparator.comparing(InterviewCandidate::getSortOrder))
                    .forEach(c -> views.add(new com.interviewvault.interview.dto.response.TagSelectionView(
                            null, c.getValue(),
                            com.interviewvault.interview.dto.response.TagSelectionView.PROPOSED)));
            return views;
        }
    }

    /** 供 review 模块装配岗位方向名。 */
    public String positionCategoryNameOf(Long categoryId) {
        return positionCategoryName(categoryId);
    }

    private String positionCategoryName(Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        com.interviewvault.catalog.entity.PositionCategoryRow row = positionCategories.selectById(categoryId);
        return row == null ? null : row.getName();
    }

    public InterviewCandidate findCandidate(Aggregate aggregate, CandidateType type) {
        return aggregate.candidates().stream()
                .filter(c -> c.getType() == type)
                .findFirst().orElse(null);
    }

    private SelectionInput candidateInput(Aggregate aggregate, CandidateType type) {
        InterviewCandidate candidate = findCandidate(aggregate, type);
        return candidate == null ? null : new SelectionInput(null, candidate.getValue());
    }

    /** 用户可见的唯一题目链接：reference_url 优先，legacy leetcode_url 兜底。 */
    private String referenceUrl(Question q) {
        return q.getReferenceUrl() != null ? q.getReferenceUrl() : q.getLeetcodeUrl();
    }

    private QuestionResponse toQuestionResponse(Question q, Map<Long, List<FollowUp>> followUpsByQuestion) {
        List<FollowUpResponse> followUpResponses = followUpsByQuestion
                .getOrDefault(q.getId(), List.of()).stream()
                .map(f -> new FollowUpResponse(f.getId(), f.getContent()))
                .toList();
        return new QuestionResponse(q.getId(), q.getContent(),
                referenceUrl(q),
                q.getQuestionType() == null ? null : q.getQuestionType().name(),
                q.getSectionLabel(), q.getContextNote(),
                q.getAlgorithmTitle(), q.getAlgorithmDescription(), q.getAlgorithmRequirements(),
                q.getLeetcodeNumber(), q.getLeetcodeUrl(), followUpResponses);
    }
}
