package com.interviewvault.interview.service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.catalog.service.NameNormalizer;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.dto.request.FollowUpInput;
import com.interviewvault.interview.dto.request.QuestionInput;
import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.entity.FollowUp;
import com.interviewvault.interview.entity.InterviewCandidate;
import com.interviewvault.interview.entity.InterviewRound;
import com.interviewvault.interview.entity.InterviewSource;
import com.interviewvault.interview.entity.InterviewTag;
import com.interviewvault.interview.entity.Question;
import com.interviewvault.interview.enums.CandidateType;
import com.interviewvault.interview.enums.InterviewDatePrecision;
import com.interviewvault.interview.enums.QuestionType;
import com.interviewvault.interview.enums.RoundType;
import com.interviewvault.interview.repository.FollowUpMapper;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.repository.InterviewCandidateMapper;
import com.interviewvault.interview.repository.InterviewRoundMapper;
import com.interviewvault.interview.repository.InterviewSourceMapper;
import com.interviewvault.interview.repository.InterviewTagMapper;
import com.interviewvault.interview.repository.QuestionMapper;

/**
 * 聚合子数据写入引擎（api-design「InterviewUpsertRequest」/§12.6 硬规则）：
 * - Round / Question / FollowUp 按 id 差异更新——已有子项必须回传原 id，缺失视为删除，
 *   禁止 delete-all + reinsert（保住 Question 稳定锚点）；
 * - 传入 id 必须属于当前聚合，跨面经引用一律拒绝；子项可跨轮 / 跨问题移动（id 不变）；
 * - sortOrder 由数组顺序生成；所有旧子项先负数占位，再按目标关系与顺序写入，最后删除缺失父项；
 * - tags / sources / 候选值随聚合整体替换（无稳定 id 契约）；
 * - 迁移只读字段（originalPositionName / inferredPositionName / note）不属于本引擎，永不被触碰。
 */
@Component
public class InterviewAggregateWriter {

    private final InterviewRecordMapper interviews;
    private final InterviewRoundMapper rounds;
    private final QuestionMapper questions;
    private final FollowUpMapper followUps;
    private final InterviewTagMapper interviewTags;
    private final TagMapper tags;
    private final InterviewCandidateMapper candidates;
    private final InterviewSourceMapper sources;

    public InterviewAggregateWriter(InterviewRecordMapper interviews, InterviewRoundMapper rounds, QuestionMapper questions,
                                    FollowUpMapper followUps, InterviewTagMapper interviewTags,
                                    TagMapper tags, InterviewCandidateMapper candidates,
                                    InterviewSourceMapper sources) {
        this.interviews = interviews;
        this.rounds = rounds;
        this.questions = questions;
        this.followUps = followUps;
        this.interviewTags = interviewTags;
        this.tags = tags;
        this.candidates = candidates;
        this.sources = sources;
    }

