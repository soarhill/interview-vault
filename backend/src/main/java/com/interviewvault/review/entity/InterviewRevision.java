package com.interviewvault.review.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.interviewvault.common.persistence.JsonbStringTypeHandler;

/**
 * 管理员直接修改已发布面经的治理审计：payload 保存修改前的完整正式版本。
 * 与 SubmissionSnapshot 语义分离（后者是用户提交审核时的原始快照）。
 */
@TableName(value = "interview_revision", autoResultMap = true)
public class InterviewRevision {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long interviewId;
    private Long editorId;
    private Long baseVersion;

    @TableField(typeHandler = JsonbStringTypeHandler.class)
    private String payload;

    protected InterviewRevision() {
    }

    public InterviewRevision(Long interviewId, Long editorId, Long baseVersion, String payload) {
        this.interviewId = interviewId;
        this.editorId = editorId;
        this.baseVersion = baseVersion;
        this.payload = payload;
    }

    public Long getId() {
        return id;
    }

    public Long getInterviewId() {
        return interviewId;
    }

    public Long getEditorId() {
        return editorId;
    }

    public Long getBaseVersion() {
        return baseVersion;
    }

    public String getPayload() {
        return payload;
    }
}
