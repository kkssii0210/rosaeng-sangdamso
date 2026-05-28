package com.rosaeng.sangdamso.character;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class CharacterContractTest {

    private static final String[] EXPECTED_TOP_LEVEL_KEYS = {
        "profile",
        "equipment",
        "paradiseOrb",
        "avatars",
        "arkPassive",
        "arkGrid",
        "cards",
        "skills",
        "engravings",
        "gems",
        "classIdentityEffects",
        "criticalStats",
        "combatPowerAnalysis",
        "upgradeEfficiency"
    };

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void characterResponseKeepsFrontendTopLevelContract() {
        CharacterResponse response = new CharacterResponse(
            objectMapper.createObjectNode().put("CharacterName", "도화가"),
            objectMapper.createArrayNode(),
            null,
            objectMapper.createArrayNode(),
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            objectMapper.createArrayNode(),
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            null,
            null,
            null,
            null
        );

        JsonNode json = objectMapper.convertValue(response, JsonNode.class);

        assertThat(json.propertyNames()).containsExactly(EXPECTED_TOP_LEVEL_KEYS);
    }
}
