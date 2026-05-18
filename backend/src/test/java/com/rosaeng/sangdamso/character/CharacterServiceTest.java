package com.rosaeng.sangdamso.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import com.rosaeng.sangdamso.lostark.LostarkProperties;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class CharacterServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void returnsSuccessfulTopLevelFields() {
        CharacterService service = serviceWithResponses(Map.of(
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/profiles", node("profile"),
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/equipment", node("equipment"),
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/avatars", node("avatars"),
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/arkpassive", node("arkPassive"),
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/arkgrid", node("arkGrid"),
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/cards", node("cards"),
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/combat-skills", node("skills"),
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/engravings", node("engravings"),
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/gems", node("gems")
        ));

        CharacterResponse response = service.findCharacter("도화가");

        assertThat(response.profile().get("source").asString()).isEqualTo("profile");
        assertThat(response.equipment().get("source").asString()).isEqualTo("equipment");
        assertThat(response.paradiseOrb()).isNull();
        assertThat(response.avatars().get("source").asString()).isEqualTo("avatars");
        assertThat(response.arkPassive().get("source").asString()).isEqualTo("arkPassive");
        assertThat(response.arkGrid().get("source").asString()).isEqualTo("arkGrid");
        assertThat(response.cards().get("source").asString()).isEqualTo("cards");
        assertThat(response.skills().get("source").asString()).isEqualTo("skills");
        assertThat(response.engravings().get("source").asString()).isEqualTo("engravings");
        assertThat(response.gems().get("source").asString()).isEqualTo("gems");
        assertThat(response.classIdentityEffects()).isNull();
        assertThat(response.criticalStats()).isNull();
        assertThat(response.combatPowerAnalysis()).isNull();
        assertThat(response.upgradeEfficiency()).isNull();
    }

    @Test
    void encodesKoreanCharacterNameAsPathSegment() {
        List<String> paths = new ArrayList<>();
        CharacterService service = new CharacterService(client((method, path, authorization) -> {
            paths.add(path);
            return node(path);
        }));

        service.findCharacter("바드");

        assertThat(paths).containsExactly(
            "/armories/characters/%EB%B0%94%EB%93%9C/profiles",
            "/armories/characters/%EB%B0%94%EB%93%9C/equipment",
            "/armories/characters/%EB%B0%94%EB%93%9C/avatars",
            "/armories/characters/%EB%B0%94%EB%93%9C/arkpassive",
            "/armories/characters/%EB%B0%94%EB%93%9C/arkgrid",
            "/armories/characters/%EB%B0%94%EB%93%9C/cards",
            "/armories/characters/%EB%B0%94%EB%93%9C/combat-skills",
            "/armories/characters/%EB%B0%94%EB%93%9C/engravings",
            "/armories/characters/%EB%B0%94%EB%93%9C/gems"
        );
    }

    @Test
    void mapsProfileNotFoundToCharacterNotFound() {
        CharacterService service = new CharacterService(client((method, path, authorization) -> {
            throw new LostarkApiException(LostarkApiErrorCode.NOT_FOUND, 404, "missing");
        }));

        assertThatThrownBy(() -> service.findCharacter("없는캐릭터"))
            .isInstanceOfSatisfying(BffException.class, exception -> {
                assertThat(exception.status()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(exception.code()).isEqualTo("CHARACTER_NOT_FOUND");
                assertThat(exception.userMessage()).isEqualTo("없는 캐릭터입니다.");
            });
    }

    @Test
    void mapsNullProfileToCharacterNotFound() {
        CharacterService service = new CharacterService(client((method, path, authorization) -> {
            if (path.endsWith("/profiles")) {
                return null;
            }

            return node(path);
        }));

        assertThatThrownBy(() -> service.findCharacter("없는캐릭터"))
            .isInstanceOfSatisfying(BffException.class, exception -> {
                assertThat(exception.status()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(exception.code()).isEqualTo("CHARACTER_NOT_FOUND");
                assertThat(exception.userMessage()).isEqualTo("없는 캐릭터입니다.");
            });
    }

    @Test
    void mapsOptionalNotFoundToNull() {
        CharacterService service = new CharacterService(client((method, path, authorization) -> {
            if (path.endsWith("/equipment")) {
                throw new LostarkApiException(LostarkApiErrorCode.NOT_FOUND, 404, "missing");
            }

            return node(path);
        }));

        CharacterResponse response = service.findCharacter("도화가");

        assertThat(response.profile()).isNotNull();
        assertThat(response.equipment()).isNull();
        assertThat(response.avatars()).isNotNull();
    }

    @Test
    void mapsUpstreamFailureToBadGateway() {
        CharacterService service = new CharacterService(client((method, path, authorization) -> {
            if (path.endsWith("/cards")) {
                throw new LostarkApiException(LostarkApiErrorCode.UPSTREAM_ERROR, 500, "upstream");
            }

            return node(path);
        }));

        assertThatThrownBy(() -> service.findCharacter("도화가"))
            .isInstanceOfSatisfying(BffException.class, exception -> {
                assertThat(exception.status()).isEqualTo(HttpStatus.BAD_GATEWAY);
                assertThat(exception.code()).isEqualTo("LOSTARK_API_ERROR");
                assertThat(exception.userMessage()).isEqualTo("지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘.");
            });
    }

    private CharacterService serviceWithResponses(Map<String, JsonNode> responses) {
        return new CharacterService(client((method, path, authorization) -> responses.get(path)));
    }

    private LostarkApiClient client(LostarkApiClient.RequestExecutor executor) {
        LostarkProperties properties = new LostarkProperties("token", "", "https://example.com", 5, 0);
        return new LostarkApiClient(properties, executor);
    }

    private JsonNode node(String source) {
        return objectMapper.createObjectNode().put("source", source);
    }
}
