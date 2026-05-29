package com.rosaeng.sangdamso.efficiency;

import tools.jackson.databind.JsonNode;

public record SpecUpCharacterContext(
    String characterName,
    JsonNode profile,
    JsonNode equipment,
    JsonNode paradiseOrb,
    JsonNode avatars,
    JsonNode arkPassive,
    JsonNode arkGrid,
    JsonNode cards,
    JsonNode skills,
    JsonNode engravings,
    JsonNode gems,
    JsonNode classIdentityEffects,
    JsonNode criticalStats,
    JsonNode combatPowerAnalysis,
    JsonNode marketSnapshot,
    JsonNode engravingBookPrices
) {
}
