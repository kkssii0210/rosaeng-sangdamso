package com.rosaeng.sangdamso.character.engraving;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.integer;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.isArray;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.stripMarkup;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

public class EngravingsNormalizer {

    private static final Pattern POSITIVE_PERCENT_PATTERN = Pattern.compile(
        "<FONT COLOR=['\"]#99ff99['\"]>([^<]*?%)[^<]*</FONT>",
        Pattern.CASE_INSENSITIVE
    );
    private static final Map<String, String> ENGRAVING_ICONS = Map.ofEntries(
        Map.entry("약자 무시", "https://lostarkcodex.com/icons/achieve_04_30.webp"),
        Map.entry("저주받은 인형", "https://lostarkcodex.com/icons/buff_237.webp")
    );

    public JsonNode normalize(JsonNode engravings) {
        JsonNode effects = firstArray(
            child(engravings, "ArkPassiveEffects"),
            child(engravings, "Effects"),
            child(engravings, "Engravings")
        );
        List<Map<String, Object>> normalized = arrayItems(effects).stream()
            .map(this::normalizeEngravingEffect)
            .filter(effect -> !String.valueOf(effect.get("Name")).isBlank())
            .toList();

        return toJsonNode(normalized);
    }

    private Map<String, Object> normalizeEngravingEffect(JsonNode effect) {
        List<String> metrics = extractPositivePercentages(text(effect, "Description"));

        return orderedMap(
            "Name", text(effect, "Name"),
            "Grade", text(effect, "Grade"),
            "Level", integer(effect, "Level"),
            "AbilityStoneLevel", integer(effect, "AbilityStoneLevel"),
            "Icon", ENGRAVING_ICONS.getOrDefault(text(effect, "Name"), ""),
            "Description", stripMarkup(text(effect, "Description")),
            "EfficiencyText", metrics.isEmpty() ? "" : metrics.get(0),
            "Metrics", metrics
        );
    }

    private List<String> extractPositivePercentages(String description) {
        Matcher matcher = POSITIVE_PERCENT_PATTERN.matcher(description == null ? "" : description);
        List<String> metrics = new ArrayList<>();

        while (matcher.find()) {
            String metric = stripMarkup(matcher.group(1));

            if (!metric.isBlank()) {
                metrics.add(metric);
            }
        }

        return metrics;
    }

    private JsonNode firstArray(JsonNode... candidates) {
        for (JsonNode candidate : candidates) {
            if (isArray(candidate)) {
                return candidate;
            }
        }

        return null;
    }
}
