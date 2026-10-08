package com.interviewvault.interview.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.interview.entity.InterviewSource;

/** 简单 CRUD 走 MyBatis-Plus；复杂查询见 SearchMapper.xml。 */
@Mapper
public interface InterviewSourceMapper extends BaseMapper<InterviewSource> {
}
