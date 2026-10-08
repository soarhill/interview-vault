package com.interviewvault.interview.entity;

import java.time.OffsetDateTime;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.interviewvault.interview.enums.InterviewStatus;
import com.interviewvault.interview.enums.RecruitType;

/**
 * 面经聚合根。company / position 以平面外键列表达，由 Service 组装；
 * 待审核阶段二者可为空（用户可能提出了候选公司 / 岗位）。
 */
@TableName("interview_record")
public class InterviewRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long authorId;
    private Long companyId;
    private Long positionId;
    private String department;
    private String originalPositionName;
    private String inferredPositionName;
    private String note;
    private RecruitType recruitType;
    private InterviewStatus status;
    private Long version;
    private String rejectionReason;
    /** 时间戳列由数据库默认值维护，读取时映射供响应使用；插入不携带。 */
    private OffsetDateTime createTime;
    private OffsetDateTime updateTime;
    private OffsetDateTime publishTime;

    protected InterviewRecord() {
    }

    public InterviewRecord(Long authorId, Long companyId, Long positionId, String department,
                           String originalPositionName, String inferredPositionName, String note,
                           RecruitType recruitType, InterviewStatus status) {
        this.authorId = authorId;
        this.companyId = companyId;
        this.positionId = positionId;
        this.department = department;
        this.originalPositionName = originalPositionName;
        this.inferredPositionName = inferredPositionName;
        this.note = note;
        this.recruitType = recruitType;
        this.status = status;
    }

    public Long getId() {
        return id;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public Long getCompanyId() {
        return companyId;
    }

    public Long getPositionId() {
        return positionId;
    }

    public String getDepartment() {
        return department;
    }

    public String getOriginalPositionName() {
        return originalPositionName;
    }

    public String getInferredPositionName() {
        return inferredPositionName;
    }

    public String getNote() {
        return note;
    }

    public RecruitType getRecruitType() {
        return recruitType;
    }

    public InterviewStatus getStatus() {
        return status;
    }

    public Long getVersion() {
        return version;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public OffsetDateTime getCreateTime() {
        return createTime;
    }

    public OffsetDateTime getUpdateTime() {
        return updateTime;
    }

    public OffsetDateTime getPublishTime() {
        return publishTime;
    }
}
