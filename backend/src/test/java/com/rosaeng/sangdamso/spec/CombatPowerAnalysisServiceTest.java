package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import java.io.IOException;
import java.io.InputStream;
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

        assertThat(analysis.get("Status").asString()).isEqualTo("unavailable");
        assertThat(analysis.get("OfficialCombatPower").asDouble()).isEqualTo(123456.78);
        assertThat(analysis.get("OfficialCombatPowerFloor").asInt()).isEqualTo(123456);
        assertThat(analysis.get("Formula").get("Estimate").isNull()).isTrue();
        assertThat(analysis.get("ParadisePower").get("Value").asInt()).isEqualTo(48275714);
        assertThat(analysis.get("CategorySummary").get(0).get("Category").asString()).isEqualTo("criticalStats");
    }

    @Test
    void matchesSupportedFieldsFromCombatPowerGoldenFixture() throws IOException {
        JsonNode fixture = readFixture("golden/combat-power-analysis.json");
        JsonNode input = fixture.get("input");
        JsonNode expected = fixture.get("expected");
        JsonNode analysis = service.build(Map.of(
            "profile", input.get("profile"),
            "paradiseOrb", input.get("paradiseOrb"),
            "criticalStats", input.get("criticalStats")
        ));

        assertThat(analysis.get("Status").asString()).isEqualTo(expected.get("Status").asString());
        assertThat(analysis.get("OfficialCombatPower").asDouble())
            .isCloseTo(expected.get("OfficialCombatPower").asDouble(), offset(0.000000001));
        assertThat(analysis.get("OfficialCombatPowerFloor").asInt()).isEqualTo(expected.get("OfficialCombatPowerFloor").asInt());
        assertThat(analysis.get("ParadisePower").get("Value").asInt()).isEqualTo(expected.get("ParadisePower").get("Value").asInt());
        assertThat(analysis.get("ParadisePower").get("EffectRole").asString()).isEqualTo(expected.get("ParadisePower").get("EffectRole").asString());
        assertThat(analysis.get("AttackBreakdown").get("BaseAttackSource").asString())
            .isEqualTo(expected.get("AttackBreakdown").get("BaseAttackSource").asString());
        assertThat(analysis.get("Formula").get("EffectiveCoefficient").asDouble())
            .isCloseTo(expected.get("Formula").get("EffectiveCoefficient").asDouble(), offset(0.000000001));
    }

    private JsonNode readFixture(String fixture) throws IOException {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(fixture)) {
            assertThat(inputStream).as("fixture %s should exist", fixture).isNotNull();
            return objectMapper.readTree(inputStream);
        }
    }
}
