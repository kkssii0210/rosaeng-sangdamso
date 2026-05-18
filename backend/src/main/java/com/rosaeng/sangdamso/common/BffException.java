package com.rosaeng.sangdamso.common;

import org.springframework.http.HttpStatus;

public class BffException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final String userMessage;

    public BffException(HttpStatus status, String code, String userMessage) {
        super(userMessage);
        this.status = status;
        this.code = code;
        this.userMessage = userMessage;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public String userMessage() {
        return userMessage;
    }
}
