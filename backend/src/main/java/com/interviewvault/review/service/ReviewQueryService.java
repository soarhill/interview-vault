package com.interviewvault.review.service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewvault.auth.entity.User;
import com.interviewvault.auth.repository.UserMapper;
import com.interviewvault.catalog.entity.Company;
import com.interviewvault.catalog.entity.Position;
import com.interviewvault.catalog.entity.Tag;
import com.interviewvault.catalog.repository.CompanyMapper;
import com.interviewvault.catalog.repository.PositionMapper;
import com.interviewvault.catalog.repository.TagMapper;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.dto.response.CatalogSelectionView;
import com.interviewvault.interview.entity.InterviewCandidate;
import com.interviewvault.interview.entity.InterviewRecord;
import com.interviewvault.interview.entity.SubmissionSnapshot;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.repository.InterviewCandidateMapper;
import com.interviewvault.interview.repository.InterviewRecordMapper;
import com.interviewvault.interview.repository.SubmissionSnapshotMapper;
import com.interviewvault.interview.service.InterviewAggregateReader;
import com.interviewvault.interview.service.InterviewAggregateReader.Aggregate;
import com.interviewvault.review.dto.response.AdminReviewDetailResponse;
import com.interviewvault.review.dto.response.AdminReviewListItemResponse;
import com.interviewvault.review.dto.response.AdminReviewListResponse;
import com.interviewvault.review.dto.response.AuthorRef;
import com.interviewvault.review.dto.response.CandidateView;
import com.interviewvault.review.dto.response.SnapshotView;

/** 管理员审核查询：待审核列表与审核详情（快照反序列化为对象、候选项含建议匹配）。 */
@Service
public class ReviewQueryService {

    private final InterviewRecordMapper interviews;
    private final InterviewCandidateMapper candidates;
    private final SubmissionSnapshotMapper snapshots;
    private final UserMapper users;
    private final CompanyMapper companies;
    private final PositionMapper positions;
    private final TagMapper tags;
    private final InterviewAggregateReader aggregateReader;
    private final ObjectMapper objectMapper;

    public ReviewQueryService(InterviewRecordMapper interviews, InterviewCandidateMapper candidates,
                              SubmissionSnapshotMapper snapshots, UserMapper users,
                              CompanyMapper companies, PositionMapper positions, TagMapper tags,
                              InterviewAggregateReader aggregateReader, ObjectMapper objectMapper) {
        this.interviews = interviews;
        this.candidates = candidates;
        this.snapshots = snapshots;
        this.users = users;
        this.companies = companies;
        this.positions = positions;
        this.tags = tags;
        this.aggregateReader = aggregateReader;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public AdminReviewListResponse list(InterviewStatus status, int page, int size) {
        // 计数与取数分别构造 wrapper：selectCount 不能带 ORDER BY（PG 聚合限制）
        LambdaQueryWrapper<InterviewRecord> base = new LambdaQueryWrapper<InterviewRecord>()
                .isNotNull(InterviewRecord::getAuthorId); // 平台只审核用户投稿；历史导入无作者
        if (status != null) {
            base.eq(InterviewRecord::getStatus, status);
        }
        long total = interviews.selectCount(base);
        List<InterviewRecord> records = interviews.selectList(
                new LambdaQueryWrapper<InterviewRecord>()
                        .isNotNull(InterviewRecord::getAuthorId)
                        .eq(status != null, InterviewRecord::getStatus, status)
                        .orderByAsc(InterviewRecord::getUpdateTime)
                        .orderByAsc(InterviewRecord::getId)
                        .last("LIMIT " + size + " OFFSET " + (page - 1) * size));

        List<AdminReviewListItemResponse> items = new ArrayList<>();
        for (InterviewRecord record : records) {
            Aggregate aggregate = aggregateReader.load(record);
            items.add(new AdminReviewListItemResponse(
                    record.getId(),
                    aggregateReader.companyView(aggregate),
                    aggregateReader.positionView(aggregate),
                    authorRef(record.getAuthorId()),
                    record.getStatus().name(),
                    record.getVersion(),
                    aggregate.candidates().size(),
                    latestSnapshotTime(record.getId()),
                    record.getUpdateTime()));
        }
        return new AdminReviewListResponse(items, total, page, size);
    }

    @Transactional(readOnly = true)
    public AdminReviewDetailResponse detail(long id) {
        InterviewRecord record = interviews.selectById(id);
        if (record == null) {
            throw BizException.interviewNotFound();
        }
        Aggregate aggregate = aggregateReader.load(record);
        List<CandidateView> candidateViews = aggregate.candidates().stream()
                .map(this::toCandidateView)
                .toList();
        SubmissionSnapshot latest = latestSnapshot(id);
        SnapshotView snapshotView = latest == null ? null : new SnapshotView(latest.getId(),
                latest.getCreateTime(), readTree(latest.getPayload()));
        return new AdminReviewDetailResponse(
                aggregateReader.canonical(record, aggregate),
                authorRef(record.getAuthorId()),
                candidateViews,
                snapshotView);
    }

    // ---------- 内部 ----------

    private AuthorRef authorRef(Long userId) {
        if (userId == null) {
            return null; // 历史导入记录无作者（不出现在审核列表，防御处理）
        }
        User user = users.selectById(userId);
        return user == null ? null
                : new AuthorRef(user.getId(), user.getGithubLogin(), user.getAvatarUrl());
    }

    private SubmissionSnapshot latestSnapshot(long interviewId) {
        List<SubmissionSnapshot> list = snapshots.selectList(
                new LambdaQueryWrapper<SubmissionSnapshot>()
                        .eq(SubmissionSnapshot::getInterviewId, interviewId)
                        .orderByDesc(SubmissionSnapshot::getCreateTime)
                        .orderByDesc(SubmissionSnapshot::getId)
                        .last("LIMIT 1"));
        return list.isEmpty() ? null : list.get(0);
    }

    private java.time.OffsetDateTime latestSnapshotTime(long interviewId) {
        SubmissionSnapshot latest = latestSnapshot(interviewId);
        return latest == null ? null : latest.getCreateTime();
    }

    /** 建议匹配：同类型目录中名称包含候选值的前 5 项（V1 不使用 AI）。 */
    private CandidateView toCandidateView(InterviewCandidate candidate) {
        String value = candidate.getValue();
        List<CandidateView.SuggestedMatch> matches = switch (candidate.getType()) {
            case COMPANY -> companies.selectList(new LambdaQueryWrapper<Company>()
                            .like(Company::getName, value).last("LIMIT 5")).stream()
                    .map(c -> new CandidateView.SuggestedMatch(c.getId(), c.getName())).toList();
            case POSITION -> positions.selectList(new LambdaQueryWrapper<Position>()
                            .like(Position::getName, value).last("LIMIT 5")).stream()
                    .map(p -> new CandidateView.SuggestedMatch(p.getId(), p.getName())).toList();
            case TAG -> tags.selectList(new LambdaQueryWrapper<Tag>()
                            .like(Tag::getName, value).last("LIMIT 5")).stream()
                    .map(t -> new CandidateView.SuggestedMatch(t.getId(), t.getName())).toList();
        };
        return new CandidateView(candidate.getId(), candidate.getType().name(), value, matches);
    }

    private JsonNode readTree(String payload) {
        try {
            return objectMapper.readTree(payload);
        } catch (Exception e) {
            throw new IllegalStateException("快照反序列化失败", e);
        }
    }
}
