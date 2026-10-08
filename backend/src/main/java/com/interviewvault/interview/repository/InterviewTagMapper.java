package com.interviewvault.interview.repository;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.interviewvault.interview.entity.InterviewTag;

/**
 * 纯关系表（联合主键 interview_id + tag_id）。不继承 BaseMapper：
 * 无单列主键，byId 系列语义不适用，显式声明 SQL。
 */
@Mapper
public interface InterviewTagMapper {

    @Select("SELECT interview_id, tag_id FROM interview_tag"
            + " WHERE interview_id = #{interviewId} ORDER BY tag_id")
    List<InterviewTag> findByInterviewId(@Param("interviewId") long interviewId);

    @Select("SELECT COUNT(*) > 0 FROM interview_tag"
            + " WHERE interview_id = #{interviewId} AND tag_id = #{tagId}")
    boolean existsByInterviewAndTag(@Param("interviewId") long interviewId,
                                    @Param("tagId") long tagId);

    @Insert("INSERT INTO interview_tag (interview_id, tag_id)"
            + " VALUES (#{interviewId}, #{tagId})")
    int insert(InterviewTag relation);

    @Delete("DELETE FROM interview_tag WHERE interview_id = #{interviewId}")
    int deleteByInterviewId(@Param("interviewId") long interviewId);
}
