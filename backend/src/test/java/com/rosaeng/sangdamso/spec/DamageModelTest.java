package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class DamageModelTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void matchesGoldenFixtureForCriticalRateLimitAndDamageMultipliers() throws IOException {
        JsonNode fixture = readFixture("golden/damage-model.json");
        JsonNode input = fixture.get("input");
        JsonNode expected = fixture.get("expected");
        DamageModel.CriticalRateLimit criticalRateLimit = DamageModel.criticalRateLimitFromStats(input.get("criticalStats"));

        assertThat(DamageModel.toRatio(input.get("percent").asDouble()))
            .isCloseTo(expected.get("toRatio").asDouble(), offset(0.000000001));
        assertThat(DamageModel.toPercent(input.get("ratio").asDouble()))
            .isCloseTo(expected.get("toPercent").asDouble(), offset(0.000000001));
        assertThat(DamageModel.roundPercent(input.get("roundSource").asDouble()))
            .isCloseTo(expected.get("roundPercent").asDouble(), offset(0.000000001));

        assertThat(criticalRateLimit.isActive()).isEqualTo(expected.get("criticalRateLimit").get("isActive").asBoolean());
        assertThat(criticalRateLimit.sourceName()).isEqualTo(expected.get("criticalRateLimit").get("sourceName").asString());
        assertThat(criticalRateLimit.capPercent()).isEqualTo(expected.get("criticalRateLimit").get("capPercent").asDouble());
        assertThat(criticalRateLimit.overflowConversionRatePercent())
            .isEqualTo(expected.get("criticalRateLimit").get("overflowConversionRatePercent").asDouble());
        assertThat(criticalRateLimit.maxConvertedEvolutionDamagePercent())
            .isEqualTo(expected.get("criticalRateLimit").get("maxConvertedEvolutionDamagePercent").asDouble());

        assertThat(DamageModel.effectiveCriticalRatePercent(input.get("currentCritRatePercent").asDouble(), criticalRateLimit))
            .isCloseTo(expected.get("effectiveCriticalRatePercent").asDouble(), offset(0.000000001));
        assertThat(DamageModel.convertedEvolutionDamagePercent(input.get("currentCritRatePercent").asDouble(), criticalRateLimit))
            .isCloseTo(expected.get("convertedEvolutionDamagePercent").asDouble(), offset(0.000000001));
        assertThat(DamageModel.totalEvolutionDamagePercent(
            input.get("fixedEvolutionDamagePercent").asDouble(),
            input.get("currentCritRatePercent").asDouble(),
            criticalRateLimit
        )).isCloseTo(expected.get("totalEvolutionDamagePercent").asDouble(), offset(0.000000001));
        assertThat(DamageModel.evolutionDamageMultiplier(
            input.get("fixedEvolutionDamagePercent").asDouble(),
            input.get("currentCritRatePercent").asDouble(),
            input.get("baseCritRatePercent").asDouble(),
            criticalRateLimit
        )).isCloseTo(expected.get("evolutionDamageMultiplier").asDouble(), offset(0.000000001));
        assertThat(DamageModel.criticalAverageMultiplier(
            input.get("currentCritRatePercent").asDouble(),
            input.get("critDamageBonusPercent").asDouble(),
            input.get("criticalOutgoingDamagePercent").asDouble(),
            criticalRateLimit
        )).isCloseTo(expected.get("criticalAverageMultiplier").asDouble(), offset(0.000000001));
    }

    private JsonNode readFixture(String fixture) throws IOException {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(fixture)) {
            assertThat(inputStream).as("fixture %s should exist", fixture).isNotNull();
            return objectMapper.readTree(inputStream);
        }
    }
}
