package com.interviewvault.auth.dto.response;

/** CSRF 初始化响应：token 同步写入 XSRF-TOKEN Cookie，前端读 Cookie 放 Header。 */
public record CsrfResponse(String headerName, String token) {
}
