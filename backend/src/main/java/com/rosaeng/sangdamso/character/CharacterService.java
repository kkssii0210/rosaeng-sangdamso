package com.rosaeng.sangdamso.character;

import static java.nio.charset.StandardCharsets.UTF_8;

import com.rosaeng.sangdamso.character.avatar.AvatarNormalizer;
import com.rosaeng.sangdamso.character.cards.CardsNormalizer;
import com.rosaeng.sangdamso.character.engraving.EngravingsNormalizer;
import com.rosaeng.sangdamso.common.BffException;
import com.rosaeng.sangdamso.character.equipment.EquipmentNormalizer;
import com.rosaeng.sangdamso.character.gems.GemsNormalizer;
import com.rosaeng.sangdamso.efficiency.AccessoryContributionService;
import com.rosaeng.sangdamso.efficiency.EngravingContributionService;
import com.rosaeng.sangdamso.efficiency.SpecUpCharacterContext;
import com.rosaeng.sangdamso.lostark.LostarkApiClient;
import com.rosaeng.sangdamso.lostark.LostarkApiErrorCode;
import com.rosaeng.sangdamso.lostark.LostarkApiException;
import com.rosaeng.sangdamso.market.MarketSnapshotService;
import com.rosaeng.sangdamso.spec.AvatarStatsService;
import com.rosaeng.sangdamso.spec.ClassIdentityService;
import com.rosaeng.sangdamso.spec.CombatPowerAnalysisService;
import com.rosaeng.sangdamso.spec.CriticalStatsService;
import com.rosaeng.sangdamso.spec.MainStatsService;
import com.rosaeng.sangdamso.spec.UpgradeEfficiencyService;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;
import tools.jackson.databind.JsonNode;

@Service
public class CharacterService {

    private static final String ARMORY_CHARACTER_PATH = "/armories/characters/";

    private final LostarkApiClient lostarkApiClient;
    private final MarketSnapshotService marketSnapshotService;
    private final AccessoryContributionService accessoryContributionService = new AccessoryContributionService();
    private final AvatarStatsService avatarStatsService = new AvatarStatsService();
    private final AvatarNormalizer avatarNormalizer = new AvatarNormalizer();
    private final CardsNormalizer cardsNormalizer = new CardsNormalizer();
    private final ClassIdentityService classIdentityService = new ClassIdentityService();
    private final CombatPowerAnalysisService combatPowerAnalysisService = new CombatPowerAnalysisService();
    private final CriticalStatsService criticalStatsService = new CriticalStatsService();
    private final EngravingsNormalizer engravingsNormalizer = new EngravingsNormalizer();
    private final EngravingContributionService engravingContributionService = new EngravingContributionService();
    private final EquipmentNormalizer equipmentNormalizer = new EquipmentNormalizer();
    private final GemsNormalizer gemsNormalizer = new GemsNormalizer();
    private final MainStatsService mainStatsService = new MainStatsService();
    private final UpgradeEfficiencyService upgradeEfficiencyService = new UpgradeEfficiencyService();

    public CharacterService(LostarkApiClient lostarkApiClient) {
        this(lostarkApiClient, null);
    }

    @Autowired
    public CharacterService(LostarkApiClient lostarkApiClient, MarketSnapshotService marketSnapshotService) {
        this.lostarkApiClient = lostarkApiClient;
        this.marketSnapshotService = marketSnapshotService;
    }

    public CharacterResponse findCharacter(String characterName) {
        SpecUpCharacterContext context = buildSpecUpContext(characterName, false);
        JsonNode upgradeEfficiency = upgradeEfficiencyService.build(upgradeEfficiencyContext(
            context.profile(),
            context.equipment(),
            context.avatars(),
            context.arkPassive(),
            context.arkGrid(),
            context.cards(),
            context.engravings(),
            context.gems(),
            context.paradiseOrb(),
            context.criticalStats(),
            context.marketSnapshot(),
            context.engravingBookPrices()
        ));

        JsonNode mainStats = mainStatsService.build(context.equipment());
        JsonNode avatarStats = avatarStatsService.build(context.avatars());
        JsonNode accessoryContributions = accessoryContributionService.build(
            context.equipment(),
            context.profile(),
            context.criticalStats()
        );
        JsonNode engravingContributions = engravingContributionService.build(
            context.engravings(),
            context.criticalStats()
        );

        return new CharacterResponse(
            context.profile(),
            context.equipment(),
            context.paradiseOrb(),
            context.avatars(),
            context.arkPassive(),
            context.arkGrid(),
            context.cards(),
            context.skills(),
            context.engravings(),
            context.gems(),
            mainStats,
            avatarStats,
            context.classIdentityEffects(),
            context.criticalStats(),
            accessoryContributions,
            engravingContributions,
            context.combatPowerAnalysis(),
            upgradeEfficiency
        );
    }

