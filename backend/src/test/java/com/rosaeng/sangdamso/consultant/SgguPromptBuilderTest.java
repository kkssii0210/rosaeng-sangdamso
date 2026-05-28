package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SgguPromptBuilderTest {

    private final SgguPromptBuilder builder = new SgguPromptBuilder();

    @Test
    void buildsSystemConversationAndGroundedUserMessage() {
        var messages = builder.build(
            "뭐부터 올릴까?",
            List.of(Map.of("role", "assistant", "content", "후보를 볼게.")),
            toJsonNode(Map.of("profile", Map.of("characterName", "붐버")))
        );

        assertThat(messages).hasSize(3);
        assertThat(messages.get(0)).containsEntry("role", "system");
        assertThat(messages.get(0).get("content")).contains("로스트아크 성장 상담사 슥구");
        assertThat(messages.get(1)).containsEntry("role", "assistant");
        assertThat(messages.get(2)).containsEntry("role", "user");
        assertThat(messages.get(2).get("content"))
            .contains("[캐릭터 데이터]")
            .contains("\"characterName\":\"붐버\"")
            .contains("[유저 질문]")
            .contains("뭐부터 올릴까?");
    }
}
