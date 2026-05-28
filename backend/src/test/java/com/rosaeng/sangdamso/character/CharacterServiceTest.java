package com.rosaeng.sangdamso.character;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import com.rosaeng.sangdamso.lostark.LostarkProperties;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
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
            "/armories/characters/%EB%8F%84%ED%99%94%EA%B0%80/equipment", equipment(
                equipmentItem("무기", "검은 밤의 장검", "고대", tooltip(97, "기본 효과", "무기 공격력 +12345")),
                equipmentItem("보주", "눈부신 비전의 보주", "유물", tooltip(-1, "특수 효과", "[맥스웰 맥시마]", "시즌2 달성 최대 낙원력 : 48,275,714"))
            ),
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
        assertThat(response.equipment().size()).isEqualTo(1);
        assertThat(response.equipment().get(0).get("Type").asString()).isEqualTo("무기");
        assertThat(response.equipment().get(0).get("Tooltip")).isNull();
        assertThat(response.paradiseOrb().get("Type").asString()).isEqualTo("보주");
        assertThat(response.paradiseOrb().get("EffectName").asString()).isEqualTo("맥스웰 맥시마");
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
        List<String> paths = new CopyOnWriteArrayList<>();
        CharacterService service = new CharacterService(client((method, path, authorization) -> {
            paths.add(path);
            return node(path);
        }));

        service.findCharacter("바드");

        assertThat(paths).first().isEqualTo("/armories/characters/%EB%B0%94%EB%93%9C/profiles");
        assertThat(paths.subList(1, paths.size())).containsExactlyInAnyOrder(
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
    void fetchesOptionalArmorySectionsConcurrentlyAfterProfile() {
        CountDownLatch optionalRequestsStarted = new CountDownLatch(8);
        List<String> optionalPaths = new CopyOnWriteArrayList<>();
        CharacterService service = new CharacterService(client((method, path, authorization) -> {
            if (path.endsWith("/profiles")) {
                return node("profile");
            }

            optionalPaths.add(path);
            optionalRequestsStarted.countDown();
            awaitAllOptionalRequests(optionalRequestsStarted);
            return node(path);
        }));

        CharacterResponse response = service.findCharacter("도화가");

        assertThat(response.profile().get("source").asString()).isEqualTo("profile");
        assertThat(optionalPaths).hasSize(8);
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
    void mapsOptionalEquipmentNotFoundToEmptyArray() {
        CharacterService service = new CharacterService(client((method, path, authorization) -> {
            if (path.endsWith("/equipment")) {
                throw new LostarkApiException(LostarkApiErrorCode.NOT_FOUND, 404, "missing");
            }

            return node(path);
        }));

        CharacterResponse response = service.findCharacter("도화가");

        assertThat(response.profile()).isNotNull();
        assertThat(response.equipment().size()).isZero();
        assertThat(response.paradiseOrb()).isNull();
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

    @Test
    void mapsMissingApiKeyToInternalServerError() {
        CharacterService service = new CharacterService(clientWithBlankAuthorization());

        assertThatThrownBy(() -> service.findCharacter("도화가"))
            .isInstanceOfSatisfying(BffException.class, exception -> {
                assertThat(exception.status()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
                assertThat(exception.code()).isEqualTo("MISSING_API_KEY");
                assertThat(exception.userMessage()).isEqualTo("잠시 설정을 확인하고 있어요.");
            });
    }

    private CharacterService serviceWithResponses(Map<String, JsonNode> responses) {
        return new CharacterService(client((method, path, authorization) -> responses.get(path)));
    }

    private LostarkApiClient client(LostarkApiClient.RequestExecutor executor) {
        LostarkProperties properties = new LostarkProperties("token", "", "https://example.com", 5, 0);
        return new LostarkApiClient(properties, executor);
    }

    private LostarkApiClient clientWithBlankAuthorization() {
        LostarkProperties properties = new LostarkProperties("", "", "https://example.com", 5, 0);
        return new LostarkApiClient(properties, (method, path, authorization) -> node(path));
    }

    private JsonNode node(String source) {
        return objectMapper.createObjectNode().put("source", source);
    }

    private JsonNode equipment(JsonNode... items) {
        return objectMapper.convertValue(List.of(items), JsonNode.class);
    }

    private JsonNode equipmentItem(String type, String name, String grade, String tooltip) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("Type", type);
        item.put("Name", name);
        item.put("Icon", "https://cdn-lostark.game.onstove.com/sample.png");
        item.put("Grade", grade);
        item.put("Tooltip", tooltip);
        return objectMapper.convertValue(item, JsonNode.class);
    }

    private String tooltip(int qualityValue, String title, String... lines) {
        return """
            {
              "Element_001": {
                "value": {
                  "qualityValue": %d,
                  "leftStr2": "<FONT COLOR='#FFD200'>아이템 레벨 1,740.00</FONT>"
                }
              },
              "Element_010": {
                "type": "ItemPartBox",
                "value": {
                  "Element_000": "<FONT COLOR='#FFEC50'>%s</FONT>",
                  "Element_001": "%s"
                }
              }
            }
            """.formatted(qualityValue, title, String.join("<BR>", lines));
    }

    private static void awaitAllOptionalRequests(CountDownLatch latch) {
        try {
            assertThat(latch.await(1, TimeUnit.SECONDS)).isTrue();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError("interrupted while waiting for optional requests", exception);
        }
    }
}
