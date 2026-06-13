package com.rosaeng.sangdamso.efficiency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class AccessoryContributionServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AccessoryContributionService service = new AccessoryContributionService();

    @Test
    void matchesAccessoryContributionGoldenFixture() throws IOException {
        JsonNode fixture = readFixture("golden/accessory-contribution.json");
        JsonNode input = fixture.get("input");
        JsonNode expected = fixture.get("expected");

        JsonNode result = service.build(input.get("equipment"), input.get("profile"), input.get("criticalStats"));

        assertThat(result.get("TotalContributionPercent").asDouble())
            .isCloseTo(expected.get("TotalContributionPercent").asDouble(), offset(0.000000001));
        assertThat(result.get("TotalContributionText").asString()).isEqualTo(expected.get("TotalContributionText").asString());
        assertThat(result.get("CriticalContext").get("AdditionalDamagePercent").asDouble())
            .isCloseTo(expected.get("CriticalContext").get("AdditionalDamagePercent").asDouble(), offset(0.000000001));
        assertThat(result.get("CriticalContext").get("CritRatePercent").asDouble())
            .isCloseTo(expected.get("CriticalContext").get("CritRatePercent").asDouble(), offset(0.000000001));
        assertThat(result.get("CriticalContext").get("CritDamageBonusPercent").asDouble())
            .isCloseTo(expected.get("CriticalContext").get("CritDamageBonusPercent").asDouble(), offset(0.000000001));
        assertThat(result.get("itemTotals").get("1").asDouble())
            .isCloseTo(expected.get("itemTotals").get("1").asDouble(), offset(0.000000001));
        assertThat(result.get("itemTotals").get("2").asDouble())
            .isCloseTo(expected.get("itemTotals").get("2").asDouble(), offset(0.000000001));
        assertThat(result.get("lines").get("1:0:0").get("bucket").asString())
            .isEqualTo(expected.get("lines").get("1:0:0").get("bucket").asString());
        assertThat(result.get("lines").get("2:0:0").get("ContributionText").asString())
            .isEqualTo(expected.get("lines").get("2:0:0").get("ContributionText").asString());
    }

    private JsonNode readFixture(String fixture) throws IOException {
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream(fixture)) {
            assertThat(inputStream).as("fixture %s should exist", fixture).isNotNull();
            return objectMapper.readTree(inputStream);
        }
    }
}
