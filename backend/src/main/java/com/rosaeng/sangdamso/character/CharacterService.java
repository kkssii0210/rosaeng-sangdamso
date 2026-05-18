package com.rosaeng.sangdamso.character;

import static java.nio.charset.StandardCharsets.UTF_8;

import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;
import tools.jackson.databind.JsonNode;

@Service
public class CharacterService {

    private static final String ARMORY_CHARACTER_PATH = "/armories/characters/";

    private final LostarkApiClient lostarkApiClient;

    public CharacterService(LostarkApiClient lostarkApiClient) {
        this.lostarkApiClient = lostarkApiClient;
    }

    public CharacterResponse findCharacter(String characterName) {
        String encodedName = UriUtils.encodePathSegment(characterName.trim(), UTF_8);
        String basePath = ARMORY_CHARACTER_PATH + encodedName;

        JsonNode profile = fetchRequiredProfile(basePath + "/profiles");

        return new CharacterResponse(
            profile,
            fetchOptional(basePath + "/equipment"),
            null,
            fetchOptional(basePath + "/avatars"),
            fetchOptional(basePath + "/arkpassive"),
            fetchOptional(basePath + "/arkgrid"),
            fetchOptional(basePath + "/cards"),
            fetchOptional(basePath + "/combat-skills"),
            fetchOptional(basePath + "/engravings"),
            fetchOptional(basePath + "/gems"),
            null,
            null,
            null,
            null
        );
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
