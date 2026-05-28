package com.rosaeng.sangdamso.character.avatar;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class AvatarNormalizerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AvatarNormalizer normalizer = new AvatarNormalizer();

    @Test
    void normalizesAvatarStatEffectsFromTooltip() throws Exception {
        JsonNode normalized = normalizer.normalize(objectMapper.convertValue(List.of(Map.of(
            "Type", "무기 아바타",
            "Name", "탐식하는 도약의 데스사이드",
            "Icon", "https://cdn-lostark.game.onstove.com/sample-avatar.png",
            "Grade", "전설",
            "IsInner", true,
            "IsSet", false,
            "Tooltip", tooltip("민첩 +2.00%", true, false)
        )), JsonNode.class));

        JsonNode avatar = normalized.get(0);

        assertThat(avatar.get("Type").asString()).isEqualTo("무기 아바타");
        assertThat(avatar.get("IsInner").asBoolean()).isTrue();
        assertThat(avatar.get("IsStatApplied").asBoolean()).isTrue();
        assertThat(avatar.get("IsSet").asBoolean()).isFalse();
        assertThat(avatar.get("StatEffects").get(0).get("Stat").asString()).isEqualTo("민첩");
        assertThat(avatar.get("StatEffects").get(0).get("Value").asDouble()).isEqualTo(2.0);
        assertThat(avatar.get("StatEffects").get(0).get("Text").asString()).isEqualTo("민첩 +2.00%");
    }

    @Test
    void keepsCosmeticAvatarsWithoutCombatStatEffects() throws Exception {
        JsonNode normalized = normalizer.normalize(objectMapper.convertValue(List.of(Map.of(
            "Type", "얼굴1 아바타",
            "Name", "찬란한 얼굴",
            "Grade", "영웅",
            "IsInner", false,
            "IsSet", false,
            "Tooltip", tooltip("", false, false)
        )), JsonNode.class));

        assertThat(normalized.get(0).get("StatEffects").size()).isZero();
        assertThat(normalized.get(0).get("IsStatApplied").asBoolean()).isFalse();
    }

    private String tooltip(String statLine, boolean isInner, boolean isSet) throws Exception {
        return objectMapper.writeValueAsString(Map.of(
            "AvatarAttribute", Map.of("IsInner", isInner, "IsSet", isSet),
            "Element_001", Map.of(
                "type", "ItemTitle",
                "value", Map.of("qualityValue", -1)
            ),
            "Element_005", Map.of(
                "type", "ItemPartBox",
                "value", Map.of(
                    "Element_000", "<FONT COLOR='#A9D0F5'>기본 효과</FONT>",
                    "Element_001", statLine
                )
            )
        ));
    }
}