    /** 轮次 / 问题 / 追问差异写入；返回「输入下标 → 数据库 roundId」供上层组装响应。 */
    public Map<Integer, Long> writeChildren(Long interviewId, List<RoundInput> roundInputs, long expectedVersion) {
        // 所有聚合写入都先锁同一个根；并发旧请求在改子项前返回 409，避免瞬时 UNIQUE 冲突。
        var record = interviews.selectByIdForUpdate(interviewId);
        if (record == null || record.getVersion() != expectedVersion) {
            throw BizException.interviewVersionConflict();
        }
        List<InterviewRound> existingRounds = rounds.selectList(
                new LambdaQueryWrapper<InterviewRound>()
                        .eq(InterviewRound::getInterviewId, interviewId)
                        .orderByAsc(InterviewRound::getSortOrder));
        List<Long> roundIds = existingRounds.stream().map(InterviewRound::getId).toList();
        List<Question> existingQuestions = roundIds.isEmpty() ? List.of()
                : questions.selectList(new LambdaQueryWrapper<Question>().in(Question::getRoundId, roundIds).orderByAsc(Question::getId));
        List<Long> questionIds = existingQuestions.stream().map(Question::getId).toList();
        List<FollowUp> existingFollowUps = questionIds.isEmpty() ? List.of()
                : followUps.selectList(new LambdaQueryWrapper<FollowUp>()
                .in(FollowUp::getQuestionId, questionIds).orderByAsc(FollowUp::getId));

        Map<Long, InterviewRound> roundById = existingRounds.stream()
                .collect(Collectors.toMap(InterviewRound::getId, r -> r));
        Map<Long, Question> questionById = existingQuestions.stream()
                .collect(Collectors.toMap(Question::getId, q -> q));
        Map<Long, FollowUp> followUpById = existingFollowUps.stream()
                .collect(Collectors.toMap(FollowUp::getId, f -> f));

        // 输入 id 收集与校验：无重复、必须属于当前聚合
        Set<Long> inRoundIds = new HashSet<>();
        for (RoundInput r : roundInputs) {
            if (r.id() != null) {
                if (!inRoundIds.add(r.id())) {
                    throw BizException.validation("轮次 id 重复出现: " + r.id());
                }
                if (!roundById.containsKey(r.id())) {
                    throw BizException.validation("轮次 id 不属于该面经: " + r.id());
                }
            }
        }
        Set<Long> inQuestionIds = new HashSet<>();
        Set<Long> inFollowUpIds = new HashSet<>();
        for (RoundInput r : roundInputs) {
            for (QuestionInput q : safeQuestions(r)) {
                if (q.id() != null) {
                    if (!inQuestionIds.add(q.id())) {
                        throw BizException.validation("问题 id 重复出现: " + q.id());
                    }
                    if (!questionById.containsKey(q.id())) {
                        throw BizException.validation("问题 id 不属于该面经: " + q.id());
                    }
                }
                for (FollowUpInput f : safeFollowUps(q)) {
                    if (f.id() != null) {
                        if (!inFollowUpIds.add(f.id())) {
                            throw BizException.validation("追问 id 重复出现: " + f.id());
                        }
                        if (!followUpById.containsKey(f.id())) {
                            throw BizException.validation("追问 id 不属于该面经: " + f.id());
                        }
                    }
                }
            }
        }

        // 先让所有旧行让出最终排序位置；保留的子项迁移完后，才能删除旧父项。
        int interimOrder = 0;
        for (InterviewRound existing : existingRounds) {
            requireUpdated(rounds.update(null, new LambdaUpdateWrapper<InterviewRound>()
                    .eq(InterviewRound::getId, existing.getId())
                    .set(InterviewRound::getSortOrder, --interimOrder)));
        }
        interimOrder = 0;
        for (Question existing : existingQuestions) {
            requireUpdated(questions.update(null, new LambdaUpdateWrapper<Question>()
                    .eq(Question::getId, existing.getId())
                    .set(Question::getSortOrder, --interimOrder)));
        }
        interimOrder = 0;
        for (FollowUp existing : existingFollowUps) {
            requireUpdated(followUps.update(null, new LambdaUpdateWrapper<FollowUp>()
                    .eq(FollowUp::getId, existing.getId())
                    .set(FollowUp::getSortOrder, --interimOrder)));
        }

        Map<Integer, Long> roundDbIdByIndex = new LinkedHashMap<>();
        int roundIndex = 0;
        for (RoundInput r : roundInputs) {
            if (r.id() != null) {
                updateRound(r.id(), r, roundById.get(r.id()), roundIndex + 1);
                roundDbIdByIndex.put(roundIndex, r.id());
            } else {
                InterviewRound created = new InterviewRound(interviewId, r.roundType(), r.roundNo(),
                        null, r.interviewDate(), r.interviewDate() == null ? null
                                : InterviewDatePrecision.DAY, roundIndex + 1);
                rounds.insert(created);
                roundDbIdByIndex.put(roundIndex, created.getId());
            }
            roundIndex++;
        }

        List<Long> questionDbIds = new ArrayList<>();
        roundIndex = 0;
        for (RoundInput r : roundInputs) {
            long roundDbId = roundDbIdByIndex.get(roundIndex++);
            int questionOrder = 0;
            for (QuestionInput q : safeQuestions(r)) {
                questionOrder++;
                if (q.id() != null) {
                    updateQuestion(q.id(), roundDbId, q, questionOrder);
                    questionDbIds.add(q.id());
                } else {
                    Question created = toQuestion(roundDbId, q, questionOrder);
                    questions.insert(created);
                    questionDbIds.add(created.getId());
                }
            }
        }

        int flatQuestion = 0;
        int followUpCount = 0;
        for (RoundInput r : roundInputs) {
            for (QuestionInput q : safeQuestions(r)) {
                long questionDbId = questionDbIds.get(flatQuestion++);
                int followUpOrder = 0;
                for (FollowUpInput f : safeFollowUps(q)) {
                    followUpOrder++;
                    followUpCount++;
                    if (f.id() != null) {
                        updateFollowUp(f.id(), questionDbId, f, followUpOrder);
                    } else {
                        followUps.insert(new FollowUp(questionDbId, f.content(), followUpOrder));
                    }
                }
            }
        }

        List<Long> followUpsToDelete = existingFollowUps.stream().map(FollowUp::getId)
                .filter(id -> !inFollowUpIds.contains(id)).toList();
        if (!followUpsToDelete.isEmpty()) {
            followUps.deleteByIds(followUpsToDelete);
        }
        List<Long> questionsToDelete = existingQuestions.stream().map(Question::getId)
                .filter(id -> !inQuestionIds.contains(id)).toList();
        if (!questionsToDelete.isEmpty()) {
            questions.deleteByIds(questionsToDelete);
        }
        List<Long> roundsToDelete = existingRounds.stream().map(InterviewRound::getId)
                .filter(id -> !inRoundIds.contains(id)).toList();
        if (!roundsToDelete.isEmpty()) {
            rounds.deleteByIds(roundsToDelete);
        }

        // 输入合法还不够：核对实际存储数量，任何意外缺项都让外层事务回滚。
        long storedRounds = rounds.selectCount(new LambdaQueryWrapper<InterviewRound>()
                .eq(InterviewRound::getInterviewId, interviewId));
        long storedQuestions = roundDbIdByIndex.isEmpty() ? 0
                : questions.selectCount(new LambdaQueryWrapper<Question>()
                .in(Question::getRoundId, roundDbIdByIndex.values()));
        long storedFollowUps = questionDbIds.isEmpty() ? 0
                : followUps.selectCount(new LambdaQueryWrapper<FollowUp>()
                .in(FollowUp::getQuestionId, questionDbIds));
        if (storedRounds != roundInputs.size() || storedQuestions != questionDbIds.size()
                || storedFollowUps != followUpCount) {
            throw BizException.interviewVersionConflict();
        }
        return roundDbIdByIndex;
    }

