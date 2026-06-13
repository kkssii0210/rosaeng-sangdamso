package com.rosaeng.sangdamso.character;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.common.GlobalExceptionHandler;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(CharacterController.class)
@Import({GlobalExceptionHandler.class, CharacterControllerTest.TestConfig.class})
class CharacterControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private FakeCharacterService characterService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void resetService() {
        characterService.reset();
    }

    @Test
    void rejectsEmptyTrimmedCharacterName() throws Exception {
        mockMvc.perform(get(URI.create("/api/characters/%20%20")))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_CHARACTER_NAME"))
            .andExpect(jsonPath("$.message").value("조회할 캐릭터명을 입력해줘."));

        characterService.assertNoRequests();
    }

    @Test
    void returnsMissingApiKeyError() throws Exception {
        characterService.respondWith(new BffException(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "MISSING_API_KEY",
            "잠시 설정을 확인하고 있어요."
        ));

        mockMvc.perform(get("/api/characters/{name}", "도화가"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.code").value("MISSING_API_KEY"))
            .andExpect(jsonPath("$.message").value("잠시 설정을 확인하고 있어요."));
    }

    @Test
    void returnsMissingCharacterError() throws Exception {
        characterService.respondWith(new BffException(HttpStatus.NOT_FOUND, "CHARACTER_NOT_FOUND", "없는 캐릭터입니다."));

        mockMvc.perform(get("/api/characters/{name}", "없는캐릭터"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("CHARACTER_NOT_FOUND"))
            .andExpect(jsonPath("$.message").value("없는 캐릭터입니다."));
    }

    @Test
    void returnsUpstreamFailureError() throws Exception {
        characterService.respondWith(new BffException(
            HttpStatus.BAD_GATEWAY,
            "LOSTARK_API_ERROR",
            "지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."
        ));

        mockMvc.perform(get("/api/characters/{name}", "도화가"))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("LOSTARK_API_ERROR"))
            .andExpect(jsonPath("$.message").value("지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."));
    }

    @Test
    void returnsSuccessfulResponseWithNullCalculationFields() throws Exception {
        characterService.respondWith(new CharacterResponse(
            node("profile"),
            node("equipment"),
            null,
            node("avatars"),
            node("arkPassive"),
            node("arkGrid"),
            node("cards"),
            node("skills"),
            node("engravings"),
            node("gems"),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        ));

        mockMvc.perform(get("/api/characters/{name}", "  도화가  "))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.profile.source").value("profile"))
            .andExpect(jsonPath("$.equipment.source").value("equipment"))
            .andExpect(jsonPath("$.paradiseOrb").value(nullValue()))
            .andExpect(jsonPath("$.avatars.source").value("avatars"))
            .andExpect(jsonPath("$.arkPassive.source").value("arkPassive"))
            .andExpect(jsonPath("$.arkGrid.source").value("arkGrid"))
            .andExpect(jsonPath("$.cards.source").value("cards"))
            .andExpect(jsonPath("$.skills.source").value("skills"))
            .andExpect(jsonPath("$.engravings.source").value("engravings"))
            .andExpect(jsonPath("$.gems.source").value("gems"))
            .andExpect(jsonPath("$.mainStats").value(nullValue()))
            .andExpect(jsonPath("$.avatarStats").value(nullValue()))
            .andExpect(jsonPath("$.classIdentityEffects").value(nullValue()))
            .andExpect(jsonPath("$.criticalStats").value(nullValue()))
            .andExpect(jsonPath("$.accessoryContributions").value(nullValue()))
            .andExpect(jsonPath("$.engravingContributions").value(nullValue()))
            .andExpect(jsonPath("$.combatPowerAnalysis").value(nullValue()))
            .andExpect(jsonPath("$.upgradeEfficiency").value(nullValue()));

        characterService.assertRequestedNames("도화가");
    }

    private JsonNode node(String source) {
        return objectMapper.createObjectNode().put("source", source);
    }

    @TestConfiguration
    static class TestConfig {

        @Bean
        FakeCharacterService characterService() {
            return new FakeCharacterService();
        }
    }

    static class FakeCharacterService extends CharacterService {

        private final List<String> requestedNames = new ArrayList<>();
        private CharacterResponse response;
        private BffException exception;

        FakeCharacterService() {
            super(null);
        }

        @Override
        public CharacterResponse findCharacter(String characterName) {
            requestedNames.add(characterName);

            if (exception != null) {
                throw exception;
            }

            return response;
        }

        void respondWith(CharacterResponse response) {
            this.response = response;
        }

        void respondWith(BffException exception) {
            this.exception = exception;
        }

        void reset() {
            requestedNames.clear();
            response = null;
            exception = null;
        }

        void assertNoRequests() {
            org.assertj.core.api.Assertions.assertThat(requestedNames).isEmpty();
        }

        void assertRequestedNames(String... names) {
            org.assertj.core.api.Assertions.assertThat(requestedNames).containsExactly(names);
        }
    }
}
