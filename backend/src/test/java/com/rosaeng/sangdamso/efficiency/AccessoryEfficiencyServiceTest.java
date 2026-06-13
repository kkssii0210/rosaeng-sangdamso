package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import java.io.IOException;
import java.io.InputStream;
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

    @Test
    void matchesAccessoryEfficiencyGoldenFixture() throws IOException {
        AccessoryEfficiencyService service = new AccessoryEfficiencyService();
        JsonNode fixture = readFixture("golden/accessory-efficiency.json");
        JsonNode input = fixture.get("input");
        JsonNode expected = fixture.get("expected");
        JsonNode combatContext = input.get("combatContext");
        Map<String, JsonNode> context = new LinkedHashMap<>();
        context.put("profile", input.get("profile"));
        context.put("equipment", input.get("equipment"));
        context.put("arkPassive", combatContext.get("arkPassive"));
        context.put("engravings", combatContext.get("engravings"));
        context.put("gems", combatContext.get("gems"));
        context.put("criticalStats", input.get("criticalStats"));

        JsonNode result = service.build(context, input.get("candidates"));

        assertThat(result.get("Status").asString()).isEqualTo(expected.get("Status").asString());
        assertThat(result.get("TopRecommendation").get("Type").asString())
            .isEqualTo(expected.get("TopRecommendation").get("Type").asString());
        assertThat(result.get("TopRecommendation").get("BuyPrice").asInt())
            .isEqualTo(expected.get("TopRecommendation").get("BuyPrice").asInt());
        assertThat(result.get("TopRecommendation").get("ReplacedEquipmentIndex").asInt())
            .isEqualTo(expected.get("TopRecommendation").get("ReplacedEquipmentIndex").asInt());
        assertThat(result.get("TopRecommendation").get("CombatPowerGainPercent").asDouble())
            .isCloseTo(expected.get("TopRecommendation").get("CombatPowerGainPercent").asDouble(), offset(0.000000001));
        assertThat(result.get("Comparisons").size()).isEqualTo(expected.get("Comparisons").size());
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

    private JsonNode readFixture(String fixture) throws IOException {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(fixture)) {
            assertThat(inputStream).as("fixture %s should exist", fixture).isNotNull();
            return objectMapper.readTree(inputStream);
        }
    }
}
