package com.rosaeng.sangdamso.character;

import static java.nio.charset.StandardCharsets.UTF_8;

import com.rosaeng.sangdamso.character.avatar.AvatarNormalizer;
import com.rosaeng.sangdamso.character.cards.CardsNormalizer;
import com.rosaeng.sangdamso.character.engraving.EngravingsNormalizer;
import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.character.equipment.EquipmentNormalizer;
import com.rosaeng.sangdamso.character.gems.GemsNormalizer;
import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import com.rosaeng.sangdamso.spec.ClassIdentityService;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;
import tools.jackson.databind.JsonNode;

@Service
public class CharacterService {

    private static final String ARMORY_CHARACTER_PATH = "/armories/characters/";

    private final LostarkApiClient lostarkApiClient;
    private final AvatarNormalizer avatarNormalizer = new AvatarNormalizer();
    private final CardsNormalizer cardsNormalizer = new CardsNormalizer();
    private final ClassIdentityService classIdentityService = new ClassIdentityService();
    private final EngravingsNormalizer engravingsNormalizer = new EngravingsNormalizer();
    private final EquipmentNormalizer equipmentNormalizer = new EquipmentNormalizer();
    private final GemsNormalizer gemsNormalizer = new GemsNormalizer();

    public CharacterService(LostarkApiClient lostarkApiClient) {
        this.lostarkApiClient = lostarkApiClient;
    }

    public CharacterResponse findCharacter(String characterName) {
        String encodedName = UriUtils.encodePathSegment(characterName.trim(), UTF_8);
        String basePath = ARMORY_CHARACTER_PATH + encodedName;

        JsonNode profile = fetchRequiredProfile(basePath + "/profiles");

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<JsonNode> equipment = executor.submit(() -> fetchOptional(ArmorySection.EQUIPMENT.path(basePath)));
            Future<JsonNode> avatars = executor.submit(() -> fetchOptional(ArmorySection.AVATARS.path(basePath)));
            Future<JsonNode> arkPassive = executor.submit(() -> fetchOptional(ArmorySection.ARK_PASSIVE.path(basePath)));
            Future<JsonNode> arkGrid = executor.submit(() -> fetchOptional(ArmorySection.ARK_GRID.path(basePath)));
            Future<JsonNode> cards = executor.submit(() -> fetchOptional(ArmorySection.CARDS.path(basePath)));
            Future<JsonNode> skills = executor.submit(() -> fetchOptional(ArmorySection.SKILLS.path(basePath)));
            Future<JsonNode> engravings = executor.submit(() -> fetchOptional(ArmorySection.ENGRAVINGS.path(basePath)));
            Future<JsonNode> gems = executor.submit(() -> fetchOptional(ArmorySection.GEMS.path(basePath)));
            JsonNode rawEquipment = await(equipment);
            JsonNode rawAvatars = await(avatars);
            JsonNode rawArkPassive = await(arkPassive);
            JsonNode rawCards = await(cards);
            JsonNode rawEngravings = await(engravings);
            JsonNode rawGems = await(gems);
            JsonNode normalizedEngravings = engravingsNormalizer.normalize(rawEngravings);
            JsonNode classIdentityEffects = classIdentityService.build(
                profile,
                classIdentityContext(rawArkPassive, normalizedEngravings)
            );

            return new CharacterResponse(
                profile,
                equipmentNormalizer.normalize(rawEquipment),
                equipmentNormalizer.extractParadiseOrb(rawEquipment),
                avatarNormalizer.normalize(rawAvatars),
                rawArkPassive,
                await(arkGrid),
                cardsNormalizer.normalize(rawCards),
                await(skills),
                normalizedEngravings,
                gemsNormalizer.normalize(rawGems),
                classIdentityEffects,
                null,
                null,
                null
            );
        }
    }

    private Map<String, JsonNode> classIdentityContext(JsonNode arkPassive, JsonNode engravings) {
        Map<String, JsonNode> context = new LinkedHashMap<>();
        context.put("arkPassive", arkPassive);
        context.put("engravings", engravings);
        return context;
    }

    private JsonNode fetchRequiredProfile(String path) {
        try {
            JsonNode profile = lostarkApiClient.get(path);

            if (profile == null) {
                throw characterNotFound();
            }

            return profile;
        } catch (LostarkApiException exception) {
            if (exception.getCode() == LostarkApiErrorCode.NOT_FOUND) {
                throw characterNotFound();
            }

            if (isMissingApiKey(exception)) {
                throw missingApiKey();
            }

            throw lostarkApiError();
        }
    }

    private JsonNode fetchOptional(String path) {
        try {
            return lostarkApiClient.get(path);
        } catch (LostarkApiException exception) {
            if (exception.getCode() == LostarkApiErrorCode.NOT_FOUND) {
                return null;
            }

            if (isMissingApiKey(exception)) {
                throw missingApiKey();
            }

            throw lostarkApiError();
        }
    }

    private JsonNode await(Future<JsonNode> future) {
        try {
            return future.get();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw lostarkApiError();
        } catch (ExecutionException exception) {
            Throwable cause = exception.getCause();

            if (cause instanceof BffException bffException) {
                throw bffException;
            }

            if (cause instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }

            throw lostarkApiError();
        }
    }

    private boolean isMissingApiKey(LostarkApiException exception) {
        return exception.getCode() == LostarkApiErrorCode.AUTH_ERROR && exception.getStatus() == null;
    }

    private BffException missingApiKey() {
        return new BffException(HttpStatus.INTERNAL_SERVER_ERROR, "MISSING_API_KEY", "잠시 설정을 확인하고 있어요.");
    }

    private BffException lostarkApiError() {
        return new BffException(
            HttpStatus.BAD_GATEWAY,
            "LOSTARK_API_ERROR",
            "지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."
        );
    }

    private BffException characterNotFound() {
        return new BffException(HttpStatus.NOT_FOUND, "CHARACTER_NOT_FOUND", "없는 캐릭터입니다.");
    }
}
