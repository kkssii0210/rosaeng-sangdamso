package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class OllamaLocalLlmClient implements LocalLlmClient {

    private static final String DEFAULT_BASE_URL = "http://localhost:11434";
    private static final String DEFAULT_MODEL = "qwen2.5:7b";
    private static final String UNAVAILABLE_MESSAGE = "로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘.";

    private final Environment environment;
    private final ObjectMapper objectMapper;

    public OllamaLocalLlmClient(Environment environment, ObjectMapper objectMapper) {
        this.environment = environment;
        this.objectMapper = objectMapper;
    }

    @Override
    public Completion createChatCompletion(List<Map<String, String>> messages) {
        String provider = property("LOCAL_LLM_PROVIDER", "local.llm.provider", "ollama").trim();

        if (!"ollama".equals(provider)) {
            throw new LocalLlmException("UNSUPPORTED_LOCAL_LLM_PROVIDER", "Unsupported local LLM provider: " + provider);
        }

        String baseUrl = normalizeBaseUrl(property("LOCAL_LLM_BASE_URL", "local.llm.base-url", DEFAULT_BASE_URL));
        String model = property("LOCAL_LLM_MODEL", "local.llm.model", DEFAULT_MODEL);
        int timeoutMs = timeoutMs(property("LOCAL_LLM_TIMEOUT_MS", "local.llm.timeout-ms", "30000"));
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(timeoutMs));
        requestFactory.setReadTimeout(Duration.ofMillis(timeoutMs));
        RestClient restClient = RestClient.builder()
            .baseUrl(baseUrl)
            .requestFactory(requestFactory)
            .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
            .build();

        try {
            JsonNode payload = restClient.post()
                .uri("/api/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .body(orderedMap(
                    "model", model,
                    "messages", messages == null ? List.of() : messages,
                    "stream", false,
                    "options", orderedMap("temperature", 0.2, "num_predict", 700)
                ))
                .exchange((request, response) -> {
                    String responseBody = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8);

                    if (!response.getStatusCode().is2xxSuccessful()) {
                        throw new LocalLlmException(
                            "LOCAL_LLM_REQUEST_FAILED",
                            responseBody.isBlank()
                                ? "Local LLM request failed with status " + response.getStatusCode().value()
                                : responseBody
                        );
                    }

                    return objectMapper.readTree(responseBody);
                });
            String text = extractText(payload);

            if (text.isBlank()) {
                throw new LocalLlmException("LOCAL_LLM_MALFORMED_RESPONSE", "Local LLM response did not include assistant text");
            }

            return new Completion(text, provider, model, orderedMap(
                "promptTokens", numberOrNull(child(payload, "prompt_eval_count")),
                "outputTokens", numberOrNull(child(payload, "eval_count"))
            ));
        } catch (LocalLlmException exception) {
            throw exception;
        } catch (ResourceAccessException exception) {
            throw new LocalLlmException("LOCAL_LLM_UNAVAILABLE", UNAVAILABLE_MESSAGE, exception);
        } catch (JacksonException exception) {
            throw new LocalLlmException("LOCAL_LLM_MALFORMED_RESPONSE", "Local LLM response was not valid JSON.", exception);
        } catch (RuntimeException exception) {
            throw new LocalLlmException("LOCAL_LLM_UNAVAILABLE", UNAVAILABLE_MESSAGE, exception);
        }
    }

    private String extractText(JsonNode payload) {
        JsonNode messageContent = child(child(payload, "message"), "content");

        if (messageContent != null && !messageContent.isNull()) {
            return messageContent.asString();
        }

        JsonNode response = child(payload, "response");
        return response == null || response.isNull() ? "" : response.asString();
    }

    private Integer numberOrNull(JsonNode node) {
        return node == null || node.isNull() || !node.isNumber() ? null : node.asInt();
    }

    private String normalizeBaseUrl(String baseUrl) {
        String normalized = String.valueOf(baseUrl == null ? "" : baseUrl).trim().replaceAll("/+$", "");
        return normalized.isEmpty() ? DEFAULT_BASE_URL : normalized;
    }

    private int timeoutMs(String value) {
        try {
            int parsed = Integer.parseInt(String.valueOf(value).trim());
            return parsed > 0 ? parsed : 30000;
        } catch (NumberFormatException exception) {
            return 30000;
        }
    }

    private String property(String envName, String propertyName, String fallback) {
        String envValue = environment.getProperty(envName);

        if (envValue != null && !envValue.isBlank()) {
            return envValue;
        }

        return environment.getProperty(propertyName, fallback);
    }
}
