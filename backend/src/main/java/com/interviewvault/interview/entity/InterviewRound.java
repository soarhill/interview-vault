package com.interviewvault.interview.entity;

import java.time.LocalDate;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.interviewvault.interview.enums.InterviewDatePrecision;
import com.interviewvault.interview.enums.RoundType;

/**
 * 面试轮次：TECHNICAL + roundNo(1~5) / HR / UNKNOWN(历史无法归一，remark 保留原始描述)。
 * 日期与精度同空同有；sortOrder 才是展示顺序。
 */
@TableName("interview_round")
public class InterviewRound {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long interviewId;
    private RoundType roundType;
    private Integer roundNo;
    private String remark;
    private LocalDate interviewDate;
    private InterviewDatePrecision interviewDatePrecision;
    private Integer sortOrder;
    /** 数据库默认值维护；更新时由写入引擎显式设置。 */
    private java.time.OffsetDateTime updateTime;

    protected InterviewRound() {
    }

    public InterviewRound(Long interviewId, RoundType roundType, Integer roundNo, String remark,
                          LocalDate interviewDate, InterviewDatePrecision interviewDatePrecision,
                          Integer sortOrder) {
        this.interviewId = interviewId;
        this.roundType = roundType;
        this.roundNo = roundNo;
        this.remark = remark;
        this.interviewDate = interviewDate;
        this.interviewDatePrecision = interviewDatePrecision;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public Long getInterviewId() {
        return interviewId;
    }

    public RoundType getRoundType() {
        return roundType;
    }

    public Integer getRoundNo() {
        return roundNo;
    }

    public String getRemark() {
        return remark;
    }

    public LocalDate getInterviewDate() {
        return interviewDate;
    }

    public InterviewDatePrecision getInterviewDatePrecision() {
        return interviewDatePrecision;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public java.time.OffsetDateTime getUpdateTime() {
        return updateTime;
    }
}
