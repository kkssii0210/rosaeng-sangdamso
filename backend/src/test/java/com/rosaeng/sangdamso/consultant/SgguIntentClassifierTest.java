package com.rosaeng.sangdamso.consultant;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SgguIntentClassifierTest {

    private final SgguIntentClassifier classifier = new SgguIntentClassifier();

    @Test
    void classifiesGrowthPriorityQuestions() {
        assertThat(classifier.classify("뭐부터 올리면 좋을까요?", List.of()))
            .isEqualTo(SgguConsultationIntent.GROWTH_PRIORITY);
        assertThat(classifier.classify("스펙업 우선순위 알려주세요", List.of()))
            .isEqualTo(SgguConsultationIntent.GROWTH_PRIORITY);
    }

    @Test
    void classifiesCharacterReviewQuestions() {
        assertThat(classifier.classify("제 캐릭터 문제점 봐주세요", List.of()))
            .isEqualTo(SgguConsultationIntent.CHARACTER_REVIEW);
        assertThat(classifier.classify("현재 상태 진단해줘", List.of()))
            .isEqualTo(SgguConsultationIntent.CHARACTER_REVIEW);
    }

    @Test
    void classifiesComparisonBeforeGrowthPriority() {
        assertThat(classifier.classify("무기 강화랑 보석 중 뭐부터 가는 게 나아요?", List.of()))
            .isEqualTo(SgguConsultationIntent.COMPARISON);
        assertThat(classifier.classify("무기 vs 보석 비교해주세요", List.of()))
            .isEqualTo(SgguConsultationIntent.COMPARISON);
    }

    @Test
    void classifiesInvestmentRiskQuestions() {
        assertThat(classifier.classify("이 악세 지금 사도 될까요?", List.of()))
            .isEqualTo(SgguConsultationIntent.INVESTMENT_RISK);
        assertThat(classifier.classify("지금 강화 질러도 괜찮나요?", List.of()))
            .isEqualTo(SgguConsultationIntent.INVESTMENT_RISK);
        assertThat(classifier.classify("이 악세 매물 어때요, 사도 될까요?", List.of()))
            .isEqualTo(SgguConsultationIntent.INVESTMENT_RISK);
    }

    @Test
    void classifiesDataLimitedQuestions() {
        assertThat(classifier.classify("상담해주세요", List.of()))
            .isEqualTo(SgguConsultationIntent.DATA_LIMITED);
        assertThat(classifier.classify("   ", List.of()))
            .isEqualTo(SgguConsultationIntent.DATA_LIMITED);
    }

    @Test
    void classifiesOffTopicQuestions() {
        assertThat(classifier.classify("오늘 점심 뭐 먹을까요?", List.of()))
            .isEqualTo(SgguConsultationIntent.OFF_TOPIC);
        assertThat(classifier.classify("날씨 어때요?", List.of()))
            .isEqualTo(SgguConsultationIntent.OFF_TOPIC);
    }

    @Test
    void canUseRecentConversationTextForShortFollowUp() {
        assertThat(classifier.classify(
            "이거 사도 될까요?",
            List.of(Map.of("role", "user", "content", "고대 악세 매물을 보고 있어요."))
        )).isEqualTo(SgguConsultationIntent.INVESTMENT_RISK);
    }

    @Test
    void currentCharacterReviewOverridesPriorInvestmentConversation() {
        assertThat(classifier.classify(
            "현재 상태 봐주세요",
            List.of(Map.of("role", "user", "content", "고대 악세 매물을 보고 있어요."))
        )).isEqualTo(SgguConsultationIntent.CHARACTER_REVIEW);
    }

    @Test
    void currentGrowthPriorityOverridesPriorInvestmentConversation() {
        assertThat(classifier.classify(
            "뭐부터 올릴까요?",
            List.of(Map.of("role", "user", "content", "고대 악세 매물을 보고 있어요."))
        )).isEqualTo(SgguConsultationIntent.GROWTH_PRIORITY);
    }

    @Test
    void conjunctionAloneDoesNotClassifyAsComparison() {
        assertThat(classifier.classify("친구랑 레이드 가도 돼?", List.of()))
            .isEqualTo(SgguConsultationIntent.INVESTMENT_RISK);
        assertThat(classifier.classify("강화하고 싶은데 뭐가 좋나요?", List.of()))
            .isNotEqualTo(SgguConsultationIntent.COMPARISON);
    }

    @Test
    void ignoresSystemConversationWhenClassifyingHistoryBackedRisk() {
        assertThat(classifier.classify(
            "상담해주세요",
            List.of(Map.of("role", "system", "content", "고대 악세 매물 구매 사도 될지 확인"))
        )).isEqualTo(SgguConsultationIntent.DATA_LIMITED);
    }
}
