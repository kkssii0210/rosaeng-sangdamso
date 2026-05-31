package com.rosaeng.sangdamso.consultant;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;
import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class SgguConsultationServiceTest {

    private FakeLocalLlmClient localLlmClient;
    private SgguConsultationService service;

    @BeforeEach
    void setUp() {
        localLlmClient = new FakeLocalLlmClient();
        service = new SgguConsultationService(
            new SgguPromptBuilder(),
            localLlmClient,
            new SgguResponseParser(new ObjectMapper()),
            new SgguFallbackComposer()
        );
    }

    @Test
    void returnsValidatedLlmConsultation() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "보석 효율이 좋아.",
              "Recommendation": "7겁 보석부터 보자.",
              "NextAction": "보석 가격을 확인해줘.",
              "DisplayText": "지금은 보석부터 보는 게 좋아."
            }
            """;

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            List.of(Map.of("role", "assistant", "content", "후보를 볼게.")),
            context()
        );

        assertThat(response.source()).isEqualTo("llm");
        assertThat(response.displayText()).contains("보석부터");
        assertThat(localLlmClient.messages)
            .anySatisfy(entry -> assertThat(entry.get("content")).contains("Mode: main-chat"));
    }

    @Test
    void returnsFallbackWhenLlmIsUnavailable() {
        localLlmClient.exception = new LocalLlmClient.LocalLlmException("LOCAL_LLM_UNAVAILABLE", "down");

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "전투력 효율 결과를 상담 카드로 요약해줘",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.recommendation()).contains("무기 11->12");
    }

    @Test
    void returnsFallbackWhenLlmReturnsMalformedJson() {
        localLlmClient.text = "보석부터 보는 게 좋아.";

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터 올릴까?",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.displayText()).contains("무기 11->12");
    }

    @Test
    void reusesCachedValidatedResponseForSameFacts() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "무기 강화가 1순위야.",
              "Recommendation": "무기 11->12부터 보자.",
              "NextAction": "강화 재료 가격을 확인해줘.",
              "DisplayText": "무기 11->12부터 보자."
            }
            """;

        service.consult(SgguConsultationMode.MAIN_CHAT, "뭐부터?", List.of(), context());
        service.consult(SgguConsultationMode.MAIN_CHAT, "뭐부터?", List.of(), context());

        assertThat(localLlmClient.callCount).isEqualTo(1);
    }

    @Test
    void doesNotReuseCacheWhenConversationChanges() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "무기 강화가 1순위야.",
              "Recommendation": "무기 11->12부터 보자.",
              "NextAction": "강화 재료 가격을 확인해줘.",
              "DisplayText": "무기 11->12부터 보자."
            }
            """;

        service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터?",
            List.of(Map.of("role", "assistant", "content", "보석부터 봤었어.")),
            context()
        );
        service.consult(
            SgguConsultationMode.MAIN_CHAT,
            "뭐부터?",
            List.of(Map.of("role", "assistant", "content", "강화부터 봤었어.")),
            context()
        );

        assertThat(localLlmClient.callCount).isEqualTo(2);
    }

    @Test
    void keepsValidatedResponseCacheBounded() throws Exception {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "무기 강화가 1순위야.",
              "Recommendation": "무기 11->12부터 보자.",
              "NextAction": "강화 재료 가격을 확인해줘.",
              "DisplayText": "무기 11->12부터 보자."
            }
            """;

        for (int index = 0; index < 130; index++) {
            service.consult(SgguConsultationMode.MAIN_CHAT, "뭐부터? " + index, List.of(), context());
        }

        assertThat(cacheSize()).isLessThanOrEqualTo(128);
    }

    @Test
    void returnsFallbackWhenEfficiencySummaryDoesNotUseTopCandidate() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "보석 효율이 좋아.",
              "Recommendation": "7겁 보석부터 보자.",
              "NextAction": "보석 가격을 확인해줘.",
              "DisplayText": "지금은 보석부터 보는 게 좋아."
            }
            """;

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "전투력 효율 결과를 상담 카드로 요약해줘",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.recommendation()).contains("무기 11->12");
    }

    @Test
    void returnsFallbackWhenEfficiencySummaryOnlyMentionsTopCandidateInDiagnosis() {
        localLlmClient.text = """
            {
              "Mood": "warm-but-firm",
              "Diagnosis": "무기 11->12도 후보로 보이지만.",
              "Recommendation": "7겁 보석부터 보자.",
              "NextAction": "보석 가격을 확인해줘.",
              "DisplayText": "지금은 보석부터 보는 게 좋아."
            }
            """;

        SgguConsultationResponse response = service.consult(
            SgguConsultationMode.EFFICIENCY_SUMMARY,
            "전투력 효율 결과를 상담 카드로 요약해줘",
            List.of(),
            context()
        );

        assertThat(response.source()).isEqualTo("fallback");
        assertThat(response.recommendation()).contains("무기 11->12");
    }

    private int cacheSize() throws Exception {
        Field field = SgguConsultationService.class.getDeclaredField("cache");
        field.setAccessible(true);
        return ((Map<?, ?>) field.get(service)).size();
    }

    private JsonNode context() {
        return toJsonNode(orderedMap(
            "profile", orderedMap("characterName", "붐버"),
            "topSpecUps", List.of(orderedMap(
                "label", "무기 11->12",
                "costGold", 100000,
                "gainPercent", 0.3,
                "caveat", "노숨 기대비용 기준"
            ))
        ));
    }

    private static class FakeLocalLlmClient implements LocalLlmClient {

        private String text = "";
        private LocalLlmException exception;
        private int callCount;
        private List<Map<String, String>> messages;

        @Override
        public Completion createChatCompletion(List<Map<String, String>> messages) {
            this.messages = messages;
            callCount++;

            if (exception != null) {
                throw exception;
            }

            return new Completion(text, "ollama", "qwen2.5:7b", Map.of());
        }
    }
}
