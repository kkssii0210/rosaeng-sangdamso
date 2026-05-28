package com.rosaeng.sangdamso.market;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class RestMarketSnapshotClient implements MarketSnapshotClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public RestMarketSnapshotClient(RestClient lostarkRestClient, ObjectMapper objectMapper) {
        this.restClient = lostarkRestClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public JsonNode post(HttpMethod method, String path, String authorization, JsonNode body) {
        try {
            return restClient
                .method(method)
                .uri(path)
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .exchange((request, response) -> {
                    String responseBody = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);

                    if (!response.getStatusCode().is2xxSuccessful()) {
                        throw new IllegalStateException("Lostark Open API " + response.getStatusCode().value());
                    }

                    return objectMapper.readTree(responseBody);
                });
        } catch (JacksonException exception) {
            throw new IllegalStateException("Failed to read Lostark market response.", exception);
        }
    }
}
