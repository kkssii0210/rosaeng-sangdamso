package com.rosaeng.sangdamso.character.cards;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class CardsNormalizerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CardsNormalizer normalizer = new CardsNormalizer();

    @Test
    void normalizesEquippedCardsAndActiveEffects() {
        JsonNode normalized = normalizer.normalize(objectMapper.convertValue(Map.of(
            "Cards", List.of(
                Map.of(
                    "Slot", 0,
                    "Name", "유적을 찾은 카단",
                    "Icon", "https://cdn-lostark.game.onstove.com/card.png",
                    "AwakeCount", 3,
                    "AwakeTotal", 5,
                    "Grade", "전설",
                    "Tooltip", "raw tooltip should not be returned"
                ),
                Map.of(
                    "Slot", 1,
                    "Name", "각성한 진저웨일",
                    "Icon", "https://cdn-lostark.game.onstove.com/card2.png",
                    "AwakeCount", 5,
                    "AwakeTotal", 5,
                    "Grade", "전설"
                )
            ),
            "Effects", List.of(Map.of(
                "Index", 0,
                "CardSlots", List.of(0, 1),
                "Items", List.of(
                    Map.of("Name", "굳센 대지의 숨결 2세트", "Description", "뇌속성 피해 감소 +10.00%"),
                    Map.of("Name", "굳센 대지의 숨결 6세트 (12각성합계)", "Description", "공격 속성을 토속성으로 변환"),
                    Map.of("Name", "굳센 대지의 숨결 6세트 (18각성합계)", "Description", "토속성 피해 +7.00%")
                )
            ))
        ), JsonNode.class));

        assertThat(normalized.get("AwakeTotal").asInt()).isEqualTo(8);
        assertThat(normalized.get("Cards").get(0).get("Tooltip")).isNull();
        assertThat(normalized.get("Cards").get(0).get("Name").asString()).isEqualTo("유적을 찾은 카단");
        assertThat(normalized.get("Effects").get(0).get("SetName").asString()).isEqualTo("굳센 대지의 숨결");
        assertThat(normalized.get("ActiveEffects").get(0).get("Kind").asString()).isEqualTo("damageReduction");
        assertThat(normalized.get("ActiveEffects").get(0).get("Value").asDouble()).isEqualTo(10.0);
        assertThat(normalized.get("ActiveEffects").get(0).get("DamageType").asString()).isEqualTo("뇌속성");
        assertThat(normalized.get("ActiveEffects").get(1).get("Kind").asString()).isEqualTo("elementConversion");
        assertThat(normalized.get("ActiveEffects").get(1).get("Element").asString()).isEqualTo("토");
        assertThat(normalized.get("ActiveEffects").get(2).get("AwakeTotal").asInt()).isEqualTo(18);
    }
}