    /** 正式标签关系整体替换（纯关系表无稳定 id 契约）；tagIds 必须真实存在，重复 id 保序去重。 */
    public void writeTags(Long interviewId, List<Long> tagIds) {
        List<Long> distinct = tagIds.stream().distinct().toList();
        for (Long tagId : distinct) {
            if (tags.selectById(tagId) == null) {
                throw BizException.catalogNotFound("TAG", tagId);
            }
        }
        interviewTags.deleteByInterviewId(interviewId);
        for (Long tagId : distinct) {
            interviewTags.insert(new InterviewTag(interviewId, tagId));
        }
    }

    /** 标签候选整体替换；同名自重复由上层校验，这里按提交顺序落库。 */
    public void writeTagCandidates(Long interviewId, List<String> proposedTags) {
        candidates.delete(new LambdaQueryWrapper<InterviewCandidate>()
                .eq(InterviewCandidate::getInterviewId, interviewId)
                .eq(InterviewCandidate::getType, CandidateType.TAG));
        int order = 0;
        for (String name : proposedTags) {
            order++;
            candidates.insert(new InterviewCandidate(interviewId, CandidateType.TAG,
                    name.strip(), NameNormalizer.normalize(name), order));
        }
    }

    /** 公司 / 岗位候选：单值语义——先清同类型候选，再写入（正式 id 走 interview_record 列）。 */
    public void writeSingleCandidate(Long interviewId, CandidateType type, String proposedName) {
        candidates.delete(new LambdaQueryWrapper<InterviewCandidate>()
                .eq(InterviewCandidate::getInterviewId, interviewId)
                .eq(InterviewCandidate::getType, type));
        if (proposedName != null) {
            candidates.insert(new InterviewCandidate(interviewId, type,
                    proposedName.strip(), NameNormalizer.normalize(proposedName), 0));
        }
    }

