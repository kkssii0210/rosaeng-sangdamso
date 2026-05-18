package com.rosaeng.sangdamso.lostark;

import java.util.Optional;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "lostark")
public record LostarkProperties(
    String apiKey,
    String openApiKey,
    String baseUrl,
    int timeoutSeconds,
    int retryCount
) {

    public LostarkProperties {
        baseUrl = (baseUrl == null || baseUrl.isBlank()) ? "https://developer-lostark.game.onstove.com" : baseUrl;
        timeoutSeconds = timeoutSeconds <= 0 ? 5 : timeoutSeconds;
        retryCount = retryCount < 0 ? 1 : retryCount;
    }

    public Optional<String> authorization() {
        String token = hasText(apiKey) ? apiKey : openApiKey;

        if (!hasText(token)) {
            return Optional.empty();
        }

        String normalizedToken = token.trim();

        if (normalizedToken.toLowerCase().startsWith("bearer ")) {
            return Optional.of(normalizedToken);
        }

        return Optional.of("bearer " + normalizedToken);
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
