package com.rosaeng.sangdamso.character.avatar;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.bool;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.extractDetailSections;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseDouble;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseTooltip;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

public class AvatarNormalizer {

    private static final Pattern AVATAR_STAT_PATTERN = Pattern.compile("^(?<stat>힘|민첩|지능)\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%");

    public JsonNode normalize(JsonNode payload) {
        return toJsonNode(arrayItems(payload).stream()
            .map(this::normalizeAvatarItem)
            .toList());
    }

    private Map<String, Object> normalizeAvatarItem(JsonNode item) {
        JsonNode tooltip = parseTooltip(text(item, "Tooltip"));
        List<Map<String, Object>> detailSections = extractDetailSections(tooltip);
        JsonNode avatarAttribute = child(tooltip, "AvatarAttribute");
        boolean isInner = valueOf(item, "IsInner", "isInner", bool(avatarAttribute, "IsInner"));
        boolean isSet = valueOf(item, "IsSet", "isSet", bool(avatarAttribute, "IsSet"));
        List<Map<String, Object>> statEffects = detailSections.stream()
            .flatMap(section -> lines(section).stream())
            .map(this::parseAvatarStatEffect)
            .filter(effect -> effect != null)
            .toList();

        return orderedMap(
            "Type", text(item, "Type"),
            "Name", text(item, "Name"),
            "Icon", text(item, "Icon"),
            "Grade", text(item, "Grade"),
            "IsSet", isSet,
            "IsInner", isInner,
            "IsStatApplied", isInner,
            "DetailSections", detailSections,
            "StatEffects", statEffects
        );
    }

    private Map<String, Object> parseAvatarStatEffect(String line) {
        Matcher match = AVATAR_STAT_PATTERN.matcher(line == null ? "" : line);

        if (!match.find()) {
            return null;
        }

        Double value = parseDouble(match.group("value"));

        if (value == null) {
            return null;
        }

        return orderedMap(
            "Stat", match.group("stat"),
            "Value", value,
            "Text", line.trim()
        );
    }

    private boolean valueOf(JsonNode item, String upperKey, String lowerKey, Boolean fallback) {
        Boolean upperValue = bool(item, upperKey);

        if (upperValue != null) {
            return upperValue;
        }

        Boolean lowerValue = bool(item, lowerKey);

        if (lowerValue != null) {
            return lowerValue;
        }

        return Boolean.TRUE.equals(fallback);
    }

    @SuppressWarnings("unchecked")
    private List<String> lines(Map<String, Object> section) {
        return (List<String>) section.get("lines");
    }
}
