package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class AccessoryEfficiencyServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void ranksPositiveAccessoryReplacementByGoldPerCombatPowerPercent() {
        AccessoryEfficiencyService service = new AccessoryEfficiencyService();
        JsonNode profile = toJsonNode(orderedMap(
            "CharacterClassName", "창술사",
            "CombatPower", "1000000",
            "Stats", List.of(orderedMap("Type", "치명", "Value", "1000"))
        ));
        JsonNode equipment = toJsonNode(List.of(
            orderedMap(
                "Type", "무기",
                "Name", "+11 무기",
                "MainStatValue", 0,
                "WeaponStats", orderedMap("WeaponPower", orderedMap("Value", 100000))
            ),
            currentRing()
        ));
        JsonNode candidates = toJsonNode(List.of(betterRing(10000, 1)));
        Map<String, JsonNode> context = new LinkedHashMap<>();
        context.put("profile", profile);
        context.put("equipment", equipment);
        context.put("arkPassive", toJsonNode(orderedMap("Points", List.of(orderedMap("Name", "깨달음", "Value", 80)))));
        context.put("engravings", toJsonNode(List.of()));
        context.put("gems", toJsonNode(List.of()));
        context.put("criticalStats", null);

        JsonNode result = service.build(context, candidates);

        assertThat(result.get("Status").asString()).isEqualTo("ready");
        assertThat(result.get("TopRecommendation").get("Type").asString()).isEqualTo("accessory");
        assertThat(result.get("TopRecommendation").get("BuyPrice").asInt()).isEqualTo(10000);
        assertThat(result.get("Comparisons").size()).isEqualTo(1);
        assertThat(result.get("Comparisons").get(0).get("CombatPowerGainPercent").asDouble()).isGreaterThan(0);
    }

    private Map<String, Object> currentRing() {
        return orderedMap(
            "Type", "반지",
            "Name", "현재 반지",
            "Grade", "고대",
            "Quality", 90,
            "MainStatValue", 10000,
            "EnlightenmentPoint", 8,
            "DetailSections", List.of(orderedMap(
                "title", "기본 효과",
                "lines", List.of("힘 +10000", "치명 +200")
            ))
        );
    }

    private Map<String, Object> betterRing(int buyPrice, int targetEquipmentIndex) {
        return orderedMap(
            "Type", "반지",
            "Name", "더 좋은 반지",
            "Grade", "고대",
            "Quality", 92,
            "BuyPrice", buyPrice,
            "TargetEquipmentIndex", targetEquipmentIndex,
            "MainStatValue", 14000,
            "EnlightenmentPoint", 9,
            "DetailSections", List.of(orderedMap(
                "title", "기본 효과",
                "lines", List.of("힘 +14000", "치명 +260")
            ))
        );
    }

    private JsonNode toJsonNode(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }
}
