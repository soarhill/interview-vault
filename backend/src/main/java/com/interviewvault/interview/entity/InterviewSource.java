package com.interviewvault.interview.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/** 来源链接；新投稿最多一个，历史记录可多个。normalizedUrl 用于基础同源提醒，不做全局唯一。 */
@TableName("interview_source")
public class InterviewSource {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long interviewId;
    private String url;
    private String normalizedUrl;

    protected InterviewSource() {
    }

    public InterviewSource(Long interviewId, String url, String normalizedUrl) {
        this.interviewId = interviewId;
        this.url = url;
        this.normalizedUrl = normalizedUrl;
    }

    public Long getId() {
        return id;
    }

    public Long getInterviewId() {
        return interviewId;
    }

    public String getUrl() {
        return url;
    }

    public String getNormalizedUrl() {
        return normalizedUrl;
    }
}
