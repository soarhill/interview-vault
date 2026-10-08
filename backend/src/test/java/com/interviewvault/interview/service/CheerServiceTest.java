package com.interviewvault.interview.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;

import com.interviewvault.auth.service.CurrentUserReader;
import com.interviewvault.common.exception.BizException;
import com.interviewvault.interview.repository.CheerMapper;

class CheerServiceTest {
    @Test
    void full_window_table_rejects_new_clients_but_preserves_existing_quotas() {
        CheerMapper mapper = mock(CheerMapper.class);
        CheerService service = new CheerService(mapper, mock(CurrentUserReader.class));
        // 纯内存/Mock 验证容量，不对数据库或网络发送负载。
        for (int index = 0; index < 10_000; index++) {
            service.cheer("synthetic-client-" + index);
        }
        assertThatThrownBy(() -> service.cheer("new-synthetic-client"))
                .isInstanceOf(BizException.class)
                .extracting("code").isEqualTo("CHEER_RATE_LIMITED");
        service.cheer("synthetic-client-0");
        verify(mapper, times(10_001)).insertCheer(null);
    }
}
