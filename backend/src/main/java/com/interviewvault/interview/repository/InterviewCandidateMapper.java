package com.interviewvault.interview.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.interview.entity.InterviewCandidate;

@Mapper
public interface InterviewCandidateMapper extends BaseMapper<InterviewCandidate> {
}
