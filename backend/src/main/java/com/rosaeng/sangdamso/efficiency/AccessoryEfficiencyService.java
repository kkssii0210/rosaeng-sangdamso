package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.spec.UpgradeCombatPowerEstimator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class AccessoryEfficiencyService {

    private static final Set<String> ACCESSORY_TYPES = Set.of("목걸이", "귀걸이", "반지");
    private static final Set<String> COMBAT_STAT_TYPES = Set.of("치명", "특화", "신속");
    private static final Pattern BASIC_STAT_PATTERN = Pattern.compile("^(?<name>힘|민첩|지능|치명|특화|신속)\\s*\\+?\\s*(?<value>[\\d,]+)");

    private final UpgradeCombatPowerEstimator combatPowerEstimator = new UpgradeCombatPowerEstimator();

    public JsonNode build(Map<String, JsonNode> context, JsonNode candidates) {
        Double currentEstimate = combatPowerEstimator.estimate(
            context.get("profile"),
            context.get("equipment"),
            context.get("engravings"),
            context.get("gems")
        );
        Double currentOfficial = numberValue(context.get("profile"), "CombatPower", "combatPower");

        if (currentOfficial == null || currentOfficial <= 0 || currentEstimate == null || currentEstimate <= 0) {
            return toJsonNode(orderedMap(
                "Status", "unavailable",
                "TopRecommendation", null,
                "Comparisons", List.of(),
                "MissingInputs", List.of("현재 전투력 계산값")
            ));
        }
        double roundedCurrentEstimate = roundEstimate(currentEstimate);

        List<Map<String, Object>> comparisons = arrayItems(candidates).stream()
            .filter(candidate -> ACCESSORY_TYPES.contains(textValue(candidate, "Type", "type")))
            .map(candidate -> bestReplacementForCandidate(context, candidate, currentOfficial, roundedCurrentEstimate))
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingDouble(item -> ((Number) item.get("GoldPerOnePercentCombatPower")).doubleValue()))
            .limit(3)
            .toList();

        if (comparisons.isEmpty()) {
            return toJsonNode(orderedMap(
                "Status", "noRecommendation",
                "TopRecommendation", null,
                "Comparisons", List.of(),
                "MissingInputs", List.of()
            ));
        }

        return toJsonNode(orderedMap(
            "Status", "ready",
            "TopRecommendation", comparisons.get(0),
            "Comparisons", comparisons,
            "MissingInputs", List.of()
        ));
    }

    private Map<String, Object> bestReplacementForCandidate(
        Map<String, JsonNode> context,
        JsonNode candidate,
        double currentOfficial,
        double currentEstimate
    ) {
        double buyPrice = numberValue(candidate, "BuyPrice", "buyPrice") == null ? 0 : numberValue(candidate, "BuyPrice", "buyPrice");

        if (buyPrice <= 0) {
            return null;
        }

        return matchingAccessorySlots(context.get("equipment"), candidate).stream()
            .map(slot -> evaluateReplacement(context, candidate, slot, currentOfficial, currentEstimate, buyPrice))
            .filter(Objects::nonNull)
            .min(Comparator.comparingDouble(item -> ((Number) item.get("GoldPerOnePercentCombatPower")).doubleValue()))
            .orElse(null);
    }

    private Map<String, Object> evaluateReplacement(
        Map<String, JsonNode> context,
        JsonNode candidate,
        Slot slot,
        double currentOfficial,
        double currentEstimate,
        double buyPrice
    ) {
        JsonNode simulatedEquipment = replaceAccessoryAtIndex(context.get("equipment"), slot.index(), candidate);
        JsonNode simulatedProfile = profileWithAccessoryStatDelta(context.get("profile"), slot.item(), candidate);
        Double simulatedEstimate = combatPowerEstimator.estimate(
            simulatedProfile,
            simulatedEquipment,
            context.get("engravings"),
            context.get("gems")
        );

        if (simulatedEstimate == null || roundEstimate(simulatedEstimate) <= currentEstimate) {
            return null;
        }

        double combatPowerGain = roundEstimate(simulatedEstimate) - currentEstimate;
        double combatPowerGainPercent = (combatPowerGain / currentOfficial) * 100;

        if (combatPowerGain <= 0 || combatPowerGainPercent <= 0) {
            return null;
        }

        return orderedMap(
            "Type", "accessory",
            "Candidate", candidate,
            "ReplacedAccessory", slot.item(),
            "ReplacedEquipmentIndex", slot.index(),
            "MainStatName", mainStatNameForClass(textValue(context.get("profile"), "CharacterClassName", "characterClassName")),
            "CurrentOfficialCombatPower", currentOfficial,
            "ExpectedCombatPower", currentOfficial + combatPowerGain,
            "CombatPowerGain", combatPowerGain,
            "CombatPowerGainPercent", combatPowerGainPercent,
            "BuyPrice", Math.round(buyPrice),
            "GoldPerOnePercentCombatPower", buyPrice / combatPowerGainPercent,
            "DamageReference", orderedMap()
        );
    }

    private List<Slot> matchingAccessorySlots(JsonNode equipment, JsonNode candidate) {
        String candidateType = textValue(candidate, "Type", "type");
        Integer targetEquipmentIndex = nullableIntValue(candidate, "TargetEquipmentIndex", "targetEquipmentIndex");
        List<Slot> slots = new ArrayList<>();
        List<JsonNode> items = arrayItems(equipment);

        for (int index = 0; index < items.size(); index++) {
            JsonNode item = items.get(index);

            if (!candidateType.equals(textValue(item, "Type", "type"))) {
                continue;
            }
            if (targetEquipmentIndex != null && targetEquipmentIndex != index) {
                continue;
            }

            slots.add(new Slot(index, item));
        }

        return slots;
    }

    private double roundEstimate(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private JsonNode replaceAccessoryAtIndex(JsonNode equipment, int index, JsonNode candidate) {
        List<Object> items = new ArrayList<>();
        List<JsonNode> equipmentItems = arrayItems(equipment);

        for (int itemIndex = 0; itemIndex < equipmentItems.size(); itemIndex++) {
            items.add(itemIndex == index ? candidate : equipmentItems.get(itemIndex));
        }

        return toJsonNode(items);
    }

    private JsonNode profileWithAccessoryStatDelta(JsonNode profile, JsonNode replacedAccessory, JsonNode candidate) {
        Map<String, Integer> deltas = new LinkedHashMap<>();

        for (String type : COMBAT_STAT_TYPES) {
            int delta = combatStatValue(candidate, type) - combatStatValue(replacedAccessory, type);

            if (delta != 0) {
                deltas.put(type, delta);
            }
        }

        if (deltas.isEmpty()) {
            return profile;
        }

        Map<String, Object> profileMap = objectMap(profile);
        List<Map<String, Object>> updatedStats = new ArrayList<>();

        for (JsonNode statNode : arrayItems(child(profile, "Stats"))) {
            Map<String, Object> stat = objectMap(statNode);
            String statType = textValue(statNode, "Type", "type");
            Integer delta = deltas.get(statType);

            if (delta != null) {
                double currentValue = numberValue(statNode, "Value", "value") == null ? 0 : numberValue(statNode, "Value", "value");
                stat.put("Value", String.valueOf(Math.max(0, currentValue + delta)));
            }

            updatedStats.add(stat);
        }

        for (Map.Entry<String, Integer> delta : deltas.entrySet()) {
            boolean found = updatedStats.stream()
                .anyMatch(stat -> delta.getKey().equals(String.valueOf(stat.get("Type")).replace("\"", "")));

            if (!found && delta.getValue() > 0) {
                updatedStats.add(new LinkedHashMap<>(orderedMap("Type", delta.getKey(), "Value", String.valueOf(delta.getValue()))));
            }
        }

        profileMap.put("Stats", updatedStats);
        return toJsonNode(profileMap);
    }

    private int combatStatValue(JsonNode accessory, String type) {
        for (String line : basicEffectLines(accessory)) {
            Matcher matcher = BASIC_STAT_PATTERN.matcher(line);

            if (matcher.find() && type.equals(matcher.group("name"))) {
                return (int) number(matcher.group("value"));
            }
        }

        return 0;
    }

    private List<String> basicEffectLines(JsonNode accessory) {
        List<String> lines = new ArrayList<>();

        for (JsonNode section : arrayItems(child(accessory, "DetailSections"))) {
            String title = textValue(section, "title", "Title");

            if (!"기본 효과".equals(title)) {
                continue;
            }

            for (JsonNode line : arrayItems(child(section, "lines"))) {
                lines.add(line.asString());
            }
            for (JsonNode line : arrayItems(child(section, "Lines"))) {
                lines.add(line.asString());
            }
        }

        return lines;
    }

    private JsonNode arkPassiveWithAccessoryDelta(JsonNode arkPassive, JsonNode replacedAccessory, JsonNode candidate) {
        double currentPoint = accessoryEnlightenmentPoint(replacedAccessory);
        double candidatePoint = accessoryEnlightenmentPoint(candidate);
        double delta = candidatePoint - currentPoint;

        if (delta == 0 || arkPassive == null || arkPassive.isNull()) {
            return arkPassive;
        }

        JsonNode pointsNode = value(arkPassive, "Points", "points");
        String pointKey = child(arkPassive, "Points") != null && !child(arkPassive, "Points").isNull() ? "Points" : "points";
        List<Object> points = new ArrayList<>();
        boolean updated = false;

        for (JsonNode point : arrayItems(pointsNode)) {
            if (!"깨달음".equals(textValue(point, "Name", "name"))) {
                points.add(point);
                continue;
            }

            Map<String, Object> pointMap = objectMap(point);
            String valueKey = child(point, "Value") != null && !child(point, "Value").isNull() ? "Value" : "value";
            double currentValue = numberValue(point, "Value", "value") == null ? 0 : numberValue(point, "Value", "value");
            pointMap.put(valueKey, Math.max(0, currentValue + delta));
            points.add(pointMap);
            updated = true;
        }

        if (!updated) {
            return arkPassive;
        }

        Map<String, Object> arkPassiveMap = objectMap(arkPassive);
        arkPassiveMap.put(pointKey, points);
        return toJsonNode(arkPassiveMap);
    }

    private double accessoryEnlightenmentPoint(JsonNode accessory) {
        Double directPoint = numberValue(accessory, "EnlightenmentPoint", "enlightenmentPoint");
        return directPoint == null ? 0 : directPoint;
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

    private String mainStatNameForClass(String className) {
        if (className.contains("헌터") || className.contains("건슬") || className.contains("데빌") || className.contains("블래")) {
            return "민첩";
        }
        if (className.contains("마법") || className.contains("바드") || className.contains("소서") || className.contains("아르카나")) {
            return "지능";
        }

        return "힘";
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

    private Integer nullableIntValue(JsonNode node, String... keys) {
        Double value = numberValue(node, keys);

        return value == null ? null : value.intValue();
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

    private double number(Object value) {
        if (value == null) {
            return 0;
        }

        if (value instanceof Number number) {
            return number.doubleValue();
        }

        return number(String.valueOf(value));
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

    private record Slot(int index, JsonNode item) {
    }
}
