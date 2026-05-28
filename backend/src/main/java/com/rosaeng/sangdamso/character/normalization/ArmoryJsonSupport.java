package com.rosaeng.sangdamso.character.normalization;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public final class ArmoryJsonSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Pattern BR_TAG_PATTERN = Pattern.compile("<br\\s*/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMG_TAG_PATTERN = Pattern.compile("<img[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]*>");
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");

    private ArmoryJsonSupport() {
    }

    public static JsonNode toJsonNode(Object value) {
        return OBJECT_MAPPER.convertValue(value, JsonNode.class);
    }

    public static JsonNode parseTooltip(String tooltip) {
        if (tooltip == null || tooltip.isBlank()) {
            return null;
        }

        try {
            return OBJECT_MAPPER.readTree(tooltip);
        } catch (JacksonException exception) {
            return null;
        }
    }

    public static String stripMarkup(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }

        String withoutMarkup = BR_TAG_PATTERN.matcher(value).replaceAll("\n");
        withoutMarkup = IMG_TAG_PATTERN.matcher(withoutMarkup).replaceAll("");
        withoutMarkup = HTML_TAG_PATTERN.matcher(withoutMarkup).replaceAll("");
        withoutMarkup = withoutMarkup
            .replace("&nbsp;", " ")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&amp;", "&");
        List<String> lines = new ArrayList<>();

        for (String line : withoutMarkup.split("\\n")) {
            String normalizedLine = WHITESPACE_PATTERN.matcher(line).replaceAll(" ").trim();

            if (!normalizedLine.isEmpty()) {
                lines.add(normalizedLine);
            }
        }

        return String.join("\n", lines);
    }

    public static List<String> splitTooltipLines(String value) {
        String stripped = stripMarkup(value);

        if (stripped.isEmpty()) {
            return List.of();
        }

        return List.of(stripped.split("\\n"));
    }

    public static List<Map<String, Object>> extractDetailSections(JsonNode tooltip) {
        if (!isObject(tooltip)) {
            return List.of();
        }

        List<Map<String, Object>> sections = new ArrayList<>();

        for (JsonNode element : objectValues(tooltip)) {
            if (!"ItemPartBox".equals(text(element, "type"))) {
                continue;
            }

            JsonNode value = child(element, "value");
            String title = stripMarkup(text(value, "Element_000"));
            List<String> lines = splitTooltipLines(text(value, "Element_001"));

            if (!title.isEmpty() && !lines.isEmpty()) {
                sections.add(orderedMap("title", title, "lines", new ArrayList<>(lines)));
            }
        }

        return sections;
    }

    public static List<JsonNode> arrayItems(JsonNode node) {
        if (!isArray(node)) {
            return List.of();
        }

        List<JsonNode> items = new ArrayList<>();

        for (JsonNode item : node) {
            items.add(item);
        }

        return items;
    }

    public static List<JsonNode> objectValues(JsonNode node) {
        if (!isObject(node)) {
            return List.of();
        }

        List<JsonNode> values = new ArrayList<>();

        for (String propertyName : node.propertyNames()) {
            values.add(node.get(propertyName));
        }

        return values;
    }

    public static JsonNode child(JsonNode node, String fieldName) {
        if (node == null || node.isNull()) {
            return null;
        }

        return node.get(fieldName);
    }

    public static String text(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);

        if (value == null || value.isNull()) {
            return "";
        }

        return value.asString();
    }

    public static Integer integer(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);

        if (value == null || value.isNull() || !value.isNumber()) {
            return null;
        }

        return value.asInt();
    }

    public static Double decimal(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);

        if (value == null || value.isNull() || !value.isNumber()) {
            return null;
        }

        return value.asDouble();
    }

    public static Boolean bool(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);

        if (value == null || value.isNull() || !value.isBoolean()) {
            return null;
        }

        return value.asBoolean();
    }

    public static boolean isArray(JsonNode node) {
        return node != null && node.isArray();
    }

    public static boolean isObject(JsonNode node) {
        return node != null && node.isObject();
    }

    public static Integer parseInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Integer.parseInt(value.replace(",", ""));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    public static Double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Double.parseDouble(value.replace(",", ""));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    public static Map<String, Object> orderedMap(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();

        for (int index = 0; index < keyValues.length; index += 2) {
            map.put(String.valueOf(keyValues[index]), keyValues[index + 1]);
        }

        return map;
    }
}
