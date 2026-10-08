package com.interviewvault.interview.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/** 追问依附于主问题，不占独立 Q 编号。 */
@TableName("follow_up")
public class FollowUp {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long questionId;
    private String content;
    private Integer sortOrder;
    /** 数据库默认值维护；更新时由写入引擎显式设置。 */
    private java.time.OffsetDateTime updateTime;

    protected FollowUp() {
    }

    public FollowUp(Long questionId, String content, Integer sortOrder) {
        this.questionId = questionId;
        this.content = content;
        this.sortOrder = sortOrder;
    }

    public Long getId() {
        return id;
    }

    public Long getQuestionId() {
        return questionId;
    }

    public String getContent() {
        return content;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public java.time.OffsetDateTime getUpdateTime() {
        return updateTime;
    }
}
