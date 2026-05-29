package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class SpecUpRecommendationService {

    public JsonNode build(JsonNode accessoryRecommendation, JsonNode upgradeEfficiency, int limit) {
        List<Map<String, Object>> candidates = new ArrayList<>();

        arrayItems(child(accessoryRecommendation, "Comparisons")).stream()
            .map(this::normalizeAccessoryComparison)
            .filter(Objects::nonNull)
            .forEach(candidates::add);
        arrayItems(child(upgradeEfficiency, "Candidates")).stream()
            .map(this::normalizeUpgradeCandidate)
            .filter(Objects::nonNull)
            .forEach(candidates::add);
        candidates.sort(Comparator.comparingDouble(this::score).reversed());

        return toJsonNode(orderedMap(
            "Status", candidates.isEmpty() ? "noRecommendation" : "ready",
            "TopCandidates", candidates.stream().limit(limit).toList(),
            "AccessoryRecommendation", accessoryRecommendation,
            "UpgradeEfficiency", upgradeEfficiency,
            "MissingInputs", mergedMissingInputs(accessoryRecommendation, upgradeEfficiency)
        ));
    }

    private Map<String, Object> normalizeAccessoryComparison(JsonNode comparison) {
        Double buyPrice = numberValue(comparison, "BuyPrice", "buyPrice");
        Double gainPercent = numberValue(comparison, "CombatPowerGainPercent", "combatPowerGainPercent");

        if (buyPrice == null || buyPrice <= 0 || gainPercent == null || gainPercent <= 0) {
            return null;
        }

        int index = (int) Math.max(0, numberValue(comparison, "ReplacedEquipmentIndex", "replacedEquipmentIndex") == null
            ? 0
            : numberValue(comparison, "ReplacedEquipmentIndex", "replacedEquipmentIndex"));

        return orderedMap(
            "Id", "accessory-" + index,
            "Type", "accessory",
            "Label", accessoryLabel(comparison),
            "CostGold", Math.round(buyPrice),
            "NetCostGold", Math.round(buyPrice),
            "GainPercent", round(gainPercent),
            "GainType", "combatPower",
            "EfficiencyScore", efficiencyPer100kGold(gainPercent, buyPrice),
            "ScoreUnit", "전투력 % / 10만 골드",
            "Source", "auction",
            "AccessoryComparison", comparison,
            "Caveat", "악세 즉시구매가 기준"
        );
    }

    private Map<String, Object> normalizeUpgradeCandidate(JsonNode candidate) {
        Double gainPercent = numberValue(candidate, "GainPercent", "gainPercent");
        Double costGold = firstNumber(candidate, new String[][] {
            {"NetCostGold", "netCostGold"},
            {"CostGold", "costGold"}
        });

        if (costGold == null || costGold <= 0 || gainPercent == null || gainPercent <= 0) {
            return null;
        }

        Map<String, Object> normalized = objectMap(candidate);
        Double providedScore = numberValue(candidate, "EfficiencyScore", "efficiencyScore");

        normalized.put("CostGold", Math.round(firstNumber(candidate, new String[][] {{"CostGold", "costGold"}}) == null
            ? costGold
            : firstNumber(candidate, new String[][] {{"CostGold", "costGold"}})));
        normalized.put("NetCostGold", Math.round(costGold));
        normalized.put("GainPercent", round(gainPercent));
        normalized.put("GainType", textValue(candidate, "GainType", "gainType").isBlank() ? "combatPower" : textValue(candidate, "GainType", "gainType"));
        normalized.put("EfficiencyScore", providedScore != null && providedScore > 0
            ? providedScore
            : efficiencyPer100kGold(gainPercent, costGold));
        normalized.put("ScoreUnit", textValue(candidate, "ScoreUnit", "scoreUnit").isBlank()
            ? "전투력 % / 10만 골드"
            : textValue(candidate, "ScoreUnit", "scoreUnit"));
        return normalized;
    }

    private String accessoryLabel(JsonNode comparison) {
        String replacedType = textValue(child(comparison, "ReplacedAccessory"), "Type", "type");
        String candidateType = textValue(child(comparison, "Candidate"), "Type", "type");
        String type = replacedType.isBlank() ? candidateType : replacedType;

        return (type.isBlank() ? "악세" : type) + " 교체";
    }

    private List<String> mergedMissingInputs(JsonNode accessoryRecommendation, JsonNode upgradeEfficiency) {
        List<String> missingInputs = new ArrayList<>();

        for (JsonNode value : arrayItems(child(accessoryRecommendation, "MissingInputs"))) {
            missingInputs.add(value.asString());
        }
        for (JsonNode value : arrayItems(child(upgradeEfficiency, "MissingInputs"))) {
            missingInputs.add(value.asString());
        }

        return missingInputs;
    }

    private double efficiencyPer100kGold(double gainPercent, double costGold) {
        if (costGold <= 0) {
            return 0;
        }

        return round(gainPercent / costGold * 100000);
    }

    private double score(Map<String, Object> candidate) {
        Object value = candidate.get("EfficiencyScore");

        if (value instanceof Number number) {
            return number.doubleValue();
        }

        return number(String.valueOf(value));
    }

    private double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }

    private Map<String, Object> objectMap(JsonNode node) {
        Map<String, Object> map = new LinkedHashMap<>();

        if (node == null || !node.isObject()) {
            return map;
        }

        for (String propertyName : node.propertyNames()) {
            map.put(propertyName, node.get(propertyName));
        }

        return map;
    }

    private Double firstNumber(JsonNode node, String[][] keyGroups) {
        for (String[] keys : keyGroups) {
            Double value = numberValue(node, keys);

            if (value != null) {
                return value;
            }
        }

        return null;
    }

    private String textValue(JsonNode node, String... keys) {
        JsonNode value = value(node, keys);

        return value == null || value.isNull() ? "" : value.asString();
    }

    private Double numberValue(JsonNode node, String... keys) {
        JsonNode value = value(node, keys);

        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isNumber()) {
            return value.asDouble();
        }

        return number(value.asString());
    }

    private JsonNode value(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);
            if (value != null && !value.isNull()) {
                return value;
            }
        }

        return null;
    }

    private double number(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }

        try {
            return Double.parseDouble(value.replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return 0;
        }
    }
}
