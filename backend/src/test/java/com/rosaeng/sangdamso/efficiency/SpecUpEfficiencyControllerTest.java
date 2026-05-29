package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rosaeng.sangdamso.common.GlobalExceptionHandler;
import java.net.URI;
import java.time.Clock;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(SpecUpEfficiencyController.class)
@Import({GlobalExceptionHandler.class, SpecUpEfficiencyControllerTest.TestConfig.class})
class SpecUpEfficiencyControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FakeSpecUpEfficiencyService service;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @BeforeEach
    void reset() {
        service.reset();
    }

    @Test
    void rejectsBlankName() throws Exception {
        mockMvc.perform(get(URI.create("/api/efficiency/spec-up/%20%20")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_CHARACTER_NAME"));
    }

    @Test
    void returnsSpecUpRecommendation() throws Exception {
        service.response = toJsonNode(orderedMap(
            "CharacterName", "붐버",
            "Recommendation", orderedMap("Status", "ready", "TopCandidates", List.of())
        ));

        mockMvc.perform(get("/api/efficiency/spec-up/{name}?refresh=1", "붐버"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.CharacterName").value("붐버"))
            .andExpect(jsonPath("$.Recommendation.Status").value("ready"));

        assertThat(service.characterName).isEqualTo("붐버");
        assertThat(service.forceRefresh).isTrue();
    }

    private static JsonNode toJsonNode(Object value) {
        return OBJECT_MAPPER.convertValue(value, JsonNode.class);
    }

    @TestConfiguration
    static class TestConfig {

        @Bean
        FakeSpecUpEfficiencyService specUpEfficiencyService() {
            return new FakeSpecUpEfficiencyService();
        }
    }

    static class FakeSpecUpEfficiencyService extends SpecUpEfficiencyService {

        private JsonNode response;
        private String characterName;
        private boolean forceRefresh;

        FakeSpecUpEfficiencyService() {
            super(null, null, null, null, null, Clock.systemUTC());
        }

        @Override
        public JsonNode findSpecUpEfficiency(String characterName, boolean forceRefresh) {
            this.characterName = characterName;
            this.forceRefresh = forceRefresh;
            return response;
        }

        void reset() {
            response = toJsonNode(orderedMap("CharacterName", "", "Recommendation", orderedMap("Status", "noRecommendation")));
            characterName = "";
            forceRefresh = false;
        }
    }
}
