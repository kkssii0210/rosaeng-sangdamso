package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class AccessoryNormalizerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AccessoryNormalizer normalizer = new AccessoryNormalizer();

    @Test
    void buildsRefinementSearchOptionsFromCurrentAccessory() {
        JsonNode accessory = toJsonNode(orderedMap(
            "Type", "목걸이",
            "DetailSections", List.of(orderedMap(
                "title", "연마 효과",
                "lines", List.of("추가 피해 +1.50%", "적에게 주는 피해 +0.90%")
            ))
        ));

        List<AccessoryNormalizer.SearchOption> options = normalizer.buildRefinementSearchOptions(accessory);

        assertThat(options).extracting(AccessoryNormalizer.SearchOption::secondOption).containsExactly(41, 42);
        assertThat(options).extracting(AccessoryNormalizer.SearchOption::minValue).containsExactly(150, 90);
        assertThat(options).extracting(AccessoryNormalizer.SearchOption::label)
            .containsExactly("추가 피해 1.50% 이상", "적에게 주는 피해 0.90% 이상");
    }

    @Test
    void normalizesAuctionAccessoryItem() {
        JsonNode raw = toJsonNode(orderedMap(
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
        ));

        JsonNode accessory = normalizer.normalizeAuctionAccessoryItem(raw, "목걸이");

        assertThat(accessory.get("Type").asString()).isEqualTo("목걸이");
        assertThat(accessory.get("BuyPrice").asInt()).isEqualTo(12345);
        assertThat(accessory.get("MainStatValue").asInt()).isEqualTo(12000);
        assertThat(accessory.get("EnlightenmentPoint").asInt()).isEqualTo(13);
        assertThat(accessory.get("DetailSections").get(0).get("title").asString()).isEqualTo("기본 효과");
        assertThat(accessory.get("DetailSections").get(1).get("title").asString()).isEqualTo("연마 효과");
    }

    @Test
    void rejectsIneligibleAccessoryCandidate() {
        JsonNode accessory = toJsonNode(orderedMap(
            "Type", "목걸이",
            "Grade", "고대",
            "Tier", 4,
            "Quality", 70,
            "BuyPrice", 10,
            "EnlightenmentPoint", 13
        ));

        AccessoryNormalizer.Eligibility eligibility = normalizer.isEligibleAccessoryCandidate(accessory);

        assertThat(eligibility.eligible()).isFalse();
        assertThat(eligibility.reason()).isEqualTo("QUALITY_BELOW_MAX_ENLIGHTENMENT_THRESHOLD");
    }

    private JsonNode toJsonNode(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }
}
