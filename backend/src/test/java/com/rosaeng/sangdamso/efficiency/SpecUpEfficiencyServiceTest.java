package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;

import com.rosaeng.sangdamso.character.CharacterService;
import com.rosaeng.sangdamso.spec.UpgradeEfficiencyService;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class SpecUpEfficiencyServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void buildsSpecUpEfficiencyResponse() {
        SpecUpEfficiencyService service = new SpecUpEfficiencyService(
            new FakeCharacterService(),
            new FakeAccessoryAuctionSearchService(),
            new FakeAccessoryEfficiencyService(),
            new FakeUpgradeEfficiencyService(),
            new FakeSpecUpRecommendationService(),
            Clock.fixed(Instant.parse("2026-05-29T00:02:00Z"), ZoneOffset.UTC)
        );

        JsonNode result = service.findSpecUpEfficiency("붐버", false);

        assertThat(result.get("CharacterName").asString()).isEqualTo("붐버");
        assertThat(result.get("UpdatedAt").asString()).isEqualTo("2026-05-29T00:02:00Z");
        assertThat(result.get("MarketUpdatedAt").asString()).isEqualTo("2026-05-29T00:00:00Z");
        assertThat(result.get("AccessoryMarketUpdatedAt").asString()).isEqualTo("2026-05-29T00:01:00Z");
        assertThat(result.get("SearchSummary").get(0).get("Type").asString()).isEqualTo("목걸이");
        assertThat(result.get("Recommendation").get("Status").asString()).isEqualTo("ready");
    }

    private JsonNode toJsonNode(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }

    private class FakeCharacterService extends CharacterService {

        FakeCharacterService() {
            super(null);
        }

        @Override
        public SpecUpCharacterContext buildSpecUpContext(String characterName, boolean forceRefresh) {
            return new SpecUpCharacterContext(
                characterName,
                toJsonNode(orderedMap("CharacterName", characterName)),
                toJsonNode(List.of(orderedMap("Type", "목걸이", "Name", "현재 목걸이"))),
                null,
                toJsonNode(List.of()),
                toJsonNode(orderedMap()),
                toJsonNode(orderedMap()),
                toJsonNode(orderedMap()),
                toJsonNode(orderedMap()),
                toJsonNode(List.of()),
                toJsonNode(List.of()),
                toJsonNode(orderedMap()),
                toJsonNode(orderedMap()),
                toJsonNode(orderedMap()),
                toJsonNode(orderedMap("updatedAt", "2026-05-29T00:00:00Z")),
                toJsonNode(List.of())
            );
        }
    }

    private class FakeAccessoryAuctionSearchService extends AccessoryAuctionSearchService {

        FakeAccessoryAuctionSearchService() {
            super(null, null);
        }

        @Override
        public SearchResult searchAccessoryCandidates(String type, JsonNode currentAccessory, int equipmentIndex, boolean forceRefresh) {
            return new SearchResult(
                type,
                List.of(toJsonNode(orderedMap("Type", type, "TargetEquipmentIndex", equipmentIndex))),
                List.of("추가 피해 1.50% 이상"),
                3,
                "2026-05-29T00:01:00Z"
            );
        }
    }

    private class FakeAccessoryEfficiencyService extends AccessoryEfficiencyService {

        @Override
        public JsonNode build(Map<String, JsonNode> context, JsonNode candidates) {
            return toJsonNode(orderedMap(
                "Status", "ready",
                "TopRecommendation", orderedMap("Type", "accessory"),
                "Comparisons", List.of(orderedMap("Type", "accessory", "BuyPrice", 1000, "CombatPowerGainPercent", 1.0)),
                "MissingInputs", List.of()
            ));
        }
    }

    private class FakeUpgradeEfficiencyService extends UpgradeEfficiencyService {

        @Override
        public JsonNode build(Map<String, JsonNode> context) {
            return toJsonNode(orderedMap(
                "MarketDataStatus", "ready",
                "Candidates", List.of(),
                "MissingInputs", List.of()
            ));
        }
    }

    private class FakeSpecUpRecommendationService extends SpecUpRecommendationService {

        @Override
        public JsonNode build(JsonNode accessoryRecommendation, JsonNode upgradeEfficiency, int limit) {
            return toJsonNode(orderedMap(
                "Status", "ready",
                "TopCandidates", List.of(),
                "AccessoryRecommendation", accessoryRecommendation,
                "UpgradeEfficiency", upgradeEfficiency,
                "MissingInputs", List.of()
            ));
        }
    }
}
