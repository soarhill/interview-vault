package com.interviewvault.auth.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.auth.entity.User;

@Mapper
public interface UserMapper extends BaseMapper<User> {
}
