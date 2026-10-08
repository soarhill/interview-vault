package com.interviewvault.catalog.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.catalog.entity.PositionCategoryRow;

@Mapper
public interface PositionCategoryMapper extends BaseMapper<PositionCategoryRow> {
}
