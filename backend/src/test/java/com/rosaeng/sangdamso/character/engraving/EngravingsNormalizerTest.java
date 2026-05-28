package com.rosaeng.sangdamso.character.engraving;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class EngravingsNormalizerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final EngravingsNormalizer normalizer = new EngravingsNormalizer();

    @Test
    void normalizesArkPassiveEngravingsWithPositiveEfficiencyMetrics() {
        JsonNode normalized = normalizer.normalize(objectMapper.convertValue(Map.of(
            "ArkPassiveEffects", List.of(
                Map.of(
                    "AbilityStoneLevel", 1,
                    "Grade", "유물",
                    "Level", 4,
                    "Name", "저주받은 인형",
                    "Description", "적에게 주는 피해가 <FONT COLOR='#99ff99'>20.00%</FONT> 증가하지만, 받는 모든 회복 효과가 <FONT COLOR='#ff9999'>25.00%</FONT> 감소한다."
                ),
                Map.of(
                    "Grade", "전설",
                    "Level", 2,
                    "Name", "약자 무시",
                    "Description", "생명력이 <FONT COLOR='#ffff99'>30%</FONT> 이하인 적 타격 시 주는 피해가 <FONT COLOR='#99ff99'>22.00%</FONT> 증가한다."
                )
            )
        ), JsonNode.class));

        assertThat(normalized.size()).isEqualTo(2);
        assertThat(normalized.get(0).get("Name").asString()).isEqualTo("저주받은 인형");
        assertThat(normalized.get(0).get("Icon").asString()).isEqualTo("https://lostarkcodex.com/icons/buff_237.webp");
        assertThat(normalized.get(0).get("Description").asString())
            .isEqualTo("적에게 주는 피해가 20.00% 증가하지만, 받는 모든 회복 효과가 25.00% 감소한다.");
        assertThat(normalized.get(0).get("EfficiencyText").asString()).isEqualTo("20.00%");
        assertThat(normalized.get(0).get("Metrics").get(0).asString()).isEqualTo("20.00%");
        assertThat(normalized.get(1).get("AbilityStoneLevel").isNull()).isTrue();
        assertThat(normalized.get(1).get("Icon").asString()).isEqualTo("https://lostarkcodex.com/icons/achieve_04_30.webp");
    }
}
