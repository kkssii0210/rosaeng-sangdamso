package com.rosaeng.sangdamso.lostark;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class LostarkApiClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void notFoundDoesNotRetry() {
        AtomicInteger calls = new AtomicInteger();
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            calls.incrementAndGet();
            throw new LostarkApiException(LostarkApiErrorCode.NOT_FOUND, 404, "missing");
        });

        assertThatThrownBy(() -> client.get("/missing"))
            .isInstanceOf(LostarkApiException.class)
            .extracting("code")
            .isEqualTo(LostarkApiErrorCode.NOT_FOUND);
        assertThat(calls).hasValue(1);
    }

    @Test
    void upstreamErrorRetriesOnceAndCanSucceed() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        JsonNode success = objectMapper.createObjectNode().put("ok", true);
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            if (calls.incrementAndGet() == 1) {
                throw new LostarkApiException(LostarkApiErrorCode.UPSTREAM_ERROR, 500, "temporary");
            }

            return success;
        });

        JsonNode result = client.get("/unstable");

        assertThat(result.get("ok").asBoolean()).isTrue();
        assertThat(calls).hasValue(2);
    }

    @Test
    void rateLimitRetriesOnceAndCanSucceed() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        JsonNode success = objectMapper.createObjectNode().put("ok", true);
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            if (calls.incrementAndGet() == 1) {
                throw new LostarkApiException(LostarkApiErrorCode.RATE_LIMITED, 429, "rate limited");
            }

            return success;
        });

        JsonNode result = client.get("/rate-limited");

        assertThat(result.get("ok").asBoolean()).isTrue();
        assertThat(calls).hasValue(2);
    }

    @Test
    void retryableFailureWaitsBeforeRetrying() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        List<String> retryDelays = new ArrayList<>();
        JsonNode success = objectMapper.createObjectNode().put("ok", true);
        LostarkApiClient client = clientWithExecutorAndRetryDelay((method, path, authorization) -> {
            if (calls.incrementAndGet() == 1) {
                throw new LostarkApiException(LostarkApiErrorCode.RATE_LIMITED, 429, "rate limited");
            }

            return success;
        }, (retryAttempt, exception) -> retryDelays.add(retryAttempt + ":" + exception.getCode()));

        JsonNode result = client.get("/rate-limited");

        assertThat(result.get("ok").asBoolean()).isTrue();
        assertThat(calls).hasValue(2);
        assertThat(retryDelays).containsExactly("1:RATE_LIMITED");
    }

    @Test
    void timeoutRetriesAndThenThrowsTimeout() {
        AtomicInteger calls = new AtomicInteger();
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            calls.incrementAndGet();
            throw new LostarkApiException(LostarkApiErrorCode.TIMEOUT, null, "timeout");
        });

        assertThatThrownBy(() -> client.get("/slow"))
            .isInstanceOf(LostarkApiException.class)
            .extracting("code")
            .isEqualTo(LostarkApiErrorCode.TIMEOUT);
        assertThat(calls).hasValue(2);
    }

    @Test
    void networkFailureRetriesAndThenThrowsNetworkError() {
        AtomicInteger calls = new AtomicInteger();
        LostarkApiClient client = clientWithExecutor((method, path, authorization) -> {
            calls.incrementAndGet();
            throw new LostarkApiException(LostarkApiErrorCode.NETWORK_ERROR, null, "network");
        });

        assertThatThrownBy(() -> client.get("/network"))
            .isInstanceOf(LostarkApiException.class)
            .extracting("code")
            .isEqualTo(LostarkApiErrorCode.NETWORK_ERROR);
        assertThat(calls).hasValue(2);
    }

    private LostarkApiClient clientWithExecutor(LostarkApiClient.RequestExecutor executor) {
        LostarkProperties properties = new LostarkProperties("token", "", "https://example.com", 5, 1);
        return new LostarkApiClient(properties, executor, (retryAttempt, exception) -> {
        });
    }

    private LostarkApiClient clientWithExecutorAndRetryDelay(
        LostarkApiClient.RequestExecutor executor,
        LostarkApiClient.RetryDelay retryDelay
    ) {
        LostarkProperties properties = new LostarkProperties("token", "", "https://example.com", 5, 1);
        return new LostarkApiClient(properties, executor, retryDelay);
    }
}
