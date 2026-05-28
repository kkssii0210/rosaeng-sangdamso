package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class SgguContextBuilderTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SgguContextBuilder builder = new SgguContextBuilder();

    @Test
    void buildsCompactContextFromArmoryAndRecommendation() throws Exception {
        JsonNode armory = objectMapper.readTree("""
            {
              "profile": {
                "CharacterName": "붐버",
                "ServerName": "루페온",
                "CharacterClassName": "스카우터",
                "ItemAvgLevel": "1700.00",
                "CharacterLevel": 70,
                "CombatPower": 123456
              },
              "equipment": [
                {"Type": "목걸이", "Name": "테스트 목걸이", "MainStatValue": 12000, "SpecialOptionSummary": ["추피 상"]},
                {"Type": "무기", "Name": "테스트 무기", "MainStatValue": 1000}
              ],
              "gems": [{"SkillName": "라이징 스피어", "Level": 10}],
              "engravings": [{"Name": "아드레날린", "Level": 4}]
            }
            """);
        JsonNode recommendation = objectMapper.readTree("""
            {
              "Recommendation": {
                "TopCandidates": [
                  {"Type": "gem", "Label": "10멸 라이징 스피어", "NetCostGold": 300000, "GainPercent": 2.5}
                ]
              }
            }
            """);

        JsonNode context = toJsonNode(builder.build(armory, recommendation));

        assertThat(context.get("profile").get("characterName").asString()).isEqualTo("붐버");
        assertThat(context.get("accessories")).hasSize(1);
        assertThat(context.get("keyEquipment")).hasSize(1);
        assertThat(context.get("gemSummary").get(0).asString()).isEqualTo("라이징 스피어 10레벨");
        assertThat(context.get("engravingSummary").asString()).isEqualTo("아드레날린 4");
        assertThat(context.get("topSpecUps").get(0).get("label").asString()).isEqualTo("10멸 라이징 스피어");
    }

    @Test
    void normalizesConversationRolesAndLimitsTurns() {
        JsonNode conversation = toJsonNode(Map.of(
            "conversation",
            java.util.stream.IntStream.range(0, 10)
                .mapToObj(index -> Map.of(
                    "role", index % 2 == 0 ? "sggu" : "user",
                    "content", " turn " + index + " "
                ))
                .toList()
        ));

        var normalized = builder.normalizeConversation(conversation.get("conversation"));

        assertThat(normalized).hasSize(8);
        assertThat(normalized.get(0)).containsEntry("content", "turn 2");
        assertThat(normalized.get(0)).containsEntry("role", "assistant");
    }
}
