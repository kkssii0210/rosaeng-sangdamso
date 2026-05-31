package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;

import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import com.rosaeng.sangdamso.lostark.LostarkProperties;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class AccessoryAuctionSearchServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void searchesMinimumThreePagesAndDeduplicatesCandidates() {
        List<JsonNode> requests = new ArrayList<>();
        LostarkApiClient client = new LostarkApiClient(
            new LostarkProperties("token", "", "https://example.com", 5, 0),
            (method, path, authorization, body) -> {
                requests.add(body);
                return auctionPage();
            }
        );
        AccessoryAuctionSearchService service = new AccessoryAuctionSearchService(client, new AccessoryNormalizer());
        JsonNode currentAccessory = toJsonNode(orderedMap(
            "Type", "목걸이",
            "DetailSections", List.of(orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")))
        ));

        AccessoryAuctionSearchService.SearchResult result = service.searchAccessoryCandidates("목걸이", currentAccessory, 6, false);

        assertThat(result.type()).isEqualTo("목걸이");
        assertThat(result.pagesFetched()).isEqualTo(3);
        assertThat(result.searchOptions()).containsExactly("추가 피해 1.50% 이상");
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).get("TargetEquipmentIndex").asInt()).isEqualTo(6);
        assertThat(requests).hasSize(3);
        assertThat(requests.get(0).get("CategoryCode").asInt()).isEqualTo(200010);
        assertThat(requests.get(0).get("EtcOptions").get(0).get("SecondOption").asInt()).isEqualTo(41);
    }

    @Test
    void recoverySearchCanKeepIneligibleAuctionEvidence() {
        LostarkApiClient client = new LostarkApiClient(
            new LostarkProperties("token", "", "https://example.com", 5, 0),
            (method, path, authorization, body) -> ineligibleAuctionPage()
        );
        AccessoryAuctionSearchService service = new AccessoryAuctionSearchService(client, new AccessoryNormalizer());
        JsonNode currentAccessory = toJsonNode(orderedMap(
            "Type", "목걸이",
            "DetailSections", List.of(orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")))
        ));

        AccessoryAuctionSearchService.SearchResult defaultResult = service.searchAccessoryCandidates("목걸이", currentAccessory, 6, false);
        AccessoryAuctionSearchService.SearchResult recoveryResult = service.searchAccessoryCandidates(
            "목걸이",
            currentAccessory,
            6,
            false,
            false
        );

        assertThat(defaultResult.items()).isEmpty();
        assertThat(recoveryResult.items()).hasSize(1);
        assertThat(recoveryResult.items().get(0).get("BuyPrice").asInt()).isEqualTo(7777);
    }

    private JsonNode auctionPage() {
        return toJsonNode(orderedMap(
            "TotalCount", 1,
            "Items", List.of(orderedMap(
                "Name", "고대 목걸이",
                "Icon", "https://example.com/icon.png",
                "Grade", "고대",
                "GradeQuality", 92,
                "Tier", 4,
                "Level", 1700,
                "AuctionInfo", orderedMap(
                    "BuyPrice", 12345,
                    "UpgradeLevel", 3,
                    "TradeAllowCount", 2,
                    "EndDate", "2026-05-29T00:00:00Z"
                ),
                "Options", List.of(
                    orderedMap("Type", "STAT", "OptionName", "힘", "Value", 12000, "IsValuePercentage", false),
                    orderedMap("Type", "STAT", "OptionName", "치명", "Value", 500, "IsValuePercentage", false),
                    orderedMap("Type", "ACCESSORY_UPGRADE", "OptionName", "추가 피해", "Value", 1.5, "IsValuePercentage", true),
                    orderedMap("Type", "ARK_PASSIVE", "OptionName", "깨달음", "Value", 13, "IsValuePercentage", false)
                )
            ))
        ));
    }

    private JsonNode ineligibleAuctionPage() {
        return toJsonNode(orderedMap(
            "TotalCount", 1,
            "Items", List.of(orderedMap(
                "Name", "저품질 목걸이",
                "Icon", "https://example.com/icon.png",
                "Grade", "고대",
                "GradeQuality", 70,
                "Tier", 4,
                "Level", 1700,
                "AuctionInfo", orderedMap(
                    "BuyPrice", 7777,
                    "UpgradeLevel", 3,
                    "TradeAllowCount", 2,
                    "EndDate", "2026-05-29T00:00:00Z"
                ),
                "Options", List.of(
                    orderedMap("Type", "STAT", "OptionName", "힘", "Value", 12000, "IsValuePercentage", false),
                    orderedMap("Type", "ACCESSORY_UPGRADE", "OptionName", "추가 피해", "Value", 1.5, "IsValuePercentage", true),
                    orderedMap("Type", "ARK_PASSIVE", "OptionName", "깨달음", "Value", 13, "IsValuePercentage", false)
                )
            ))
        ));
    }

    private JsonNode toJsonNode(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }
}
