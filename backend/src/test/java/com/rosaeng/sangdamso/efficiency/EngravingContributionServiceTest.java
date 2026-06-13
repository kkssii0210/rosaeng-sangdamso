package com.rosaeng.sangdamso.efficiency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class EngravingContributionServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final EngravingContributionService service = new EngravingContributionService();

    @Test
    void matchesEngravingContributionGoldenFixture() throws IOException {
        JsonNode fixture = readFixture("golden/engraving-contribution.json");
        JsonNode input = fixture.get("input");
        JsonNode expected = fixture.get("expected");

        JsonNode result = service.build(input.get("engravings"), input.get("criticalStats"));

        assertThat(result.get("아드레날린").get("ContributionPercent").asDouble())
            .isCloseTo(expected.get("아드레날린").get("ContributionPercent").asDouble(), offset(0.000000001));
        assertThat(result.get("아드레날린").get("ContributionText").asString())
            .isEqualTo(expected.get("아드레날린").get("ContributionText").asString());
        assertThat(result.get("아드레날린").get("CriticalRatePercent").asDouble())
            .isCloseTo(expected.get("아드레날린").get("CriticalRatePercent").asDouble(), offset(0.000000001));
        assertThat(result.get("아드레날린").get("AttackPowerPercent").asDouble())
            .isCloseTo(expected.get("아드레날린").get("AttackPowerPercent").asDouble(), offset(0.000000001));

        assertThat(result.get("예리한 둔기").get("ContributionPercent").asDouble())
            .isCloseTo(expected.get("예리한 둔기").get("ContributionPercent").asDouble(), offset(0.000000001));
        assertThat(result.get("예리한 둔기").get("ContributionText").asString())
            .isEqualTo(expected.get("예리한 둔기").get("ContributionText").asString());
        assertThat(result.get("예리한 둔기").get("CriticalDamageBonusPercent").asDouble())
            .isCloseTo(expected.get("예리한 둔기").get("CriticalDamageBonusPercent").asDouble(), offset(0.000000001));
        assertThat(result.get("예리한 둔기").get("ExpectedDamagePenaltyMultiplier").asDouble())
            .isCloseTo(expected.get("예리한 둔기").get("ExpectedDamagePenaltyMultiplier").asDouble(), offset(0.000000001));

        assertThat(result.get("원한")).isNull();
    }

    private JsonNode readFixture(String fixture) throws IOException {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(fixture)) {
            assertThat(inputStream).as("fixture %s should exist", fixture).isNotNull();
            return objectMapper.readTree(inputStream);
        }
    }
}
