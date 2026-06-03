package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class SgguFallbackComposerTest {

    private final SgguFallbackComposer composer = new SgguFallbackComposer();

    @Test
    void buildsEfficiencySummaryFromTopCandidate() {
        JsonNode context = toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버"),
            "topSpecUps", List.of(orderedMap(
                "label", "무기 11->12",
                "costGold", 100000,
                "gainPercent", 0.3,
                "caveat", "노숨 기대비용 기준"
            ))
        ));

        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "전투력 효율 결과를 상담 카드로 요약해줘",
            context
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.mode()).isEqualTo(SgguConsultationMode.EFFICIENCY_SUMMARY);
        assertThat(response.mood()).isEqualTo("warm-but-firm");
        assertThat(response.diagnosis()).contains("무기 11->12");
        assertThat(response.recommendation()).contains("100,000", "0.3");
        assertThat(response.caution()).contains("노숨 기대비용 기준");
        assertThat(response.nextAction()).contains("경매장");
        assertThat(response.displayText()).contains("무기 11->12", "100,000", "0.3", "노숨 기대비용 기준");
    }

    @Test
    void buildsMainChatFallbackWhenNoCandidateExists() {
        JsonNode context = toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버"),
            "topSpecUps", List.of()
        ));

        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            context
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.mood()).isEqualTo("warm-but-firm");
        assertThat(response.displayText()).contains("계산 결과");
        assertThat(response.nextAction()).contains("추천 후보");
    }

    @Test
    void buildsComparisonFallbackWithoutGenericFirstCandidateCopy() {
        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.COMPARISON,
            "무기 강화랑 보석 중 뭐가 나아요?",
            contextWithCandidate()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.displayText()).contains("비교", "예산");
        assertThat(response.displayText()).doesNotContain("먼저 보는 게 좋아.");
    }

    @Test
    void buildsComparisonFallbackWithoutImplyingMissingCandidateExists() {
        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.COMPARISON,
            "무기 강화랑 보석 중 뭐가 나아요?",
            contextWithoutCandidate()
        );

        String responseText = response.displayText() + " " + response.recommendation();
        assertThat(responseText)
            .doesNotContain("후보은")
            .doesNotContain("현재 제공된 후보은 후보로 보이지만")
            .containsAnyOf("두 선택지", "예산");
    }

    @Test
    void buildsInvestmentRiskFallbackWithPoliteWarning() {
        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.INVESTMENT_RISK,
            "이 악세 지금 사도 될까요?",
            contextWithCandidate()
        );

        assertThat(response.displayText()).contains("위험하슥니다");
        assertThat(response.nextAction()).contains("가격", "거래 가능 횟수");
    }

    @Test
    void buildsOffTopicFallbackThatSteersBackToLostArk() {
        SgguConsultationResponse response = composer.compose(
            SgguConsultationMode.MAIN_CHAT,
            SgguConsultationIntent.OFF_TOPIC,
            "오늘 점심 뭐 먹을까요?",
            contextWithCandidate()
        );

        assertThat(response.displayText()).contains("로스트아크", "스펙업");
    }

    @Test
    void fallbackVoiceAvoidsKnownBrokenSgguForms() {
        List<SgguConsultationResponse> responses = List.of(
            composer.compose(
                SgguConsultationMode.MAIN_CHAT,
                SgguConsultationIntent.GROWTH_PRIORITY,
                "뭐부터 올릴까요?",
                contextWithCandidate()
            ),
            composer.compose(
                SgguConsultationMode.MAIN_CHAT,
                SgguConsultationIntent.COMPARISON,
                "무기 강화랑 보석 중 뭐가 나아요?",
                contextWithCandidate()
            ),
            composer.compose(
                SgguConsultationMode.MAIN_CHAT,
                SgguConsultationIntent.INVESTMENT_RISK,
                "이 악세 지금 사도 될까요?",
                contextWithCandidate()
            ),
            composer.compose(
                SgguConsultationMode.MAIN_CHAT,
                SgguConsultationIntent.DATA_LIMITED,
                "상담해주세요",
                contextWithCandidate()
            ),
            composer.compose(
                SgguConsultationMode.MAIN_CHAT,
                SgguConsultationIntent.OFF_TOPIC,
                "오늘 점심 뭐 먹을까요?",
                contextWithCandidate()
            )
        );

        assertThat(responses)
            .extracting(this::allResponseText)
            .allSatisfy(text -> assertThat(text)
                .doesNotContain("확인했슥습니다")
                .doesNotContain("좋슥다")
                .doesNotContain("무섭슥다")
                .doesNotContain("하슥다"));
    }

    private String allResponseText(SgguConsultationResponse response) {
        return String.join(" ",
            response.mood(),
            response.empathy(),
            response.diagnosis(),
            response.recommendation(),
            response.caution(),
            response.nextAction(),
            response.displayText()
        );
    }

    private JsonNode contextWithoutCandidate() {
        return toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버", "className", "스카우터"),
            "topSpecUps", List.of()
        ));
    }

    private JsonNode contextWithCandidate() {
        return toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버", "className", "스카우터"),
            "topSpecUps", List.of(orderedMap(
                "label", "무기 11->12",
                "costGold", 100000,
                "gainPercent", 0.3,
                "caveat", "노숨 기대비용 기준"
            ))
        ));
    }
}
