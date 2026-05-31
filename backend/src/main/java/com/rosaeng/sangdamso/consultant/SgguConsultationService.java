package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class SgguConsultationService {

    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;
    private static final int MAX_CACHE_ENTRIES = 128;
    private static final Set<String> SAFE_ROLES = Set.of("user", "assistant", "system");

    private final SgguPromptBuilder promptBuilder;
    private final LocalLlmClient localLlmClient;
    private final SgguResponseParser responseParser;
    private final SgguFallbackComposer fallbackComposer;
    private final Map<String, CachedConsultation> cache = new ConcurrentHashMap<>();

    public SgguConsultationService(
        SgguPromptBuilder promptBuilder,
        LocalLlmClient localLlmClient,
        SgguResponseParser responseParser,
        SgguFallbackComposer fallbackComposer
    ) {
        this.promptBuilder = promptBuilder;
        this.localLlmClient = localLlmClient;
        this.responseParser = responseParser;
        this.fallbackComposer = fallbackComposer;
    }

    public SgguConsultationResponse consult(
        SgguConsultationMode mode,
        String message,
        List<Map<String, String>> conversation,
        JsonNode context
    ) {
        SgguConsultationMode safeMode = mode == null ? SgguConsultationMode.MAIN_CHAT : mode;
        String cacheKey = cacheKey(safeMode, message, conversation, context);
        long now = Instant.now().toEpochMilli();
        CachedConsultation cached = cache.get(cacheKey);

        if (cached != null && cached.expiresAtEpochMs() > now) {
            return cached.response();
        }

        try {
            List<Map<String, String>> messages = promptBuilder.build(safeMode, message, conversation, context);
            LocalLlmClient.Completion completion = localLlmClient.createChatCompletion(messages);
            SgguConsultationResponse response = responseParser.parse(safeMode, completion.text());

            if (!isGrounded(safeMode, context, response)) {
                return fallbackComposer.compose(safeMode, message, context);
            }

            cleanupCache(now);
            cache.put(cacheKey, new CachedConsultation(response, now + CACHE_TTL_MS));
            return response;
        } catch (LocalLlmClient.LocalLlmException | SgguResponseParser.InvalidSgguResponseException exception) {
            return fallbackComposer.compose(safeMode, message, context);
        }
    }

    private boolean isGrounded(SgguConsultationMode mode, JsonNode context, SgguConsultationResponse response) {
        if (mode != SgguConsultationMode.EFFICIENCY_SUMMARY) {
            return true;
        }

        JsonNode topCandidate = arrayItems(child(context, "topSpecUps")).stream().findFirst().orElse(null);
        String label = text(topCandidate, "label");

        if (label.isBlank()) {
            return true;
        }

        String responseText = String.join(" ",
            response.recommendation(),
            response.displayText()
        );

        return responseText.contains(label);
    }

    private void cleanupCache(long now) {
        cache.entrySet().removeIf(entry -> entry.getValue().expiresAtEpochMs() <= now);

        if (cache.size() >= MAX_CACHE_ENTRIES) {
            cache.clear();
        }
    }

    private String cacheKey(
        SgguConsultationMode mode,
        String message,
        List<Map<String, String>> conversation,
        JsonNode context
    ) {
        return mode.wireValue()
            + "|" + normalize(message)
            + "|" + sha256(normalizedConversation(conversation))
            + "|" + sha256(context == null ? "{}" : context.toString());
    }

    private String normalizedConversation(List<Map<String, String>> conversation) {
        if (conversation == null || conversation.isEmpty()) {
            return "";
        }

        StringBuilder builder = new StringBuilder();

        for (Map<String, String> entry : conversation) {
            if (!isSafeConversationEntry(entry)) {
                continue;
            }

            builder.append(normalize(entry.get("role")))
                .append('\u001f')
                .append(normalize(entry.get("content")))
                .append('\u001e');
        }

        return builder.toString();
    }

    private boolean isSafeConversationEntry(Map<String, String> entry) {
        if (entry == null) {
            return false;
        }

        String role = entry.get("role");
        String content = entry.get("content");

        return SAFE_ROLES.contains(role) && content != null && !content.trim().isEmpty();
    }

    private String normalize(String value) {
        return String.valueOf(value == null ? "" : value).replaceAll("\\s+", " ").trim();
    }

    private String text(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);
        return value == null || value.isNull() ? "" : value.asString().trim();
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }

    private record CachedConsultation(SgguConsultationResponse response, long expiresAtEpochMs) {
    }
}
