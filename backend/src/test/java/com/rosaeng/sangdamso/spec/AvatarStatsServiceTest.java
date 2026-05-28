package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class AvatarStatsServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AvatarStatsService service = new AvatarStatsService();

    @Test
    void sumsOnlyAppliedAvatarStatEffects() {
        JsonNode summary = service.build(objectMapper.convertValue(List.of(
            Map.of("Type", "무기 아바타", "IsInner", true, "StatEffects", List.of(Map.of("Stat", "민첩", "Value", 2))),
            Map.of("Type", "머리 아바타", "IsInner", true, "StatEffects", List.of(Map.of("Stat", "민첩", "Value", 2))),
            Map.of("Type", "머리 아바타", "IsInner", false, "StatEffects", List.of(Map.of("Stat", "민첩", "Value", 1)))
        ), JsonNode.class));

        assertThat(summary.get("AppliedAvatarCount").asInt()).isEqualTo(2);
        assertThat(summary.get("IgnoredStatEffectCount").asInt()).isEqualTo(1);
        assertThat(summary.get("StatBonuses").get(0).get("Stat").asString()).isEqualTo("민첩");
        assertThat(summary.get("StatBonuses").get(0).get("Value").asDouble()).isEqualTo(4.0);
        assertThat(summary.get("StatBonuses").get(0).get("Text").asString()).isEqualTo("민첩 +4.00%");
    }
}
