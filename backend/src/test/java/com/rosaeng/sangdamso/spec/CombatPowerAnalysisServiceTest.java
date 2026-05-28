package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class CombatPowerAnalysisServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CombatPowerAnalysisService service = new CombatPowerAnalysisService();

    @Test
    void buildsPartialAnalysisFromOfficialCombatPowerAndParadiseOrb() {
        JsonNode analysis = service.build(Map.of(
            "profile", objectMapper.createObjectNode()
                .put("CombatPower", "123,456.78")
                .put("CharacterLevel", 70),
            "paradiseOrb", objectMapper.convertValue(Map.of(
                "Name", "눈부신 비전의 보주",
                "EffectName", "맥스웰 맥시마",
                "EffectRole", "attack",
                "MaxParadisePower", Map.of("Value", 48275714, "Text", "시즌2 달성 최대 낙원력 : 48,275,714")
            ), JsonNode.class),
            "criticalStats", objectMapper.createObjectNode()
                .put("GlobalCriticalRatePercent", 39.92)
                .put("EvolutionDamagePercent", 86.34)
        ));

        assertThat(analysis.get("Status").asString()).isEqualTo("partial");
        assertThat(analysis.get("OfficialCombatPower").asDouble()).isEqualTo(123456.78);
        assertThat(analysis.get("Formula").get("Estimate").asDouble()).isEqualTo(123456.78);
        assertThat(analysis.get("ParadisePower").get("Value").asInt()).isEqualTo(48275714);
        assertThat(analysis.get("CategorySummary").get(0).get("Category").asString()).isEqualTo("criticalStats");
    }
}
