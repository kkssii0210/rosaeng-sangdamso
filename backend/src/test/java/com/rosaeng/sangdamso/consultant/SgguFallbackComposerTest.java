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
}
