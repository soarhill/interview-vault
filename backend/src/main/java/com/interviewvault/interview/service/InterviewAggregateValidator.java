package com.interviewvault.interview.service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.dto.request.FollowUpInput;
import com.interviewvault.interview.dto.request.QuestionInput;
import com.interviewvault.interview.dto.request.RoundInput;
import com.interviewvault.interview.dto.request.SelectionInput;
import com.interviewvault.interview.enums.RecruitType;
import com.interviewvault.interview.enums.RoundType;

/**
 * 聚合输入统一校验：普通投稿保存、管理员编辑待审核、ChangeRequest payload、
 * 已发布直改全部经过这里——长度 / 数量 / URL scheme / 轮次序号 / 重复值只有这一份规则。
 * 上限值与 api-design §12.2 一致；草稿允许缺字段（validateFormat），
 * 写入 PUBLISHED 的路径必须再加完整性（requirePublishedComplete）。
 */
@Component
public class InterviewAggregateValidator {

    public static final int MAX_ROUNDS = 10;
    public static final int MAX_QUESTIONS_PER_ROUND = 50;
    public static final int MAX_FOLLOW_UPS_PER_QUESTION = 20;
    public static final int MAX_TAG_IDS = 20;
    public static final int MAX_PROPOSED_TAGS = 20;
    public static final int MAX_PROPOSED_TAG_LENGTH = 50;
    public static final int MAX_SOURCES = 10;
    public static final int MAX_DEPARTMENT_LENGTH = 100;
    public static final int MAX_QUESTION_LENGTH = 2000;
    public static final int MAX_FOLLOW_UP_LENGTH = 1000;
    public static final int MAX_URL_LENGTH = 500;

    private static final String HTTP_URL = "^https?://.+";

    /** 草稿格式校验（允许不完整）：所有聚合写入路径的公共下限。 */
    public void validateFormat(SelectionInput company, SelectionInput position, String department,
                               RecruitType recruitType, List<Long> tagIds, List<String> proposedTags,
                               List<RoundInput> rounds, List<String> sourceUrls) {
        checkSelectionInput(company, "公司");
        checkSelectionInput(position, "岗位");
        if (department != null && department.strip().length() > MAX_DEPARTMENT_LENGTH) {
            throw BizException.validation("部门不能超过 " + MAX_DEPARTMENT_LENGTH + " 字符");
        }
        checkSourceUrls(sourceUrls);
        if (tagIds != null) {
            if (tagIds.size() > MAX_TAG_IDS) {
                throw BizException.validation("正式标签最多 " + MAX_TAG_IDS + " 个");
            }
            if (tagIds.stream().anyMatch(id -> id == null || id <= 0)) {
                throw BizException.validation("tagIds 必须包含有效的标签 id");
            }
            if (tagIds.stream().distinct().count() != tagIds.size()) {
                throw BizException.validation("tagIds 存在重复值");
            }
        }
        checkProposedTags(proposedTags);
        if (rounds != null && rounds.size() > MAX_ROUNDS) {
            throw BizException.validation("面试轮次最多 " + MAX_ROUNDS + " 轮");
        }
        Set<Integer> technicalRoundNos = new HashSet<>();
        for (RoundInput round : safeRounds(rounds)) {
            validateRound(round, technicalRoundNos);
        }
    }

    /**
     * PUBLISHED 完整性：已发布内容的所有写入（管理员直改、变更申请批准）必须保持
     * 公司 / 岗位 / 招聘类型 / 至少一轮一问，防止空聚合继续留在已发布状态。
     */
    public void requirePublishedComplete(SelectionInput company, SelectionInput position,
                                         RecruitType recruitType, List<RoundInput> rounds) {
        if (company == null || company.empty()) {
            throw BizException.interviewIncomplete("已发布内容必须确定公司");
        }
        if (position == null || position.empty()) {
            throw BizException.interviewIncomplete("已发布内容必须确定岗位");
        }
        if (recruitType == null) {
            throw BizException.interviewIncomplete("已发布内容必须确定招聘类型");
        }
        boolean anyQuestion = safeRounds(rounds).stream()
                .anyMatch(r -> r.questions() != null && !r.questions().isEmpty());
        if (safeRounds(rounds).isEmpty() || !anyQuestion) {
            throw BizException.interviewIncomplete("已发布内容至少需要一个面试轮次和一个问题");
        }
    }

    // ---------- 内部 ----------

