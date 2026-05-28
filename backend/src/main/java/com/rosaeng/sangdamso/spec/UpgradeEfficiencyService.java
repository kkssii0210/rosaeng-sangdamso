package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.List;
import java.util.Map;
import tools.jackson.databind.JsonNode;

public class UpgradeEfficiencyService {

    public JsonNode build(Map<String, JsonNode> context) {
        JsonNode marketSnapshot = context.get("marketSnapshot");
        boolean marketReady = marketSnapshot != null && !marketSnapshot.isNull();

        return toJsonNode(orderedMap(
            "MarketDataStatus", marketReady ? "ready" : "unavailable",
            "Candidates", List.of(),
            "Inputs", orderedMap(
                "HasMarketSnapshot", marketReady
            )
        ));
    }
}
