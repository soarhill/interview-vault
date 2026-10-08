package com.interviewvault.interview.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.interviewvault.interview.enums.QuestionType;

/** 主问题；Q 编号由 UI 按 sortOrder 生成，id 才是稳定锚点。referenceUrl 是唯一写入链接，历史字段只读兼容。 */
@TableName("question")
public class Question {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long roundId;
    private String content;
    private Integer sortOrder;
    private String referenceUrl;
    private QuestionType questionType;
    private String sectionLabel;
    private String contextNote;
    private String algorithmTitle;
    private String algorithmDescription;
    private String algorithmRequirements;
    private Integer leetcodeNumber;
    private String leetcodeUrl;
    /** 数据库默认值维护；更新时由写入引擎显式设置。 */
    private java.time.OffsetDateTime updateTime;

    protected Question() {
    }

    public Question(Long roundId, String content, Integer sortOrder, QuestionType questionType,
                    String referenceUrl) {
        this.roundId = roundId;
        this.content = content;
        this.sortOrder = sortOrder;
        this.questionType = questionType;
        this.referenceUrl = referenceUrl;
    }

    public Question(Long roundId, String content, Integer sortOrder, QuestionType questionType,
                    String sectionLabel, String contextNote, String algorithmTitle,
                    String algorithmDescription, String algorithmRequirements,
                    Integer leetcodeNumber, String leetcodeUrl) {
        this.roundId = roundId;
        this.content = content;
        this.sortOrder = sortOrder;
        this.questionType = questionType;
        this.sectionLabel = sectionLabel;
        this.contextNote = contextNote;
        this.algorithmTitle = algorithmTitle;
        this.algorithmDescription = algorithmDescription;
        this.algorithmRequirements = algorithmRequirements;
        this.leetcodeNumber = leetcodeNumber;
        this.leetcodeUrl = leetcodeUrl;
    }

    public Long getId() {
        return id;
    }

    public Long getRoundId() {
        return roundId;
    }

    public String getContent() {
        return content;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public QuestionType getQuestionType() {
        return questionType;
    }

    public String getReferenceUrl() {
        return referenceUrl;
    }

    public String getSectionLabel() {
        return sectionLabel;
    }

    public String getContextNote() {
        return contextNote;
    }

    public String getAlgorithmTitle() {
        return algorithmTitle;
    }

    public String getAlgorithmDescription() {
        return algorithmDescription;
    }

    public String getAlgorithmRequirements() {
        return algorithmRequirements;
    }

    public Integer getLeetcodeNumber() {
        return leetcodeNumber;
    }

    public String getLeetcodeUrl() {
        return leetcodeUrl;
    }

    public java.time.OffsetDateTime getUpdateTime() {
        return updateTime;
    }
}
