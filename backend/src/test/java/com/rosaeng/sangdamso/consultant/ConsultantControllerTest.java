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
    private FakeLocalLlmClient localLlmClient;

    @BeforeEach
    void resetClient() {
        localLlmClient.reset();
    }

    @Test
    void rejectsBlankMessage() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"   \"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_MESSAGE"))
            .andExpect(jsonPath("$.message").value("상담할 내용을 입력해줘."));

        assertThat(localLlmClient.messages).isNull();
    }

    @Test
    void rejectsMissingArmoryBeforeCallingLocalLlm() throws Exception {
        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"message\":\"상담해줘\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_ARMORY"))
            .andExpect(jsonPath("$.message").value("캐릭터를 먼저 조회해줘."));

        assertThat(localLlmClient.messages).isNull();
    }

    @Test
    void returnsLocalLlmAnswerWithCompactContext() throws Exception {
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
            .andExpect(jsonPath("$.Answer").value("지금은 보석부터 올려."))
            .andExpect(jsonPath("$.Provider").value("ollama"))
            .andExpect(jsonPath("$.Model").value("qwen2.5:7b"))
            .andExpect(jsonPath("$.Usage.promptTokens").value(12))
            .andExpect(jsonPath("$.Usage.outputTokens").value(7));

        assertThat(localLlmClient.messages).hasSize(4);
        assertThat(localLlmClient.messages.get(1)).containsEntry("role", "user");
        assertThat(localLlmClient.messages.get(2)).containsEntry("role", "assistant");
        assertThat(localLlmClient.messages.get(3).get("content"))
            .contains("\"characterName\":\"붐버\"")
            .contains("\"label\":\"무기 11->12\"")
            .contains("뭐부터 올릴까?");
    }

    @Test
    void mapsUnavailableLocalLlm() throws Exception {
        localLlmClient.exception = new LocalLlmClient.LocalLlmException(
            "LOCAL_LLM_UNAVAILABLE",
            "로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘."
        );

        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "message": "상담해줘",
                      "armory": {"profile": {"CharacterName": "붐버"}}
                    }
                    """))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.code").value("LOCAL_LLM_UNAVAILABLE"))
            .andExpect(jsonPath("$.message").value("로컬 LLM 서버에 연결하지 못했어. Ollama가 켜져 있는지 확인해줘."));
    }

    @Test
    void mapsMalformedLocalLlmResponse() throws Exception {
        localLlmClient.exception = new LocalLlmClient.LocalLlmException(
            "LOCAL_LLM_MALFORMED_RESPONSE",
            "blank assistant text"
        );

        mockMvc.perform(post("/api/consult/sggu")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "message": "상담해줘",
                      "armory": {"profile": {"CharacterName": "붐버"}}
                    }
                    """))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("LOCAL_LLM_ERROR"))
            .andExpect(jsonPath("$.message").value("슥구 로컬 LLM 상담 응답을 만들지 못했어."));
    }

    @TestConfiguration
    static class TestConfig {

        @Bean
        SgguContextBuilder sgguContextBuilder() {
            return new SgguContextBuilder();
        }

        @Bean
        SgguPromptBuilder sgguPromptBuilder() {
            return new SgguPromptBuilder();
        }

        @Bean
        FakeLocalLlmClient localLlmClient() {
            return new FakeLocalLlmClient();
        }
    }

    static class FakeLocalLlmClient implements LocalLlmClient {

        private List<Map<String, String>> messages;
        private LocalLlmException exception;

        @Override
        public Completion createChatCompletion(List<Map<String, String>> messages) {
            this.messages = messages;

            if (exception != null) {
                throw exception;
            }

            return new Completion(
                "지금은 보석부터 올려.",
                "ollama",
                "qwen2.5:7b",
                Map.of("promptTokens", 12, "outputTokens", 7)
            );
        }

        void reset() {
            messages = null;
            exception = null;
        }
    }
}
