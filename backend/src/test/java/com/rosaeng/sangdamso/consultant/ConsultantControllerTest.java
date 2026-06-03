package com.rosaeng.sangdamso.consultant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rosaeng.sangdamso.common.GlobalExceptionHandler;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ConsultantController.class)
@Import({GlobalExceptionHandler.class, ConsultantControllerTest.TestConfig.class})
class ConsultantControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FakeSgguConsultationService consultationService;

    @BeforeEach
    void resetService() {
        consultationService.reset();
    }

    @Test
    void rejectsBlankMessage() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"   \"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_MESSAGE"))
            .andExpect(jsonPath("$.message").value("상담할 내용을 입력해줘."));

        assertThat(consultationService.message).isNull();
    }

    @Test
    void rejectsMissingArmoryBeforeCallingConsultationService() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"상담해줘\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_ARMORY"))
            .andExpect(jsonPath("$.message").value("캐릭터를 먼저 조회해줘."));

        assertThat(consultationService.message).isNull();
    }

    @Test
    void rejectsBlankCharacterProfileBeforeCallingConsultationService() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "message": "상담해줘",
                      "armory": {"profile": {}}
                    }
                    """))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_ARMORY"))
            .andExpect(jsonPath("$.message").value("캐릭터를 먼저 조회해줘."));

        assertThat(consultationService.message).isNull();
    }

    @Test
    void returnsStructuredMainChatResponseWithCompactContext() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "message": "뭐부터 올릴까?",
                      "conversation": [
                        {"role": "user", "content": "현재 상태 봐줘"},
                        {"role": "sggu", "content": "후보를 볼게."}
                      ],
                      "context": {
                        "profile": {"characterName": "붐버", "className": "스카우터"},
                        "topSpecUps": [{"label": "무기 11->12", "gainPercent": 0.3}]
                      }
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.Mode").value("main-chat"))
            .andExpect(jsonPath("$.Source").value("llm"))
            .andExpect(jsonPath("$.Mood").value("warm-but-firm"))
            .andExpect(jsonPath("$.Recommendation").value("지금은 보석부터 올려."))
            .andExpect(jsonPath("$.DisplayText").value("지금은 보석부터 올려."));

        assertThat(consultationService.mode).isEqualTo(SgguConsultationMode.MAIN_CHAT);
        assertThat(consultationService.message).isEqualTo("뭐부터 올릴까?");
        assertThat(consultationService.conversation)
            .containsExactly(
                Map.of("role", "user", "content", "현재 상태 봐줘"),
                Map.of("role", "assistant", "content", "후보를 볼게.")
            );
        assertThat(consultationService.context.toString())
            .contains("\"characterName\":\"붐버\"")
            .contains("\"label\":\"무기 11->12\"");
    }

    @Test
    void acceptsEfficiencySummaryModeAndBuildsContextFromArmory() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "mode": "efficiency-summary",
                      "message": "상담해줘",
                      "armory": {"profile": {"CharacterName": "붐버", "CharacterClassName": "스카우터"}},
                      "specUpRecommendation": {
                        "Recommendation": {
                          "TopCandidates": [{"Label": "무기 11->12", "GainPercent": 0.3}]
                        }
                      }
                    }
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.Mode").value("efficiency-summary"));

        assertThat(consultationService.mode).isEqualTo(SgguConsultationMode.EFFICIENCY_SUMMARY);
        assertThat(consultationService.context.toString())
            .contains("\"characterName\":\"붐버\"")
            .contains("\"className\":\"스카우터\"")
            .contains("\"label\":\"무기 11->12\"");
    }

    @TestConfiguration
    static class TestConfig {

        @Bean
        SgguContextBuilder sgguContextBuilder() {
            return new SgguContextBuilder();
        }

        @Bean
        FakeSgguConsultationService consultationService() {
            return new FakeSgguConsultationService();
        }
    }

    static class FakeSgguConsultationService extends SgguConsultationService {

        private SgguConsultationMode mode;
        private String message;
        private List<Map<String, String>> conversation;
        private tools.jackson.databind.JsonNode context;

        FakeSgguConsultationService() {
            super(null, null, null, null, null);
        }

        @Override
        public SgguConsultationResponse consult(
            SgguConsultationMode mode,
            String message,
            List<Map<String, String>> conversation,
            tools.jackson.databind.JsonNode context
        ) {
            this.mode = mode;
            this.message = message;
            this.conversation = conversation;
            this.context = context;

            return new SgguConsultationResponse(
                mode,
                "llm",
                "warm-but-firm",
                "공감",
                "진단",
                "지금은 보석부터 올려.",
                "주의",
                "다음 행동",
                "지금은 보석부터 올려."
            );
        }

        void reset() {
            mode = null;
            message = null;
            conversation = null;
            context = null;
        }
    }
}
