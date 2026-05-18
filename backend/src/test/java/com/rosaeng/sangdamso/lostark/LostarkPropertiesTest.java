package com.rosaeng.sangdamso.lostark;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LostarkPropertiesTest {

    @Test
    void returnsEmptyAuthorizationWhenBothKeysAreBlank() {
        LostarkProperties properties = new LostarkProperties("", "   ", "https://example.com", 5, 1);

        assertThat(properties.authorization()).isEmpty();
    }

    @Test
    void prefersPrimaryApiKeyOverFallback() {
        LostarkProperties properties = new LostarkProperties("primary-token", "fallback-token", "https://example.com", 5, 1);

        assertThat(properties.authorization()).contains("bearer primary-token");
    }

    @Test
    void preservesExistingBearerPrefix() {
        LostarkProperties properties = new LostarkProperties("Bearer existing-token", "", "https://example.com", 5, 1);

        assertThat(properties.authorization()).contains("Bearer existing-token");
    }

    @Test
    void prefixesRawFallbackToken() {
        LostarkProperties properties = new LostarkProperties("", " raw-token ", "https://example.com", 5, 1);

        assertThat(properties.authorization()).contains("bearer raw-token");
    }
}
