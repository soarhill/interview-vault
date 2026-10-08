package com.interviewvault.catalog.repository;

import org.apache.ibatis.annotations.Mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.interviewvault.catalog.entity.Tag;

@Mapper
public interface TagMapper extends BaseMapper<Tag> {
}
