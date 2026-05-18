package com.rosaeng.sangdamso.lostark;

public class LostarkApiException extends RuntimeException {

    private final LostarkApiErrorCode code;
    private final Integer status;

    public LostarkApiException(LostarkApiErrorCode code, Integer status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public LostarkApiException(LostarkApiErrorCode code, Integer status, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.status = status;
    }

    public LostarkApiErrorCode getCode() {
        return code;
    }

    public Integer getStatus() {
        return status;
    }
}
