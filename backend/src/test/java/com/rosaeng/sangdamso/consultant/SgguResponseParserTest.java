package com.rosaeng.sangdamso.consultant;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class SgguResponseParserTest {

    private final SgguResponseParser parser = new SgguResponseParser(new ObjectMapper());

    @Test
    void parsesRawStructuredJson() {
        SgguConsultationResponse response = parser.parse(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            """
                {
                  "Mood": "warm-but-firm",
                  "Empathy": "후보가 많아서 헷갈릴 수 있어.",
                  "Diagnosis": "보석 효율이 안정적이야.",
                  "Recommendation": "1순위는 7겁 보석 교체야.",
                  "Caution": "악세는 회수값 변동이 있어.",
                  "NextAction": "보석 가격을 먼저 확인해줘.",
                  "DisplayText": "지금은 보석부터 보는 게 좋아."
                }
                """
        );

        assertThat(response.mode()).isEqualTo(SgguConsultationMode.EFFICIENCY_SUMMARY);
        assertThat(response.source()).isEqualTo("llm");
        assertThat(response.mood()).isEqualTo("warm-but-firm");
        assertThat(response.recommendation()).contains("7겁 보석");
        assertThat(response.displayText()).contains("보석부터");
    }

    @Test
    void parsesJsonWrappedInMarkdownFence() {
        SgguConsultationResponse response = parser.parse(
            SgguConsultationMode.MAIN_CHAT,
            """
                ```json
                {
                  "Mood": "warm-but-firm",
                  "Diagnosis": "무기 강화보다 보석이 먼저야.",
                  "Recommendation": "보석 후보를 먼저 보자.",
                  "NextAction": "거래소 가격을 확인해줘.",
                  "DisplayText": "지금은 보석을 먼저 보는 게 좋아."
                }
                ```
                """
        );

        assertThat(response.mode()).isEqualTo(SgguConsultationMode.MAIN_CHAT);
        assertThat(response.source()).isEqualTo("llm");
        assertThat(response.empathy()).isEqualTo("");
        assertThat(response.caution()).isEqualTo("");
    }

    @Test
    void rejectsMalformedJson() {
        try {
            parser.parse(SgguConsultationMode.MAIN_CHAT, "지금은 보석부터 보는 게 좋아.");
        } catch (SgguResponseParser.InvalidSgguResponseException exception) {
            assertThat(exception.getMessage()).contains("valid JSON");
            return;
        }

        throw new AssertionError("Expected InvalidSgguResponseException");
    }

    @Test
    void rejectsMissingRequiredFields() {
        try {
            parser.parse(
                SgguConsultationMode.MAIN_CHAT,
                """
                    {
                      "Mood": "warm-but-firm",
                      "Diagnosis": "보석이 먼저야.",
                      "DisplayText": "보석부터 보자."
                    }
                    """
            );
        } catch (SgguResponseParser.InvalidSgguResponseException exception) {
            assertThat(exception.getMessage()).contains("Recommendation");
            return;
        }

        throw new AssertionError("Expected InvalidSgguResponseException");
    }
}
