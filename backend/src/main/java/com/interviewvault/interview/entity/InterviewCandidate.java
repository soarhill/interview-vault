package com.interviewvault.interview.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.interviewvault.interview.enums.CandidateType;

/**
 * 投稿聚合的一部分：用户提出的新公司 / 岗位 / 标签候选值。
 * 不直接污染正式字典；管理员处理后从当前待处理集合移除。
 */
@TableName("interview_candidate")
public class InterviewCandidate {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long interviewId;
    private CandidateType type;
    private String value;
    private String normalizedValue;
    private Integer sortOrder;

    protected InterviewCandidate() {
    }

    public InterviewCandidate(Long interviewId, CandidateType type, String value,
                              String normalizedValue, Integer sortOrder) {
        this.interviewId = interviewId;
        this.type = type;
        this.value = value;
        this.normalizedValue = normalizedValue;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public Long getInterviewId() {
        return interviewId;
    }

    public CandidateType getType() {
        return type;
    }

    public String getValue() {
        return value;
    }

    public String getNormalizedValue() {
        return normalizedValue;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }
}