    public SpecUpCharacterContext buildSpecUpContext(String characterName, boolean forceRefresh) {
        String trimmedName = characterName.trim();
        String encodedName = UriUtils.encodePathSegment(trimmedName, UTF_8);
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
            JsonNode rawArkGrid = await(arkGrid);
            JsonNode rawSkills = await(skills);
            JsonNode rawCards = await(cards);
            JsonNode rawEngravings = await(engravings);
            JsonNode rawGems = await(gems);
            JsonNode normalizedEquipment = equipmentNormalizer.normalize(rawEquipment);
            JsonNode paradiseOrb = equipmentNormalizer.extractParadiseOrb(rawEquipment);
            JsonNode normalizedAvatars = avatarNormalizer.normalize(rawAvatars);
            JsonNode normalizedCards = cardsNormalizer.normalize(rawCards);
            JsonNode normalizedEngravings = engravingsNormalizer.normalize(rawEngravings);
            JsonNode normalizedGems = gemsNormalizer.normalize(rawGems);
            JsonNode classIdentityEffects = classIdentityService.build(
                profile,
                classIdentityContext(rawArkPassive, normalizedEngravings)
            );
            JsonNode criticalStats = criticalStatsService.build(criticalStatsContext(
                profile,
                normalizedEquipment,
                normalizedEngravings,
                rawSkills,
                rawArkPassive,
                rawArkGrid,
                normalizedCards,
                classIdentityEffects
            ));
            JsonNode combatPowerAnalysis = combatPowerAnalysisService.build(combatPowerContext(
                profile,
                normalizedEquipment,
                paradiseOrb,
                criticalStats
            ));
            JsonNode marketSnapshot = loadMarketSnapshot(forceRefresh);
            JsonNode engravingBookPrices = loadEngravingBookPrices(normalizedEngravings);

            return new SpecUpCharacterContext(
                trimmedName,
                profile,
                normalizedEquipment,
                paradiseOrb,
                normalizedAvatars,
                rawArkPassive,
                rawArkGrid,
                normalizedCards,
                rawSkills,
                normalizedEngravings,
                normalizedGems,
                classIdentityEffects,
                criticalStats,
                combatPowerAnalysis,
                marketSnapshot,
                engravingBookPrices
            );
        }
    }

    private Map<String, JsonNode> classIdentityContext(JsonNode arkPassive, JsonNode engravings) {
        Map<String, JsonNode> context = new LinkedHashMap<>();
        context.put("arkPassive", arkPassive);
        context.put("engravings", engravings);
        return context;
    }

    private Map<String, JsonNode> criticalStatsContext(
        JsonNode profile,
        JsonNode equipment,
        JsonNode engravings,
        JsonNode skills,
        JsonNode arkPassive,
        JsonNode arkGrid,
        JsonNode cards,
        JsonNode classIdentityEffects
    ) {
        Map<String, JsonNode> context = new LinkedHashMap<>();
        context.put("profile", profile);
        context.put("equipment", equipment);
        context.put("engravings", engravings);
        context.put("skills", skills);
        context.put("arkPassive", arkPassive);
        context.put("arkGrid", arkGrid);
        context.put("cards", cards);
        context.put("classIdentityEffects", classIdentityEffects);
        return context;
    }

    private Map<String, JsonNode> combatPowerContext(
        JsonNode profile,
        JsonNode equipment,
        JsonNode paradiseOrb,
        JsonNode criticalStats
    ) {
        Map<String, JsonNode> context = new LinkedHashMap<>();
        context.put("profile", profile);
        context.put("equipment", equipment);
        context.put("paradiseOrb", paradiseOrb);
        context.put("criticalStats", criticalStats);
        return context;
    }

    private Map<String, JsonNode> upgradeEfficiencyContext(
        JsonNode profile,
        JsonNode equipment,
        JsonNode avatars,
        JsonNode arkPassive,
        JsonNode arkGrid,
        JsonNode cards,
        JsonNode engravings,
        JsonNode gems,
        JsonNode paradiseOrb,
        JsonNode criticalStats,
        JsonNode marketSnapshot,
        JsonNode engravingBookPrices
    ) {
        Map<String, JsonNode> context = new LinkedHashMap<>();
        context.put("profile", profile);
        context.put("equipment", equipment);
        context.put("avatars", avatars);
        context.put("arkPassive", arkPassive);
        context.put("arkGrid", arkGrid);
        context.put("cards", cards);
        context.put("engravings", engravings);
        context.put("gems", gems);
        context.put("paradiseOrb", paradiseOrb);
        context.put("criticalStats", criticalStats);
        context.put("marketSnapshot", marketSnapshot);
        context.put("engravingBookPrices", engravingBookPrices);
        return context;
    }

    private JsonNode loadMarketSnapshot(boolean forceRefresh) {
        if (marketSnapshotService == null) {
            return null;
        }

        try {
            return marketSnapshotService.getSnapshot(forceRefresh);
        } catch (BffException exception) {
            return null;
        }
    }

    private JsonNode loadEngravingBookPrices(JsonNode engravings) {
        if (marketSnapshotService == null) {
            return null;
        }

        try {
            return marketSnapshotService.getRelicBookPrices(engravings);
        } catch (BffException exception) {
            return null;
        }
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
