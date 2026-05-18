package com.rosaeng.sangdamso.lostark;

import java.util.Optional;
import org.springframework.http.HttpMethod;
import tools.jackson.databind.JsonNode;

public class LostarkApiClient {

    private final LostarkProperties properties;
    private final RequestExecutor requestExecutor;

    public LostarkApiClient(LostarkProperties properties, RequestExecutor requestExecutor) {
        this.properties = properties;
        this.requestExecutor = requestExecutor;
    }

    public JsonNode get(String path) {
        Optional<String> authorization = properties.authorization();

        if (authorization.isEmpty()) {
            throw new LostarkApiException(LostarkApiErrorCode.AUTH_ERROR, null, "Missing Lostark API authorization.");
        }

        LostarkApiException lastException = null;

        for (int attempt = 0; attempt <= properties.retryCount(); attempt++) {
            try {
                return requestExecutor.execute(HttpMethod.GET, path, authorization.get());
            } catch (LostarkApiException exception) {
                lastException = exception;

                if (attempt >= properties.retryCount() || !isRetryable(exception.getCode())) {
                    throw exception;
                }
            }
        }

        throw lastException;
    }

    private boolean isRetryable(LostarkApiErrorCode code) {
        return code == LostarkApiErrorCode.RATE_LIMITED
            || code == LostarkApiErrorCode.UPSTREAM_ERROR
            || code == LostarkApiErrorCode.TIMEOUT
            || code == LostarkApiErrorCode.NETWORK_ERROR;
    }

    @FunctionalInterface
    public interface RequestExecutor {
        JsonNode execute(HttpMethod method, String path, String authorization);
    }
}
