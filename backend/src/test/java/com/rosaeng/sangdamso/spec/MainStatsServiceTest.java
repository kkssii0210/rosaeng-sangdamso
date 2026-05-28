package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class MainStatsServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final MainStatsService service = new MainStatsService();

    @Test
    void buildsInternalMainStatTotalFromNormalizedEquipmentValues() {
        JsonNode summary = service.build(objectMapper.convertValue(List.of(
            Map.of("Type", "무기", "Name", "무기"),
            Map.of("Type", "투구", "Name", "투구", "MainStatValue", 139346),
            Map.of("Type", "목걸이", "Name", "목걸이", "MainStatValue", 17831),
            Map.of("Type", "팔찌", "Name", "팔찌", "MainStatValue", 1200)
        ), JsonNode.class));

        assertThat(summary.get("MainStatTotal").asInt()).isEqualTo(158377);
        assertThat(summary.get("Items").size()).isEqualTo(3);
        assertThat(summary.get("Items").get(0).get("Type").asString()).isEqualTo("투구");
        assertThat(summary.get("Items").get(0).get("Value").asInt()).isEqualTo(139346);
        assertThat(summary.get("Items").get(2).get("Type").asString()).isEqualTo("팔찌");
    }
}
