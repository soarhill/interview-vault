package com.interviewvault.common.exception;

import org.springframework.http.HttpStatus;

/** 业务异常：携带契约错误码与 HTTP 状态，由 GlobalExceptionHandler 统一输出 Result。 */
public class BizException extends RuntimeException {

    private final String code;
    private final HttpStatus status;

    public BizException(String code, HttpStatus status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public static BizException validation(String message) {
        return new BizException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, message);
    }

    public static BizException interviewNotFound() {
        return new BizException("INTERVIEW_NOT_FOUND", HttpStatus.NOT_FOUND, "面经不存在");
    }

    /** 已发布内容经删除申请批准后下架：协议同为 404，错误码与文案区别于不存在。 */
    public static BizException interviewRemoved() {
        return new BizException("INTERVIEW_REMOVED", HttpStatus.NOT_FOUND, "该面经已下架");
    }

    public static BizException interviewNotOwner() {
        return new BizException("INTERVIEW_NOT_OWNER", HttpStatus.FORBIDDEN, "只能操作自己的投稿");
    }

    public static BizException interviewIncomplete(String message) {
        return new BizException("INTERVIEW_INCOMPLETE", HttpStatus.BAD_REQUEST, message);
    }

    public static BizException interviewStatusConflict() {
        return new BizException("INTERVIEW_STATUS_CONFLICT", HttpStatus.CONFLICT,
                "当前面经状态已发生变化，请刷新后重试");
    }

    public static BizException interviewVersionConflict() {
        return new BizException("INTERVIEW_VERSION_CONFLICT", HttpStatus.CONFLICT,
                "内容已被他人修改，请刷新后重试");
    }

    public static BizException catalogNotFound(String kind, long id) {
        return new BizException(kind + "_NOT_FOUND", HttpStatus.NOT_FOUND, kind + " 不存在: " + id);
    }

    public String getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
