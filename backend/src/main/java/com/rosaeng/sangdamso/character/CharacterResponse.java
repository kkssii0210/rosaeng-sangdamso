package com.rosaeng.sangdamso.character;

import tools.jackson.databind.JsonNode;

public record CharacterResponse(
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
    JsonNode upgradeEfficiency
) {
}
