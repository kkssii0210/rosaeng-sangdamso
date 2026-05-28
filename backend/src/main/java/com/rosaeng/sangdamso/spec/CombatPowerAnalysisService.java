package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseDouble;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

public class CombatPowerAnalysisService {

    public JsonNode build(Map<String, JsonNode> context) {
        JsonNode profile = context.get("profile");
        JsonNode paradiseOrb = context.get("paradiseOrb");
        JsonNode criticalStats = context.get("criticalStats");
        Double officialCombatPower = parseNumber(text(profile, "CombatPower"));
        Map<String, Object> paradisePower = paradisePower(paradiseOrb);
        List<Map<String, Object>> categorySummary = categorySummary(criticalStats);
        List<String> missingInputs = new ArrayList<>();

        if (officialCombatPower == null) {
            missingInputs.add("프로필 전투력");
        }

        return toJsonNode(orderedMap(
            "Status", officialCombatPower == null ? "unavailable" : "partial",
            "OfficialCombatPower", officialCombatPower,
            "Formula", orderedMap(
                "Estimate", officialCombatPower,
                "DeltaFromOfficialPercent", officialCombatPower == null ? null : 0,
                "CalibrationRatio", officialCombatPower == null ? null : 1
            ),
            "AttackBreakdown", orderedMap(
                "BasicAttackPower", 0,
                "BasicAttackPercent", 0,
                "BaseAttackBeforeBasicPercent", 0,
                "BaseAttackSource", "missing"
            ),
            "ParadisePower", paradisePower,
            "CategorySummary", categorySummary,
            "MissingInputs", missingInputs
        ));
    }

    private Map<String, Object> paradisePower(JsonNode paradiseOrb) {
        JsonNode source = child(paradiseOrb, "MaxParadisePower");

        if (source == null || source.isNull()) {
            return null;
        }

        return orderedMap(
            "Value", parseNumber(text(source, "Value")),
            "Text", text(source, "Text"),
            "EffectName", text(paradiseOrb, "EffectName"),
            "EffectRole", text(paradiseOrb, "EffectRole"),
            "SourceName", text(paradiseOrb, "Name").isBlank() ? "보주" : text(paradiseOrb, "Name")
        );
    }

    private List<Map<String, Object>> categorySummary(JsonNode criticalStats) {
        if (criticalStats == null || criticalStats.isNull()) {
            return List.of();
        }

        Double critRate = parseNumber(text(criticalStats, "GlobalCriticalRatePercent"));
        Double evolutionDamage = parseNumber(text(criticalStats, "EvolutionDamagePercent"));
        double percent = (critRate == null ? 0 : critRate) + (evolutionDamage == null ? 0 : evolutionDamage);

        if (percent == 0) {
            return List.of();
        }

        return List.of(orderedMap("Category", "criticalStats", "Percent", round(percent)));
    }

    private Double parseNumber(String value) {
        return parseDouble(value == null ? null : value.replace(",", ""));
    }

    private double round(double value) {
        return Math.round((value + 1e-12) * 100) / 100.0;
    }
}
