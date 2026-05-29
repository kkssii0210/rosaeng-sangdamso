package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.character.CharacterService;
import com.rosaeng.sangdamso.spec.UpgradeEfficiencyService;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class SpecUpEfficiencyService {

    private static final List<String> ACCESSORY_TYPES = List.of("목걸이", "귀걸이", "반지");

    private final CharacterService characterService;
    private final AccessoryAuctionSearchService accessoryAuctionSearchService;
    private final AccessoryEfficiencyService accessoryEfficiencyService;
    private final UpgradeEfficiencyService upgradeEfficiencyService;
    private final SpecUpRecommendationService recommendationService;
    private final Clock clock;

    public SpecUpEfficiencyService(
        CharacterService characterService,
        AccessoryAuctionSearchService accessoryAuctionSearchService,
        AccessoryEfficiencyService accessoryEfficiencyService,
        SpecUpRecommendationService recommendationService
    ) {
        this(
            characterService,
            accessoryAuctionSearchService,
            accessoryEfficiencyService,
            new UpgradeEfficiencyService(),
            recommendationService,
            Clock.systemUTC()
        );
    }

    SpecUpEfficiencyService(
        CharacterService characterService,
        AccessoryAuctionSearchService accessoryAuctionSearchService,
        AccessoryEfficiencyService accessoryEfficiencyService,
        UpgradeEfficiencyService upgradeEfficiencyService,
        SpecUpRecommendationService recommendationService,
        Clock clock
    ) {
        this.characterService = characterService;
        this.accessoryAuctionSearchService = accessoryAuctionSearchService;
        this.accessoryEfficiencyService = accessoryEfficiencyService;
        this.upgradeEfficiencyService = upgradeEfficiencyService;
        this.recommendationService = recommendationService;
        this.clock = clock;
    }

    public JsonNode findSpecUpEfficiency(String characterName, boolean forceRefresh) {
        SpecUpCharacterContext context = characterService.buildSpecUpContext(characterName, forceRefresh);
        AccessorySearchBundle accessorySearch = searchAccessories(context, forceRefresh);
        JsonNode accessoryRecommendation = accessorySearch.available()
            ? accessoryEfficiencyService.build(accessoryContext(context), toJsonNode(accessorySearch.candidates()))
            : unavailableAccessoryRecommendation();
        JsonNode upgradeEfficiency = upgradeEfficiencyService.build(upgradeEfficiencyContext(context));
        JsonNode recommendation = recommendationService.build(accessoryRecommendation, upgradeEfficiency, 5);

        return toJsonNode(orderedMap(
            "CharacterName", context.characterName(),
            "UpdatedAt", Instant.now(clock).toString(),
            "MarketUpdatedAt", textOrNull(context.marketSnapshot(), "updatedAt", "UpdatedAt"),
            "AccessoryMarketUpdatedAt", accessorySearch.updatedAt(),
            "SearchSummary", accessorySearch.searchSummary(),
            "Recommendation", recommendation
        ));
    }

    private AccessorySearchBundle searchAccessories(SpecUpCharacterContext context, boolean forceRefresh) {
        List<JsonNode> candidates = new ArrayList<>();
        List<Map<String, Object>> searchSummary = new ArrayList<>();
        List<String> updatedTimes = new ArrayList<>();
        List<JsonNode> equipment = arrayItems(context.equipment());

        try {
            for (int index = 0; index < equipment.size(); index++) {
                JsonNode item = equipment.get(index);
                String type = text(item, "Type", "type");

                if (!ACCESSORY_TYPES.contains(type)) {
                    continue;
                }

                AccessoryAuctionSearchService.SearchResult result = accessoryAuctionSearchService.searchAccessoryCandidates(
                    type,
                    item,
                    index,
                    forceRefresh
                );
                candidates.addAll(result.items());
                if (result.updatedAt() != null && !result.updatedAt().isBlank()) {
                    updatedTimes.add(result.updatedAt());
                }
                searchSummary.add(orderedMap(
                    "Type", result.type(),
                    "EquipmentIndex", index,
                    "SearchOptions", result.searchOptions(),
                    "CandidateCount", result.items().size(),
                    "PagesFetched", result.pagesFetched()
                ));
            }
        } catch (RuntimeException exception) {
            return new AccessorySearchBundle(false, List.of(), searchSummary, latest(updatedTimes));
        }

        return new AccessorySearchBundle(true, candidates, searchSummary, latest(updatedTimes));
    }

    private Map<String, JsonNode> accessoryContext(SpecUpCharacterContext context) {
        Map<String, JsonNode> values = new LinkedHashMap<>();
        values.put("profile", context.profile());
        values.put("equipment", context.equipment());
        values.put("arkPassive", context.arkPassive());
        values.put("engravings", context.engravings());
        values.put("gems", context.gems());
        values.put("criticalStats", context.criticalStats());
        return values;
    }

    private Map<String, JsonNode> upgradeEfficiencyContext(SpecUpCharacterContext context) {
        Map<String, JsonNode> values = new LinkedHashMap<>();
        values.put("profile", context.profile());
        values.put("equipment", context.equipment());
        values.put("avatars", context.avatars());
        values.put("arkPassive", context.arkPassive());
        values.put("arkGrid", context.arkGrid());
        values.put("cards", context.cards());
        values.put("engravings", context.engravings());
        values.put("gems", context.gems());
        values.put("paradiseOrb", context.paradiseOrb());
        values.put("criticalStats", context.criticalStats());
        values.put("marketSnapshot", context.marketSnapshot());
        values.put("engravingBookPrices", context.engravingBookPrices());
        return values;
    }

    private JsonNode unavailableAccessoryRecommendation() {
        return toJsonNode(orderedMap(
            "Status", "unavailable",
            "TopRecommendation", null,
            "Comparisons", List.of(),
            "MissingInputs", List.of("악세사리 경매장 후보")
        ));
    }

    private String latest(List<String> values) {
        return values.stream().filter(value -> value != null && !value.isBlank()).max(Comparator.naturalOrder()).orElse(null);
    }

    private String text(JsonNode node, String... keys) {
        String value = textOrNull(node, keys);
        return value == null ? "" : value;
    }

    private String textOrNull(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value != null && !value.isNull() && !value.asString().isBlank()) {
                return value.asString();
            }
        }

        return null;
    }

    private record AccessorySearchBundle(
        boolean available,
        List<JsonNode> candidates,
        List<Map<String, Object>> searchSummary,
        String updatedAt
    ) {
    }
}
