package com.rosaeng.sangdamso.common;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BffException.class)
    public ResponseEntity<ApiErrorResponse> handleBffException(BffException exception) {
        return ResponseEntity
            .status(exception.status())
            .body(new ApiErrorResponse(exception.code(), exception.userMessage()));
    }
}