    /** 用户投稿来源：最多一条；null/空白 → 清空；URL 基础同源归一。 */
    public void writeSources(Long interviewId, String sourceUrl) {
        sources.delete(new LambdaQueryWrapper<InterviewSource>()
                .eq(InterviewSource::getInterviewId, interviewId));
        if (sourceUrl != null && !sourceUrl.isBlank()) {
            String url = sourceUrl.strip();
            sources.insert(new InterviewSource(interviewId, url, UrlNormalizer.normalize(url)));
        }
    }

    // ---------- 内部 ----------

    private List<QuestionInput> safeQuestions(RoundInput r) {
        return r.questions() == null ? List.of() : r.questions();
    }

    private List<FollowUpInput> safeFollowUps(QuestionInput q) {
        return q.followUps() == null ? List.of() : q.followUps();
    }

    private void updateRound(Long id, RoundInput in, InterviewRound existing, int interimOrder) {
        if (in.roundType() == RoundType.UNKNOWN && existing.getRoundType() != RoundType.UNKNOWN) {
            throw BizException.validation("只能保留已有的未明确轮次，不能把标准轮次改为 UNKNOWN");
        }
        LambdaUpdateWrapper<InterviewRound> wrapper = new LambdaUpdateWrapper<InterviewRound>()
                .eq(InterviewRound::getId, id)
                .set(InterviewRound::getRoundType, in.roundType())
                .set(InterviewRound::getRoundNo, in.roundNo())
                .set(InterviewRound::getInterviewDate, in.interviewDate())
                .set(InterviewRound::getSortOrder, interimOrder)
                .set(InterviewRound::getUpdateTime, OffsetDateTime.now());
        if (in.interviewDate() == null) {
            wrapper.set(InterviewRound::getInterviewDatePrecision, null);
        } else if (existing == null || existing.getInterviewDate() == null
                || !existing.getInterviewDate().equals(in.interviewDate())) {
            // 日期变化按 DAY；日期未动保留历史月 / 年精度
            wrapper.set(InterviewRound::getInterviewDatePrecision, InterviewDatePrecision.DAY);
        }
        requireUpdated(rounds.update(null, wrapper));
    }

    private void updateQuestion(Long id, Long roundDbId, QuestionInput in, int interimOrder) {
        String reference = blankToNull(in.referenceUrl());
        LambdaUpdateWrapper<Question> wrapper = new LambdaUpdateWrapper<Question>()
                .eq(Question::getId, id)
                .set(Question::getRoundId, roundDbId)
                .set(Question::getContent, in.content())
                .set(Question::getReferenceUrl, reference)
                .set(Question::getSortOrder, interimOrder)
                .set(Question::getUpdateTime, OffsetDateTime.now());
        if (reference != null) {
            wrapper.set(Question::getQuestionType, QuestionType.ALGORITHM);
        } else {
            // 「相关题目链接」是用户可见字段：清空即删除（含 legacy leetcode_url）；questionType 只升不降
            wrapper.set(Question::getLeetcodeUrl, null);
        }
        requireUpdated(questions.update(null, wrapper));
    }

    private void updateFollowUp(Long id, Long questionDbId, FollowUpInput in, int order) {
        requireUpdated(followUps.update(null, new LambdaUpdateWrapper<FollowUp>()
                .eq(FollowUp::getId, id)
                .set(FollowUp::getQuestionId, questionDbId)
                .set(FollowUp::getContent, in.content())
                .set(FollowUp::getSortOrder, order)
                .set(FollowUp::getUpdateTime, OffsetDateTime.now())));
    }

    private void requireUpdated(int affectedRows) {
        if (affectedRows != 1) {
            throw BizException.interviewVersionConflict();
        }
    }

    private Question toQuestion(Long roundDbId, QuestionInput in, int order) {
        String reference = blankToNull(in.referenceUrl());
        return new Question(roundDbId, in.content(), order,
                reference == null ? QuestionType.NORMAL : QuestionType.ALGORITHM, reference);
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
