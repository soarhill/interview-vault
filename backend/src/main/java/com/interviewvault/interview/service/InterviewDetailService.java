package com.interviewvault.interview.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.interviewvault.catalog.dto.response.CompanySummaryResponse;
import com.interviewvault.catalog.dto.response.PositionSummaryResponse;
import com.interviewvault.catalog.dto.response.TagSummaryResponse;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.dto.response.FollowUpResponse;
import com.interviewvault.interview.dto.response.InterviewDetailResponse;
import com.interviewvault.interview.dto.response.InterviewRoundResponse;
import com.interviewvault.interview.dto.response.InterviewSourceResponse;
import com.interviewvault.interview.dto.response.QuestionResponse;
import com.interviewvault.interview.entity.FollowUp;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.entity.InterviewRound;
import com.interviewvault.interview.entity.InterviewSource;
import com.interviewvault.interview.entity.InterviewTag;
import com.interviewvault.interview.entity.Question;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.repository.FollowUpMapper;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.repository.InterviewRoundMapper;
import com.interviewvault.interview.repository.InterviewSourceMapper;
import com.interviewvault.interview.repository.InterviewTagMapper;
import com.interviewvault.interview.repository.QuestionMapper;

/** 公开详情：只暴露 PUBLISHED；REMOVED 与不存在用不同错误码区分下架文案。 */
@Service
public class InterviewDetailService {

    private final InterviewRecordMapper interviews;
    private final InterviewSourceMapper sources;
    private final InterviewRoundMapper rounds;
    private final QuestionMapper questions;
    private final FollowUpMapper followUps;
    private final InterviewTagMapper interviewTags;
    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final TagMapper tags;

    public InterviewDetailService(InterviewRecordMapper interviews, InterviewSourceMapper sources,
                                  InterviewRoundMapper rounds, QuestionMapper questions,
                                  FollowUpMapper followUps, InterviewTagMapper interviewTags,
                                  CompanyMapper companies, PositionMapper positions, TagMapper tags,
                                  com.interviewvault.catalog.repository.PositionCategoryMapper positionCategories) {
        this.interviews = interviews;
        this.sources = sources;
        this.rounds = rounds;
        this.questions = questions;
        this.followUps = followUps;
        this.interviewTags = interviewTags;
        this.companies = companies;
        this.positions = positions;
        this.tags = tags;
        this.positionCategories = positionCategories;
    }

    @Transactional(readOnly = true)
    public InterviewDetailResponse detail(long id) {
        InterviewRecord interview = interviews.selectById(id);
        if (interview == null || interview.getStatus() != InterviewStatus.PUBLISHED) {
            // 非发布状态不泄露存在性；REMOVED 单独区分「已下架」文案
            if (interview != null && interview.getStatus() == InterviewStatus.REMOVED) {
                throw BizException.interviewRemoved();
            }
            throw BizException.interviewNotFound();
        }

        Company company = interview.getCompanyId() == null ? null
                : companies.selectById(interview.getCompanyId());
        Position position = interview.getPositionId() == null ? null
                : positions.selectById(interview.getPositionId());

        List<InterviewSource> srcList = sources.selectList(
                new LambdaQueryWrapper<InterviewSource>()
                        .eq(InterviewSource::getInterviewId, id)
                        .orderByAsc(InterviewSource::getId));
        List<InterviewRound> roundList = rounds.selectList(
                new LambdaQueryWrapper<InterviewRound>()
                        .eq(InterviewRound::getInterviewId, id)
                        .orderByAsc(InterviewRound::getSortOrder));
        List<TagSummaryResponse> tagViews = loadTags(id);

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

        Map<Long, List<FollowUp>> followUpsByQuestion = followUpList.stream()
                .collect(Collectors.groupingBy(FollowUp::getQuestionId));
        Map<Long, List<Question>> questionsByRound = questionList.stream()
                .collect(Collectors.groupingBy(Question::getRoundId));

        List<InterviewRoundResponse> roundResponses = roundList.stream()
                .map(r -> new InterviewRoundResponse(
                        r.getId(),
                        r.getRoundType().name(),
                        r.getRoundNo(),
                        RoundDisplayNames.displayName(r),
                        r.getRemark(),
                        r.getInterviewDate(),
                        r.getInterviewDatePrecision() == null ? null : r.getInterviewDatePrecision().name(),
                        questionsByRound.getOrDefault(r.getId(), List.of()).stream()
                                .map(q -> toQuestion(q, followUpsByQuestion))
                                .toList()))
                .toList();

        InterviewRound first = roundList.stream()
                .filter(r -> r.getInterviewDate() != null)
                .min(Comparator.comparing(InterviewRound::getInterviewDate)
                        .thenComparing(r -> r.getInterviewDatePrecision().ordinal()))
                .orElse(null);

        return new InterviewDetailResponse(
                interview.getId(),
                company == null ? null : new CompanySummaryResponse(company.getId(), company.getName()),
                interview.getDepartment(),
                position == null ? null
                        : new PositionSummaryResponse(position.getId(), position.getName(),
                        positionCategoryName(position.getCategoryId())),
                interview.getRecruitType() == null ? null : interview.getRecruitType().name(),
                tagViews,
                first == null ? null : first.getInterviewDate(),
                first == null || first.getInterviewDatePrecision() == null
                        ? null : first.getInterviewDatePrecision().name(),
                interview.getOriginalPositionName(),
                interview.getInferredPositionName(),
                interview.getNote(),
                roundResponses,
                srcList.stream().map(s -> new InterviewSourceResponse(s.getId(), s.getUrl())).toList());
    }

    private List<TagSummaryResponse> loadTags(long interviewId) {
        List<InterviewTag> relations = interviewTags.findByInterviewId(interviewId);
        if (relations.isEmpty()) {
            return List.of();
        }
        Map<Long, Tag> byId = tags.selectBatchIds(relations.stream().map(InterviewTag::getTagId).toList())
                .stream().collect(Collectors.toMap(Tag::getId, t -> t));
        return relations.stream()
                .map(r -> byId.get(r.getTagId()))
                .filter(t -> t != null)
                .map(t -> new TagSummaryResponse(t.getId(), t.getName()))
                .toList();
    }

    private final com.interviewvault.catalog.repository.PositionCategoryMapper positionCategories;

    private String positionCategoryName(Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        com.interviewvault.catalog.entity.PositionCategoryRow row =
                positionCategories.selectById(categoryId);
        return row == null ? null : row.getName();
    }

    private QuestionResponse toQuestion(Question q, Map<Long, List<FollowUp>> followUpsByQuestion) {
        List<FollowUpResponse> followUpResponses = followUpsByQuestion.getOrDefault(q.getId(), List.of()).stream()
                .map(f -> new FollowUpResponse(f.getId(), f.getContent()))
                .toList();
        return new QuestionResponse(
                q.getId(),
                q.getContent(),
                q.getReferenceUrl() != null ? q.getReferenceUrl() : q.getLeetcodeUrl(),
                q.getQuestionType() == null ? null : q.getQuestionType().name(),
                q.getSectionLabel(),
                q.getContextNote(),
                q.getAlgorithmTitle(),
                q.getAlgorithmDescription(),
                q.getAlgorithmRequirements(),
                q.getLeetcodeNumber(),
                q.getLeetcodeUrl(),
                followUpResponses);
    }
}
