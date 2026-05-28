package com.rosaeng.sangdamso.lostark;

import java.util.Optional;
import org.springframework.http.HttpMethod;
import tools.jackson.databind.JsonNode;

public class LostarkApiClient {

    private final LostarkProperties properties;
    private final RequestExecutor requestExecutor;
    private final RetryDelay retryDelay;

    public LostarkApiClient(LostarkProperties properties, RequestExecutor requestExecutor) {
        this(properties, requestExecutor, LostarkApiClient::sleepBeforeRetry);
    }

    public LostarkApiClient(LostarkProperties properties, RequestExecutor requestExecutor, RetryDelay retryDelay) {
        this.properties = properties;
        this.requestExecutor = requestExecutor;
        this.retryDelay = retryDelay;
    }

    public JsonNode get(String path) {
        Optional<String> authorization = properties.authorization();

        if (authorization.isEmpty()) {
            throw new LostarkApiException(LostarkApiErrorCode.AUTH_ERROR, null, "Missing Lostark API authorization.");
        }

        for (int attempt = 0; attempt <= properties.retryCount(); attempt++) {
            try {
                return requestExecutor.execute(HttpMethod.GET, path, authorization.get());
            } catch (LostarkApiException exception) {
                if (attempt >= properties.retryCount() || !isRetryable(exception.getCode())) {
                    throw exception;
                }

                retryDelay.beforeRetry(attempt + 1, exception);
            }
        }

        throw new IllegalStateException("Lostark API retry loop exited unexpectedly.");
    }

    private static boolean isRetryable(LostarkApiErrorCode code) {
        return code == LostarkApiErrorCode.RATE_LIMITED
            || code == LostarkApiErrorCode.UPSTREAM_ERROR
            || code == LostarkApiErrorCode.TIMEOUT
            || code == LostarkApiErrorCode.NETWORK_ERROR;
    }

    private static void sleepBeforeRetry(int retryAttempt, LostarkApiException exception) {
        long delayMs = Math.min(1000L, 200L * (1L << Math.max(0, retryAttempt - 1)));

        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            throw new LostarkApiException(
                LostarkApiErrorCode.NETWORK_ERROR,
                null,
                "Interrupted while waiting to retry Lostark API request.",
                interruptedException
            );
        }
    }

    @FunctionalInterface
    public interface RequestExecutor {
        JsonNode execute(HttpMethod method, String path, String authorization);
    }

    @FunctionalInterface
    public interface RetryDelay {
        void beforeRetry(int retryAttempt, LostarkApiException exception);
    }
}
