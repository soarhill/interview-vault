package com.interviewvault.common.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import com.interviewvault.common.response.Result;

import jakarta.validation.ConstraintViolationException;

/**
 * 错误响应只回传稳定、服务端可控的文案：
 * - 参数校验（ConstraintViolation / HandlerMethodValidation）的 message 来自本仓注解，可回传；
 * - 框架解析类异常（JSON 不可读、类型不匹配等）的 message 含类名、属性名或被拒绝值，
 *   不进响应体，只写日志。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BizException.class)
    public ResponseEntity<Result<Void>> apiException(BizException e) {
        return ResponseEntity.status(e.getStatus()).body(Result.error(e.getCode(), e.getMessage()));
    }

    /** 本仓声明的参数约束（@Min/@Max/@Size 等）——消息稳定，可回传给调用方。 */
    @ExceptionHandler({ConstraintViolationException.class, HandlerMethodValidationException.class})
    public ResponseEntity<Result<Void>> constraintViolation(Exception e) {
        log.debug("请求参数校验未通过: {}", e.getMessage());
        return ResponseEntity.badRequest()
                .body(Result.error("VALIDATION_ERROR", "请求参数非法：" + e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Void>> invalidBody(MethodArgumentNotValidException e) {
        return ResponseEntity.badRequest().body(Result.error("VALIDATION_ERROR", "请求参数非法"));
    }

    /** 框架解析失败——细节只进日志，响应是稳定文案。 */
    @ExceptionHandler({MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Result<Void>> badRequest(Exception e) {
        log.warn("请求参数解析失败: {}", e.getMessage());
        return ResponseEntity.badRequest()
                .body(Result.error("VALIDATION_ERROR", "请求参数非法"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> unexpected(Exception e) {
        log.error("未处理异常", e);
        return ResponseEntity.internalServerError()
                .body(Result.error("INTERNAL_ERROR", "服务内部错误"));
    }
}
