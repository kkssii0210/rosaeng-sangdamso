package com.rosaeng.sangdamso.spec;

import tools.jackson.databind.JsonNode;

public final class DamageModel {

    private DamageModel() {
    }

    public static double toRatio(double percent) {
        return percent / 100.0;
    }

    public static double toPercent(double ratio) {
        return ratio * 100.0;
    }

    public static double roundPercent(double value) {
        if (!Double.isFinite(value)) {
            return 0;
        }

        return Math.round((value + Math.ulp(1.0)) * 100.0) / 100.0;
    }

    public static CriticalRateLimit criticalRateLimitFromStats(JsonNode criticalStats) {
        JsonNode limit = child(criticalStats, "CriticalRateLimit", "criticalRateLimit");

        if (limit == null || limit.isNull() || !booleanValue(limit, false, "IsActive", "isActive")) {
            return new CriticalRateLimit(false, "", 100, 0, 0);
        }

        return new CriticalRateLimit(
            true,
            textValue(limit, "", "SourceName", "sourceName"),
            numberValue(limit, 100, "CapPercent", "capPercent"),
            numberValue(limit, 0, "OverflowConversionRatePercent", "overflowConversionRatePercent"),
            numberValue(limit, 0, "MaxConvertedEvolutionDamagePercent", "maxConvertedEvolutionDamagePercent")
        );
    }

    public static double effectiveCriticalRatePercent(double critRatePercent, CriticalRateLimit criticalRateLimit) {
        return Math.max(0, Math.min(critRatePercent, criticalRateLimit.capPercent()));
    }

    public static double convertedEvolutionDamagePercent(double critRatePercent, CriticalRateLimit criticalRateLimit) {
        if (!criticalRateLimit.isActive()) {
            return 0;
        }

        double overflowPercent = Math.max(0, critRatePercent - criticalRateLimit.capPercent());
        double convertedPercent = overflowPercent * criticalRateLimit.overflowConversionRatePercent() / 100.0;

        return Math.min(convertedPercent, criticalRateLimit.maxConvertedEvolutionDamagePercent());
    }

    public static double totalEvolutionDamagePercent(
        double fixedEvolutionDamagePercent,
        double critRatePercent,
        CriticalRateLimit criticalRateLimit
    ) {
        return fixedEvolutionDamagePercent + convertedEvolutionDamagePercent(critRatePercent, criticalRateLimit);
    }

    public static double evolutionDamageMultiplier(
        double fixedEvolutionDamagePercent,
        double currentCritRatePercent,
        double baseCritRatePercent,
        CriticalRateLimit criticalRateLimit
    ) {
        double currentEvolutionDamage = totalEvolutionDamagePercent(
            fixedEvolutionDamagePercent,
            currentCritRatePercent,
            criticalRateLimit
        );
        double baseEvolutionDamage = totalEvolutionDamagePercent(
            fixedEvolutionDamagePercent,
            baseCritRatePercent,
            criticalRateLimit
        );

        return (1 + toRatio(currentEvolutionDamage)) / (1 + toRatio(baseEvolutionDamage));
    }

    public static double criticalAverageMultiplier(
        double critRatePercent,
        double critDamageBonusPercent,
        double criticalOutgoingDamagePercent,
        CriticalRateLimit criticalRateLimit
    ) {
        double effectiveCritRate = toRatio(effectiveCriticalRatePercent(critRatePercent, criticalRateLimit));
        double criticalHitMultiplier = (2 + toRatio(Math.max(0, critDamageBonusPercent)))
            * (1 + toRatio(Math.max(0, criticalOutgoingDamagePercent)));

        return 1 + effectiveCritRate * (criticalHitMultiplier - 1);
    }

    private static JsonNode child(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = node.get(key);

            if (value != null && !value.isNull() && !(value.isTextual() && value.asString().isEmpty())) {
                return value;
            }
        }

        return null;
    }

    private static String textValue(JsonNode node, String fallback, String... keys) {
        JsonNode value = child(node, keys);
        return value == null ? fallback : value.asString();
    }

    private static double numberValue(JsonNode node, double fallback, String... keys) {
        JsonNode value = child(node, keys);

        if (value == null || value.isNull()) {
            return fallback;
        }

        if (value.isNumber()) {
            return value.asDouble();
        }

        try {
            return Double.parseDouble(value.asString().replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private static boolean booleanValue(JsonNode node, boolean fallback, String... keys) {
        JsonNode value = child(node, keys);

        if (value == null || value.isNull()) {
            return fallback;
        }

        if (value.isBoolean()) {
            return value.asBoolean();
        }

        return Boolean.parseBoolean(value.asString());
    }

    public record CriticalRateLimit(
        boolean isActive,
        String sourceName,
        double capPercent,
        double overflowConversionRatePercent,
        double maxConvertedEvolutionDamagePercent
    ) {
    }
}
