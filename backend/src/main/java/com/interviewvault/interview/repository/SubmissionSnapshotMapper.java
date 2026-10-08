package com.interviewvault.interview.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.interview.entity.SubmissionSnapshot;

@Mapper
public interface SubmissionSnapshotMapper extends BaseMapper<SubmissionSnapshot> {
}
