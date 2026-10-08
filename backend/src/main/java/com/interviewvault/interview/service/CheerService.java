package com.interviewvault.interview.service;

import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interviewvault.auth.service.CurrentUserReader;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.repository.CheerMapper;

/**
 * 页尾「加油一下」：游客可点（前端 localStorage 防重复 + 服务端按 IP 限流），
 * 登录用户一人一次（数据库唯一约束，重复加油幂等返回当前总数）。
 * 匿名行没有唯一约束兜底，必须挡住脚本循环灌库（cheer 表无限增长 + 每写一次全表计数）。
 */
@Service
public class CheerService {

    /** 匿名加油每 IP 窗口配额：单实例内存限流，够挡脚本；部署多实例时需上移到入口。 */
    static final int ANONYMOUS_LIMIT_PER_WINDOW = 5;
    static final long ANONYMOUS_WINDOW_MILLIS = 10 * 60 * 1000L;
    /** 窗口表硬上限：先清理过期项；容量仍满时拒绝新的 IP，已有窗口仍可使用剩余配额。 */
    private static final int MAX_TRACKED_WINDOWS = 10_000;

    private final CheerMapper cheers;
    private final CurrentUserReader currentUser;
    private final Map<String, long[]> anonymousWindows = new ConcurrentHashMap<>();

    public CheerService(CheerMapper cheers, CurrentUserReader currentUser) {
        this.cheers = cheers;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public long count() {
        return cheers.countAll();
    }

    @Transactional
    public long cheer(String clientIp) {
        var user = currentUser.get();
        if (user == null) {
            if (!tryAcquireAnonymousSlot(clientIp)) {
                throw new BizException("CHEER_RATE_LIMITED", HttpStatus.TOO_MANY_REQUESTS,
                        "加油太频繁了，稍后再试试");
            }
            cheers.insertCheer(null);
            return cheers.countAll();
        }
        cheers.insertCheer(user.id()); // 唯一约束冲突在 SQL 内幂等处理，不使 PG 事务进入 aborted 状态
        return cheers.countAll();
    }

    /** 固定窗口计数：窗口内未超配额才放行。 */
    private boolean tryAcquireAnonymousSlot(String clientIp) {
        String key = clientIp == null ? "unknown" : clientIp;
        long now = System.currentTimeMillis();
        synchronized (anonymousWindows) {
            if (anonymousWindows.size() >= MAX_TRACKED_WINDOWS) {
                evictExpired(now);
            }
            long[] window = anonymousWindows.get(key);
            if (window == null || now - window[0] >= ANONYMOUS_WINDOW_MILLIS) {
                if (window == null && anonymousWindows.size() >= MAX_TRACKED_WINDOWS) {
                    return false;
                }
                anonymousWindows.put(key, new long[]{now, 1});
                return true;
            }
            if (window[1] >= ANONYMOUS_LIMIT_PER_WINDOW) {
                return false;
            }
            window[1]++;
            return true;
        }
    }

    private void evictExpired(long now) {
        for (Iterator<Map.Entry<String, long[]>> it = anonymousWindows.entrySet().iterator();
             it.hasNext(); ) {
            if (now - it.next().getValue()[0] >= ANONYMOUS_WINDOW_MILLIS) {
                it.remove();
            }
        }
    }
}
