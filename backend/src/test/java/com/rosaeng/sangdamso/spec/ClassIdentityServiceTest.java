package com.rosaeng.sangdamso.spec;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class ClassIdentityServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ClassIdentityService service = new ClassIdentityService();

    @Test
    void returnsClassIdentityEffectSlotsForKnownClass() {
        JsonNode result = service.getClassIdentityEffects("소울이터", null);

        assertThat(result.get("ClassName").asString()).isEqualTo("소울이터");
        assertThat(result.get("HasManualRule").asBoolean()).isTrue();
        assertThat(result.get("IdentityNames").get(0).asString()).isEqualTo("빙의 게이지");
        assertThat(result.get("Effects").get(0).get("Id").asString()).isEqualTo("souleater-full-moon-reaper-form-critical-rate");
        assertThat(result.get("Effects").get(0).get("Value").asInt()).isEqualTo(20);
        assertThat(result.get("Effects").get(0).get("IsActive").asBoolean()).isFalse();
    }

    @Test
    void activatesIdentityEffectsFromContext() {
        JsonNode souleater = service.build(objectMapper.convertValue(Map.of("CharacterClassName", "소울이터"), JsonNode.class), Map.of(
            "arkPassive", objectMapper.convertValue(Map.of("Effects", List.of(Map.of("Description", "깨달음 2티어 만월의 집행자 Lv.3"))), JsonNode.class),
            "engravings", objectMapper.createArrayNode()
        ));
        JsonNode berserker = service.build(objectMapper.convertValue(Map.of("CharacterClassName", "버서커"), JsonNode.class), Map.of(
            "arkPassive", objectMapper.createObjectNode(),
            "engravings", objectMapper.convertValue(List.of(Map.of("Name", "광전사의 비기")), JsonNode.class)
        ));

        assertThat(souleater.get("Effects").get(0).get("IsActive").asBoolean()).isTrue();
        assertThat(souleater.get("Effects").get(0).get("Activation").get("MatchedArkPassiveNames").get(0).asString()).isEqualTo("만월의 집행자");
        assertThat(berserker.get("Effects").get(0).get("Id").asString()).isEqualTo("berserker-technique-burst-critical-rate");
        assertThat(berserker.get("Effects").get(0).get("Value").asInt()).isEqualTo(50);
        assertThat(berserker.get("Effects").get(0).get("IsActive").asBoolean()).isTrue();
    }

    @Test
    void returnsEmptyRuleForUnknownClass() {
        JsonNode result = service.getClassIdentityEffects("새 클래스", null);

        assertThat(result.get("ClassName").asString()).isEqualTo("새 클래스");
        assertThat(result.get("HasManualRule").asBoolean()).isFalse();
        assertThat(result.get("IdentityNames").size()).isZero();
        assertThat(result.get("Effects").size()).isZero();
    }
}
