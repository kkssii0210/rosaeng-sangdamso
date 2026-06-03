package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SgguPromptBuilderTest {

    private final SgguPromptBuilder builder = new SgguPromptBuilder();

    @Test
    void buildsMainChatStructuredSchemaRulesAndGroundedUserMessage() {
        var messages = builder.build(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            List.of(Map.of("role", "assistant", "content", "후보를 볼게.")),
            toJsonNode(Map.of("profile", Map.of("characterName", "붐버")))
        );

        assertThat(messages).hasSize(3);
        assertThat(messages.get(0)).containsEntry("role", "system");
        assertThat(messages.get(0).get("content"))
            .contains("로스트아크 성장 상담사 슥구")
            .contains("JSON object only")
            .contains("Mood")
            .contains("Empathy")
            .contains("Diagnosis")
            .contains("Recommendation")
            .contains("Caution")
            .contains("NextAction")
            .contains("DisplayText")
            .contains("제공된 데이터와 계산 결과만")
            .contains("가격, 상승량, 회수값, 효율 점수")
            .contains("추천 순서를 바꾸지 마");
        assertThat(messages.get(1)).containsEntry("role", "assistant");
        assertThat(messages.get(2)).containsEntry("role", "user");
        assertThat(messages.get(2).get("content"))
            .contains("Mode: main-chat")
            .contains("자연스러운 채팅 답변")
            .contains("DisplayText는 2~5문장")
            .contains("NextAction은 가장 먼저 할 1개 행동")
            .contains("[캐릭터 데이터]")
            .contains("\"characterName\":\"붐버\"")
            .contains("[유저 질문]")
            .contains("뭐부터 올릴까?");
    }

    @Test
    void buildsEfficiencySummaryCardInstructions() {
        var messages = builder.build(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "효율 요약해줘.",
            List.of(),
            toJsonNode(Map.of(
                "recommendations",
                List.of(
                    Map.of("name", "7겁 보석", "efficiencyScore", 12.4),
                    Map.of("name", "무기 강화", "efficiencyScore", 8.1)
                )
            ))
        );

        assertThat(messages).hasSize(2);
        assertThat(messages.get(0)).containsEntry("role", "system");
        assertThat(messages.get(0).get("content"))
            .contains("JSON object only")
            .contains("추천 순서를 바꾸지 마");
        assertThat(messages.get(1)).containsEntry("role", "user");
        assertThat(messages.get(1).get("content"))
            .contains("Mode: efficiency-summary")
            .contains("효율 페이지 상담 카드")
            .contains("Diagnosis에는 효율 결과의 핵심 판단")
            .contains("Recommendation에는 제공된 추천 순서대로")
            .contains("Caution에는 계산 caveat")
            .contains("NextAction에는 사용자가 바로 확인할 1개 행동")
            .contains("\"name\":\"7겁 보석\"")
            .contains("\"name\":\"무기 강화\"");
    }

    @Test
    void buildsIntentInstructionsAndPoliteSgguVoiceRules() {
        var messages = builder.build(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.COMPARISON,
            "무기 강화랑 보석 중 뭐가 나아요?",
            List.of(),
            toJsonNode(Map.of("profile", Map.of("characterName", "붐버")))
        );

        assertThat(messages.get(0).get("content"))
            .contains("사용자의 실제 질문에 먼저 답한다")
            .contains("존댓말 슥구체")
            .contains("확인했슥니다")
            .contains("확인했슥습니다 금지")
            .contains("좋슥다")
            .contains("무섭슥다")
            .contains("하슥다");
        assertThat(messages.getLast().get("content"))
            .contains("Intent: comparison")
            .contains("비교 질문이므로")
            .contains("비교 기준")
            .contains("정보가 부족하면 질문 1개");
    }

    @Test
    void buildsInvestmentRiskInstructions() {
        var messages = builder.build(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.INVESTMENT_RISK,
            "이 악세 사도 될까요?",
            List.of(),
            toJsonNode(Map.of("profile", Map.of("characterName", "붐버")))
        );

        assertThat(messages.getLast().get("content"))
            .contains("Intent: investment-risk")
            .contains("위험하면 부드럽지만 단호하게")
            .contains("없는 가격이나 시세를 만들지 않는다");
    }

    @Test
    void legacyBuildDelegatesToMainChatMode() {
        var messages = builder.build(
            "뭐부터 올릴까?",
            List.of(),
            toJsonNode(Map.of("profile", Map.of("characterName", "붐버")))
        );

        assertThat(messages.getLast().get("content")).contains("Mode: main-chat");
    }
}
