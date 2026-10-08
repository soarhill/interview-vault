package com.interviewvault.interview.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 页尾「加油一下」事件：一次加油一行。登录用户一人一次（部分唯一索引兜底）；
 * 游客由前端 localStorage 防重复。站点级轻互动，V1 归 interview（首页列表配套）。
 */
@TableName("cheer")
public class Cheer {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    protected Cheer() {
    }

    public Cheer(Long userId) {
        this.userId = userId;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }
}
