package com.interviewvault.review.repository;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.annotations.Param;
import com.interviewvault.review.enums.ChangeRequestType;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.review.entity.ChangeRequest;

@Mapper
public interface ChangeRequestMapper extends BaseMapper<ChangeRequest> {

    /** 短事务行级锁：审批动作先锁申请行再校验状态（api-design「version 乐观锁」）。 */
    @Select("SELECT * FROM change_request WHERE id = #{id} FOR UPDATE")
    ChangeRequest selectByIdForUpdate(long id);
    /** 显式转换 JSONB，避免 wrapper 把 String 绑定成 varchar；覆盖时申请修订号递增。 */
    @Update("UPDATE change_request SET type = #{type}, base_version = #{baseVersion}, "
            + "payload = CAST(#{payload} AS jsonb), reason = #{reason}, "
            + "request_version = request_version + 1, update_time = now() "
            + "WHERE id = #{id} AND status = 'PENDING'")
    int overwritePending(@Param("id") long id, @Param("type") ChangeRequestType type,
                         @Param("baseVersion") long baseVersion, @Param("payload") String payload,
                         @Param("reason") String reason);
}
