package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class SgguResponseParser {

    private static final Pattern FENCED_JSON = Pattern.compile("```(?:json)?\\s*([\\s\\S]*?)\\s*```", Pattern.CASE_INSENSITIVE);
    private static final List<String> REQUIRED_FIELDS = List.of("Mood", "Diagnosis", "Recommendation", "NextAction", "DisplayText");
    private static final int MAX_FIELD_CHARS = 500;

    private final ObjectMapper objectMapper;

    public SgguResponseParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public SgguConsultationResponse parse(SgguConsultationMode mode, String rawText) {
        JsonNode root = parseJson(extractJson(rawText));

        for (String field : REQUIRED_FIELDS) {
            if (text(root, field).isBlank()) {
                throw new InvalidSgguResponseException("Sggu response is missing required field: " + field);
            }
        }

        return new SgguConsultationResponse(
            mode,
            "llm",
            clamp(text(root, "Mood")),
            clamp(text(root, "Empathy")),
            clamp(text(root, "Diagnosis")),
            clamp(text(root, "Recommendation")),
            clamp(text(root, "Caution")),
            clamp(text(root, "NextAction")),
            clamp(text(root, "DisplayText"))
        );
    }

    private String extractJson(String rawText) {
        String value = String.valueOf(rawText == null ? "" : rawText).trim();
        Matcher matcher = FENCED_JSON.matcher(value);

        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        return value;
    }

    private JsonNode parseJson(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (JacksonException exception) {
            throw new InvalidSgguResponseException("Sggu response was not valid JSON.", exception);
        }
    }

    private String text(JsonNode node, String fieldName) {
        return coerceText(child(node, fieldName), fieldName).trim();
    }

    private String coerceText(JsonNode value, String fieldName) {
        if (value == null || value.isNull()) {
            return "";
        }

        if (value.isTextual()) {
            return value.asString();
        }

        if (value.isNumber() || value.isBoolean()) {
            return value.toString();
        }

        if (value.isArray()) {
            return arrayText(value, fieldName);
        }

        throw unsupportedFieldType(fieldName);
    }

    private String arrayText(JsonNode value, String fieldName) {
        List<String> items = new ArrayList<>();

        for (JsonNode item : value) {
            if (item == null || item.isNull()) {
                continue;
            }

            if (item.isArray() || item.isObject()) {
                throw unsupportedFieldType(fieldName);
            }

            String text = coerceText(item, fieldName).trim();

            if (!text.isBlank()) {
                items.add(text);
            }
        }

        return String.join(" ", items);
    }

    private InvalidSgguResponseException unsupportedFieldType(String fieldName) {
        return new InvalidSgguResponseException("Sggu response field has unsupported type: " + fieldName);
    }

    private String clamp(String value) {
        String normalized = String.valueOf(value == null ? "" : value).replaceAll("\\s+", " ").trim();
        return normalized.length() <= MAX_FIELD_CHARS ? normalized : normalized.substring(0, MAX_FIELD_CHARS).trim();
    }

    public static class InvalidSgguResponseException extends RuntimeException {

        public InvalidSgguResponseException(String message) {
            super(message);
        }

        public InvalidSgguResponseException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
