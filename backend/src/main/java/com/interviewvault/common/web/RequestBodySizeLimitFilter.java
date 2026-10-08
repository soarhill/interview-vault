package com.interviewvault.common.web;

import java.io.IOException;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interviewvault.common.response.Result;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 写请求体大小上限（api-design §12.2：1 MB）：字段级校验之外的第一道闸，
 * 防止巨型 JSON 在反序列化阶段就吃掉内存与 CPU。仅看 Content-Length；
 * 分块传输由反向代理在入口限制（见部署 runbook）。
 */
@Component
public class RequestBodySizeLimitFilter extends OncePerRequestFilter {

    static final long MAX_BODY_BYTES = 1024 * 1024;

    private final ObjectMapper objectMapper;

    public RequestBodySizeLimitFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String method = request.getMethod();
        if (("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method))
                && request.getContentLengthLong() > MAX_BODY_BYTES) {
            response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getWriter(),
                    Result.error("PAYLOAD_TOO_LARGE", "请求体超过大小上限（1 MB）"));
            return;
        }
        chain.doFilter(request, response);
    }
}
