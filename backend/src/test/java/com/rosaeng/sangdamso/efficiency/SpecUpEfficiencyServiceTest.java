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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
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

    @Test
    void searchesEquippedAccessoriesConcurrently() throws Exception {
        CountDownLatch searchesStarted = new CountDownLatch(5);
        CountDownLatch releaseSearches = new CountDownLatch(1);
        AtomicInteger inFlight = new AtomicInteger();
        AtomicInteger maxInFlight = new AtomicInteger();
        SpecUpEfficiencyService service = new SpecUpEfficiencyService(
            new MultiAccessoryCharacterService(),
            new BlockingAccessoryAuctionSearchService(searchesStarted, releaseSearches, inFlight, maxInFlight),
            new FakeAccessoryEfficiencyService(),
            new FakeUpgradeEfficiencyService(),
            new FakeSpecUpRecommendationService(),
            Clock.fixed(Instant.parse("2026-05-29T00:02:00Z"), ZoneOffset.UTC)
        );
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            Future<JsonNode> result = executor.submit(() -> service.findSpecUpEfficiency("붐버", false));
            boolean allSearchesStarted = searchesStarted.await(500, TimeUnit.MILLISECONDS);
            releaseSearches.countDown();

            assertThat(result.get(2, TimeUnit.SECONDS).get("Recommendation").get("Status").asString()).isEqualTo("ready");
            assertThat(allSearchesStarted).isTrue();
            assertThat(maxInFlight).hasValueGreaterThan(1);
        } finally {
            releaseSearches.countDown();
            executor.shutdownNow();
        }
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

    private class MultiAccessoryCharacterService extends CharacterService {

        MultiAccessoryCharacterService() {
            super(null);
        }

        @Override
        public SpecUpCharacterContext buildSpecUpContext(String characterName, boolean forceRefresh) {
            return new SpecUpCharacterContext(
                characterName,
                toJsonNode(orderedMap("CharacterName", characterName)),
                toJsonNode(List.of(
                    orderedMap("Type", "목걸이", "Name", "현재 목걸이"),
                    orderedMap("Type", "귀걸이", "Name", "현재 귀걸이 1"),
                    orderedMap("Type", "귀걸이", "Name", "현재 귀걸이 2"),
                    orderedMap("Type", "반지", "Name", "현재 반지 1"),
                    orderedMap("Type", "반지", "Name", "현재 반지 2")
                )),
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

    private class BlockingAccessoryAuctionSearchService extends AccessoryAuctionSearchService {

        private final CountDownLatch searchesStarted;
        private final CountDownLatch releaseSearches;
        private final AtomicInteger inFlight;
        private final AtomicInteger maxInFlight;

        BlockingAccessoryAuctionSearchService(
            CountDownLatch searchesStarted,
            CountDownLatch releaseSearches,
            AtomicInteger inFlight,
            AtomicInteger maxInFlight
        ) {
            super(null, null);
            this.searchesStarted = searchesStarted;
            this.releaseSearches = releaseSearches;
            this.inFlight = inFlight;
            this.maxInFlight = maxInFlight;
        }

        @Override
        public SearchResult searchAccessoryCandidates(String type, JsonNode currentAccessory, int equipmentIndex, boolean forceRefresh) {
            int currentInFlight = inFlight.incrementAndGet();
            maxInFlight.accumulateAndGet(currentInFlight, Math::max);
            searchesStarted.countDown();

            try {
                releaseSearches.await(1, TimeUnit.SECONDS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                inFlight.decrementAndGet();
            }

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
