package com.interviewvault.interview.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.interview.entity.InterviewRecord;

/** 简单 CRUD 走 MyBatis-Plus；复杂查询见 SearchMapper.xml。 */
@Mapper
public interface InterviewRecordMapper extends BaseMapper<InterviewRecord> {

    /**
     * 待处理变更申请计数（表属 review，SQL 级只读避免模块反向依赖）；
     * 「我的投稿」列表与 actions 计算用。
     */
    @Select("SELECT count(*) FROM change_request "
            + "WHERE interview_id = #{interviewId} AND status = 'PENDING'")
    long countPendingChangeRequests(long interviewId);

    /** 短事务行级锁：变更申请 / 直改等「先检查后写入」场景先锁行再校验（api-design「version 乐观锁」）。 */
    @Select("SELECT * FROM interview_record WHERE id = #{id} FOR UPDATE")
    InterviewRecord selectByIdForUpdate(long id);
}
