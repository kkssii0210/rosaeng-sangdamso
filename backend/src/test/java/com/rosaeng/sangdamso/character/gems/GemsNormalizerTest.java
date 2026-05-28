package com.rosaeng.sangdamso.character.gems;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class GemsNormalizerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final GemsNormalizer normalizer = new GemsNormalizer();

    @Test
    void normalizesEquippedGemsWithSkillAndAdditionalEffects() throws Exception {
        JsonNode normalized = normalizer.normalize(objectMapper.convertValue(Map.of(
            "Gems", List.of(
                gem(1, "10레벨 광휘의 보석", "데스 오더", "재사용 대기시간", "24.00", "감소"),
                gem(0, "10레벨 광휘의 보석", "글러트니", "피해", "44.00", "증가")
            )
        ), JsonNode.class));

        assertThat(normalized.size()).isEqualTo(2);
        JsonNode damageGem = normalized.get(0);
        JsonNode cooldownGem = normalized.get(1);

        assertThat(damageGem.get("Slot").asInt()).isEqualTo(0);
        assertThat(damageGem.get("Name").asString()).isEqualTo("10레벨 광휘의 보석");
        assertThat(damageGem.get("SkillName").asString()).isEqualTo("글러트니");
        assertThat(damageGem.get("EffectType").asString()).isEqualTo("damage");
        assertThat(damageGem.get("EffectTypeText").asString()).isEqualTo("피해");
        assertThat(damageGem.get("EffectValue").asDouble()).isEqualTo(44.0);
        assertThat(damageGem.get("AdditionalEffects").get(0).get("Name").asString()).isEqualTo("기본 공격력");
        assertThat(damageGem.get("AdditionalEffects").get(0).get("Value").asDouble()).isEqualTo(1.2);
        assertThat(damageGem.get("SummaryText").asString()).isEqualTo("글러트니 피해 44.00%");
        assertThat(cooldownGem.get("SkillName").asString()).isEqualTo("데스 오더");
        assertThat(cooldownGem.get("EffectType").asString()).isEqualTo("cooldown");
    }

    private Map<String, Object> gem(int slot, String name, String skillName, String effectType, String value, String direction)
        throws Exception {
        return Map.of(
            "Slot", slot,
            "Name", "<P ALIGN='CENTER'><FONT COLOR='#E3C7A1'>" + name + "</FONT></P>",
            "Icon", "https://cdn-lostark.game.onstove.com/sample-gem.png",
            "Level", 10,
            "Grade", "고대",
            "Tooltip", tooltip(
                "[소울이터] <FONT COLOR='#FFD200'>" + skillName + "</FONT> " + effectType + " " + value + "% " + direction,
                "",
                "<FONT COLOR='#A9D0F5'>추가 효과</FONT>",
                "기본 공격력 1.20% 증가"
            )
        );
    }

    private String tooltip(String... effectLines) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
            "Element_001", Map.of(
                "type", "ItemTitle",
                "value", Map.of(
                    "leftStr2", "<FONT SIZE='14'>아이템 레벨 1640 (티어 4)</FONT>",
                    "qualityValue", -1
                )
            ),
            "Element_006", Map.of(
                "type", "ItemPartBox",
                "value", Map.of(
                    "Element_000", "<FONT COLOR='#A9D0F5'>효과</FONT>",
                    "Element_001", String.join("<BR>", effectLines)
                )
            )
        ));
    }
}
