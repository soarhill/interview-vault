package com.interviewvault.interview.entity;

import com.baomidou.mybatisplus.annotation.TableName;

/** InterviewRecord 与 Tag 的多对多关系；联合主键天然保证同一面经不重复绑定同一 Tag。 */
@TableName("interview_tag")
public class InterviewTag {

    private Long interviewId;
    private Long tagId;

    protected InterviewTag() {
    }

    public InterviewTag(Long interviewId, Long tagId) {
        this.interviewId = interviewId;
        this.tagId = tagId;
    }

    public Long getInterviewId() {
        return interviewId;
    }

    public Long getTagId() {
        return tagId;
    }
}
