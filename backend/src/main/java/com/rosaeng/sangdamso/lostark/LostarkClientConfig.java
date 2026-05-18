package com.rosaeng.sangdamso.lostark;

import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Configuration
public class LostarkClientConfig {

    @Bean
    RestClient lostarkRestClient(LostarkProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(properties.timeoutSeconds()));
        requestFactory.setReadTimeout(Duration.ofSeconds(properties.timeoutSeconds()));

        return RestClient.builder()
            .baseUrl(properties.baseUrl())
            .requestFactory(requestFactory)
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .build();
    }

    @Bean
    LostarkApiClient lostarkApiClient(LostarkProperties properties, RestClient lostarkRestClient, ObjectMapper objectMapper) {
        return new LostarkApiClient(properties, (method, path, authorization) -> execute(lostarkRestClient, objectMapper, method, path, authorization));
    }

    private JsonNode execute(RestClient restClient, ObjectMapper objectMapper, HttpMethod method, String path, String authorization) {
        try {
            return restClient
                .method(method)
                .uri(path)
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .exchange((request, response) -> {
                    String responseBody = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);

                    if (response.getStatusCode().is2xxSuccessful()) {
                        return objectMapper.readTree(responseBody);
                    }

                    throw new LostarkApiException(
                        codeForStatus(response.getStatusCode().value()),
                        response.getStatusCode().value(),
                        "Lostark Open API " + response.getStatusCode().value() + ": " + responseBody
                    );
                });
        } catch (LostarkApiException exception) {
            throw exception;
        } catch (ResourceAccessException exception) {
            throw new LostarkApiException(errorCodeForResourceAccess(exception), null, "Lostark Open API request failed.", exception);
        } catch (JacksonException exception) {
            throw new LostarkApiException(LostarkApiErrorCode.NETWORK_ERROR, null, "Failed to read Lostark Open API response.", exception);
        }
    }

    private LostarkApiErrorCode codeForStatus(int status) {
        if (status == 400) {
            return LostarkApiErrorCode.BAD_REQUEST;
        }

        if (status == 401 || status == 403) {
            return LostarkApiErrorCode.AUTH_ERROR;
        }

        if (status == 404) {
            return LostarkApiErrorCode.NOT_FOUND;
        }

        if (status == 429) {
            return LostarkApiErrorCode.RATE_LIMITED;
        }

        return LostarkApiErrorCode.UPSTREAM_ERROR;
    }

    private LostarkApiErrorCode errorCodeForResourceAccess(ResourceAccessException exception) {
        Throwable cause = exception.getCause();

        while (cause != null) {
            if (cause instanceof SocketTimeoutException) {
                return LostarkApiErrorCode.TIMEOUT;
            }

            cause = cause.getCause();
        }

        return LostarkApiErrorCode.NETWORK_ERROR;
    }
}
