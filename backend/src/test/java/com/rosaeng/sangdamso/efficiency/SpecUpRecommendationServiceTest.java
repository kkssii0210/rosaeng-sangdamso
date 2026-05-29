package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class SpecUpRecommendationServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void mergesAccessoryAndUpgradeCandidatesByEfficiencyScore() {
        SpecUpRecommendationService service = new SpecUpRecommendationService();
        JsonNode accessoryRecommendation = toJsonNode(orderedMap(
            "Status", "ready",
            "Comparisons", List.of(orderedMap(
                "Type", "accessory",
                "BuyPrice", 100000,
                "CombatPowerGainPercent", 1.0,
                "ReplacedEquipmentIndex", 6,
                "ReplacedAccessory", orderedMap("Type", "목걸이"),
                "Candidate", orderedMap("Type", "목걸이")
            )),
            "MissingInputs", List.of("악세 테스트")
        ));
        JsonNode upgradeEfficiency = toJsonNode(orderedMap(
            "MarketDataStatus", "ready",
            "Candidates", List.of(orderedMap(
                "Id", "gem-1",
                "Type", "gem",
                "Label", "보석 7->8",
                "CostGold", 200000,
                "NetCostGold", 200000,
                "GainPercent", 3.0,
                "GainType", "combatPower",
                "EfficiencyScore", 1.5,
                "ScoreUnit", "전투력 % / 10만 골드"
            )),
            "MissingInputs", List.of("강화 테스트")
        ));

        JsonNode result = service.build(accessoryRecommendation, upgradeEfficiency, 5);

        assertThat(result.get("Status").asString()).isEqualTo("ready");
        assertThat(result.get("TopCandidates").get(0).get("Type").asString()).isEqualTo("gem");
        assertThat(result.get("TopCandidates").get(1).get("Type").asString()).isEqualTo("accessory");
        assertThat(result.get("MissingInputs")).hasSize(2);
    }

    private JsonNode toJsonNode(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }
}
