package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.bool;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.decimal;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import tools.jackson.databind.JsonNode;

public class AvatarStatsService {

    public JsonNode build(JsonNode avatars) {
        Map<String, Double> appliedTotals = new LinkedHashMap<>();
        int appliedAvatarCount = 0;
        int ignoredStatEffectCount = 0;

        for (JsonNode avatar : arrayItems(avatars)) {
            List<JsonNode> statEffects = arrayItems(child(avatar, "StatEffects"));

            if (statEffects.isEmpty()) {
                continue;
            }

            if (!isAvatarStatApplied(avatar)) {
                ignoredStatEffectCount += statEffects.size();
                continue;
            }

            appliedAvatarCount += 1;

            for (JsonNode effect : statEffects) {
                String stat = text(effect, "Stat");
                Double value = decimal(effect, "Value");

                if (stat.isBlank() || value == null) {
                    continue;
                }

                appliedTotals.put(stat, appliedTotals.getOrDefault(stat, 0.0) + value);
            }
        }

        List<Map<String, Object>> statBonuses = new ArrayList<>();

        for (Map.Entry<String, Double> entry : appliedTotals.entrySet()) {
            statBonuses.add(orderedMap(
                "Stat", entry.getKey(),
                "Value", entry.getValue(),
                "Text", entry.getKey() + " +" + formatAvatarStatPercent(entry.getValue())
            ));
        }

        return toJsonNode(orderedMap(
            "AppliedAvatarCount", appliedAvatarCount,
            "IgnoredStatEffectCount", ignoredStatEffectCount,
            "StatBonuses", statBonuses
        ));
    }

    public String formatAvatarStatPercent(double value) {
        return String.format(Locale.US, "%.2f%%", value);
    }

    public boolean isAvatarStatApplied(JsonNode avatar) {
        Boolean isStatApplied = firstBoolean(
            bool(avatar, "IsStatApplied"),
            bool(avatar, "isStatApplied"),
            bool(avatar, "IsInner"),
            bool(avatar, "isInner")
        );

        return Boolean.TRUE.equals(isStatApplied);
    }

    private Boolean firstBoolean(Boolean... values) {
        for (Boolean value : values) {
            if (value != null) {
                return value;
            }
        }

        return false;
    }
}
