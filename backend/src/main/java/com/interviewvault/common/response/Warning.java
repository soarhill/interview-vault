package com.interviewvault.common.response;

/** 非阻断业务提示（如来源疑似重复）：不是失败，不携带 HTTP 错误状态。 */
public record Warning(String code, String message) {

    public static final String SOURCE_URL_DUPLICATE_SUSPECTED = "SOURCE_URL_DUPLICATE_SUSPECTED";

    public static Warning sourceUrlDuplicateSuspected() {
        return new Warning(SOURCE_URL_DUPLICATE_SUSPECTED, "该来源链接已有相关面经，请确认是否为同一份内容");
    }
}
