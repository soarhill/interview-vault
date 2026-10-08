package com.interviewvault.review.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.interviewvault.common.persistence.JsonbStringTypeHandler;
import com.interviewvault.review.enums.ChangeRequestStatus;
import com.interviewvault.review.enums.ChangeRequestType;

/**
 * 已发布内容的修改 / 删除申请。审核期间正式 InterviewRecord 保持 PUBLISHED；
 * 同一面经同一时间最多一个 PENDING（数据库部分唯一索引兜底）。
 */
@TableName(value = "change_request", autoResultMap = true)
public class ChangeRequest {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long interviewId;
    private Long requesterId;
    private Long reviewerId;
    private ChangeRequestType type;
    private ChangeRequestStatus status;
    private Long baseVersion;
    private Long requestVersion;

    @TableField(typeHandler = JsonbStringTypeHandler.class)
    private String payload;
    private String reason;

    /** 数据库默认值维护；审批动作由服务显式设置 reviewTime。 */
    private java.time.OffsetDateTime createTime;
    private java.time.OffsetDateTime updateTime;
    private java.time.OffsetDateTime reviewTime;

    protected ChangeRequest() {
    }

    public ChangeRequest(Long interviewId, Long requesterId, ChangeRequestType type,
                         Long baseVersion, String payload, String reason) {
        this.interviewId = interviewId;
        this.requesterId = requesterId;
        this.type = type;
        this.status = ChangeRequestStatus.PENDING;
        this.baseVersion = baseVersion;
        this.payload = payload;
        this.reason = reason;
    }

    public Long getId() {
        return id;
    }

    public Long getInterviewId() {
        return interviewId;
    }

    public Long getRequesterId() {
        return requesterId;
    }

    public Long getReviewerId() {
        return reviewerId;
    }

    public ChangeRequestType getType() {
        return type;
    }

    public ChangeRequestStatus getStatus() {
        return status;
    }

    public Long getBaseVersion() {
        return baseVersion;
    }

    public Long getRequestVersion() {
        return requestVersion;
    }

    public String getPayload() {
        return payload;
    }

    public String getReason() {
        return reason;
    }

    public java.time.OffsetDateTime getCreateTime() {
        return createTime;
    }

    public java.time.OffsetDateTime getUpdateTime() {
        return updateTime;
    }

    public java.time.OffsetDateTime getReviewTime() {
        return reviewTime;
    }
}
