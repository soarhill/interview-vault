package com.interviewvault.interview.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.interview.entity.Question;

/** 简单 CRUD 走 MyBatis-Plus；复杂查询见 SearchMapper.xml。 */
@Mapper
public interface QuestionMapper extends BaseMapper<Question> {
}
