package com.interviewvault.review.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.review.entity.InterviewRevision;

@Mapper
public interface InterviewRevisionMapper extends BaseMapper<InterviewRevision> {
}
