package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class UpgradeEfficiencyServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UpgradeEfficiencyService service = new UpgradeEfficiencyService();

    @Test
    void returnsUnavailableCandidatesUntilMarketSnapshotExists() {
        JsonNode result = service.build(Map.of(
            "profile", objectMapper.createObjectNode().put("CharacterName", "도화가"),
            "equipment", objectMapper.createArrayNode()
        ));

        assertThat(result.get("MarketDataStatus").asString()).isEqualTo("unavailable");
        assertThat(result.get("Candidates").size()).isZero();
    }
}
