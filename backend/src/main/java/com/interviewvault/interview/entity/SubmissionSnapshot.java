package com.interviewvault.interview.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.interviewvault.common.persistence.JsonbStringTypeHandler;

/** 用户提交审核时的完整 JSON 快照；只用于审计追溯，不参与公开查询与搜索。 */
@TableName(value = "submission_snapshot", autoResultMap = true)
public class SubmissionSnapshot {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long interviewId;

    @TableField(typeHandler = JsonbStringTypeHandler.class)
    private String payload;

    /** 数据库默认值维护；审核列表 submitTime 取最近一次快照时间。 */
    private java.time.OffsetDateTime createTime;

    protected SubmissionSnapshot() {
    }

    public SubmissionSnapshot(Long interviewId, String payload) {
        this.interviewId = interviewId;
        this.payload = payload;
    }

    public Long getId() {
        return id;
    }

    public Long getInterviewId() {
        return interviewId;
    }

    public String getPayload() {
        return payload;
    }

    public java.time.OffsetDateTime getCreateTime() {
        return createTime;
    }
}