    private void validateRound(RoundInput round, Set<Integer> technicalRoundNos) {
        if (round == null) {
            throw BizException.validation("轮次不能为 null");
        }
        if (round.roundType() == null
                || (round.roundType() == RoundType.UNKNOWN && round.id() == null)) {
            throw BizException.validation("轮次类型不支持: " + round.roundType());
        }
        if (round.roundType() == RoundType.TECHNICAL) {
            if (round.roundNo() == null || round.roundNo() < 1 || round.roundNo() > 5) {
                throw BizException.validation("技术面轮次序号必须是 1～5");
            }
            if (!technicalRoundNos.add(round.roundNo())) {
                throw BizException.validation("技术面轮次序号重复: 第 " + round.roundNo() + " 面");
            }
        } else if (round.roundNo() != null) {
            throw BizException.validation("HR 面不能携带轮次序号");
        }
        List<QuestionInput> questions = round.questions() == null ? List.of() : round.questions();
        if (questions.size() > MAX_QUESTIONS_PER_ROUND) {
            throw BizException.validation("每轮问题最多 " + MAX_QUESTIONS_PER_ROUND + " 个");
        }
        for (QuestionInput q : questions) {
            if (q == null) {
                throw BizException.validation("问题不能为 null");
            }
            if (q.content() == null || q.content().isBlank()) {
                throw BizException.validation("问题内容不能为空");
            }
            if (q.content().strip().length() > MAX_QUESTION_LENGTH) {
                throw BizException.validation("问题内容不能超过 " + MAX_QUESTION_LENGTH + " 字符");
            }
            if (q.referenceUrl() != null && !q.referenceUrl().isBlank()) {
                String url = q.referenceUrl().strip();
                if (!url.toLowerCase().matches(HTTP_URL)) {
                    throw BizException.validation("题目链接必须是 HTTP/HTTPS URL");
                }
                if (url.length() > MAX_URL_LENGTH) {
                    throw BizException.validation("题目链接不能超过 " + MAX_URL_LENGTH + " 字符");
                }
            }
            List<FollowUpInput> followUps = q.followUps() == null ? List.of() : q.followUps();
            if (followUps.size() > MAX_FOLLOW_UPS_PER_QUESTION) {
                throw BizException.validation("每个问题最多 " + MAX_FOLLOW_UPS_PER_QUESTION + " 条追问");
            }
            for (FollowUpInput f : followUps) {
                if (f == null) {
                    throw BizException.validation("追问不能为 null");
                }
                if (f.content() == null || f.content().isBlank()) {
                    throw BizException.validation("追问内容不能为空");
                }
                if (f.content().strip().length() > MAX_FOLLOW_UP_LENGTH) {
                    throw BizException.validation("追问内容不能超过 " + MAX_FOLLOW_UP_LENGTH + " 字符");
                }
            }
        }
    }

    private void checkSourceUrls(List<String> sourceUrls) {
        if (sourceUrls == null) {
            return;
        }
        if (sourceUrls.size() > MAX_SOURCES) {
            throw BizException.validation("来源链接最多 " + MAX_SOURCES + " 条");
        }
        for (String raw : sourceUrls) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String url = raw.strip();
            if (!url.toLowerCase().matches(HTTP_URL)) {
                throw BizException.validation("来源链接必须是 HTTP/HTTPS URL");
            }
            if (url.length() > MAX_URL_LENGTH) {
                throw BizException.validation("来源链接不能超过 " + MAX_URL_LENGTH + " 字符");
            }
        }
    }

    private void checkProposedTags(List<String> proposedTags) {
        if (proposedTags == null) {
            return;
        }
        if (proposedTags.size() > MAX_PROPOSED_TAGS) {
            throw BizException.validation("新标签最多 " + MAX_PROPOSED_TAGS + " 个");
        }
        Set<String> seen = new HashSet<>();
        for (String tag : proposedTags) {
            if (tag == null) {
                throw BizException.validation("新标签不能为 null");
            }
            String normalized = tag.strip().toLowerCase();
            if (normalized.isEmpty() || !seen.add(normalized)) {
                throw BizException.validation("新标签不能为空且不能自重复: " + tag);
            }
            if (tag.strip().length() > MAX_PROPOSED_TAG_LENGTH) {
                throw BizException.validation("新标签不能超过 " + MAX_PROPOSED_TAG_LENGTH + " 字符");
            }
        }
    }

    private void checkSelectionInput(SelectionInput input, String kind) {
        if (input != null && input.hasExisting() && input.hasProposed()) {
            throw BizException.validation(kind + "只能选择已有项或填写新名称其中之一");
        }
        if (input != null && input.existingId() != null && input.existingId() <= 0) {
            throw BizException.validation(kind + " id 非法");
        }
        if (input != null && input.hasProposed()
                && input.proposedName().strip().length() > MAX_PROPOSED_TAG_LENGTH + 50) {
            throw BizException.validation(kind + "名称过长");
        }
    }

    private List<RoundInput> safeRounds(List<RoundInput> rounds) {
        return rounds == null ? List.of() : rounds;
    }
}
