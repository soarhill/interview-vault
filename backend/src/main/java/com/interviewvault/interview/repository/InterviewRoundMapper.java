package com.interviewvault.interview.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.interview.entity.InterviewRound;

/** 简单 CRUD 走 MyBatis-Plus；复杂查询见 SearchMapper.xml。 */
@Mapper
public interface InterviewRoundMapper extends BaseMapper<InterviewRound> {

    /** 面经的问题总数（跨轮）；「我的投稿」列表计数用。 */
    @Select("SELECT count(q.id) FROM question q "
            + "JOIN interview_round r ON r.id = q.round_id "
            + "WHERE r.interview_id = #{interviewId}")
    long countQuestions(long interviewId);
}
