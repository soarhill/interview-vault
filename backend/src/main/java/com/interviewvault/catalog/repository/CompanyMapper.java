package com.interviewvault.catalog.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.catalog.entity.Company;

/** 简单 CRUD 走 MyBatis-Plus；复杂查询见 SearchMapper.xml。 */
@Mapper
public interface CompanyMapper extends BaseMapper<Company> {
}
