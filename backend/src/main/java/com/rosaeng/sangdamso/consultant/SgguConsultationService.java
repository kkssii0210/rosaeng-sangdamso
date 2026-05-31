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
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class SgguConsultationService {

    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;

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
        String cacheKey = cacheKey(safeMode, message, context);
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
            response.diagnosis(),
            response.recommendation(),
            response.nextAction(),
            response.displayText()
        );

        return responseText.contains(label);
    }

    private String cacheKey(SgguConsultationMode mode, String message, JsonNode context) {
        return mode.wireValue() + "|" + normalize(message) + "|" + sha256(context == null ? "{}" : context.toString());
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
