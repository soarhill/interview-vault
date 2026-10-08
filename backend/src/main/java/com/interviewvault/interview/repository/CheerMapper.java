package com.interviewvault.interview.repository;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.interview.entity.Cheer;

@Mapper
public interface CheerMapper extends BaseMapper<Cheer> {

    /** 游客加油 user_id 为 NULL——MP 对全 null 实体会生成空列 INSERT，这里显式写列。 */
    @Insert("INSERT INTO cheer (user_id) VALUES (#{userId}) "
            + "ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING")
    int insertCheer(Long userId);

    @Select("SELECT count(*) FROM cheer")
    long countAll();
}
