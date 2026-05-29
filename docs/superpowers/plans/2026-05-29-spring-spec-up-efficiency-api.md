# Spring Spec-Up Efficiency API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Spring `GET /api/efficiency/spec-up/{name}` and move integrated accessory plus upgrade-efficiency recommendation runtime ownership from Next.js to Spring.

**Architecture:** Add a focused `com.rosaeng.sangdamso.efficiency` package for spec-up orchestration, accessory auction search, accessory normalization, accessory scoring, and candidate merging. Reuse existing Spring armory normalizers, `MarketSnapshotService`, and `UpgradeEfficiencyService`; keep the existing JavaScript route as the parity oracle until Spring tests pass and the route can be removed.

**Tech Stack:** Spring Boot 4, Java 21, Jackson `JsonNode`, Maven/JUnit/AssertJ/MockMvc, existing Lostark Open API clients.

---

## File Structure

- Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyController.java`
  - Owns `GET /api/efficiency/spec-up/{name}`.
- Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyService.java`
  - Loads armory context, market data, accessory candidates, upgrade candidates, and builds the final response.
- Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpRecommendationService.java`
  - Ports JavaScript `buildSpecUpRecommendation`.
- Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchService.java`
  - Searches Lostark auction pages for accessory candidates and returns search summaries.
- Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java`
  - Ports accessory search options, auction item normalization, eligibility, and fingerprinting.
- Create `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryEfficiencyService.java`
  - Ports accessory replacement scoring.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiClient.java`
  - Add a POST method for auction searches.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`
  - Extract a reusable `buildEfficiencyContext(String characterName, boolean forceRefresh)` method or equivalent package-visible context service so the new endpoint does not duplicate armory loading.
- Modify `docs/backend-api-ownership.md`
  - Mark `/api/efficiency/spec-up/{name}` as Spring-owned after parity passes.
- Delete or replace `app/api/efficiency/spec-up/[name]/route.js`
  - Only after Spring route contract tests and full build pass.

## Task 1: Add POST Support To LostarkApiClient

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiClient.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkApiClientTest.java`

- [ ] **Step 1: Add failing POST test**

Append this test to `LostarkApiClientTest`:

```java
@Test
void postsJsonBodyWithAuthorization() {
    JsonNode body = objectMapper.createObjectNode().put("CategoryCode", 200010);
    List<String> calls = new ArrayList<>();
    LostarkApiClient client = new LostarkApiClient(
        properties("token"),
        (method, path, authorization, requestBody) -> {
            calls.add(method + " " + path + " " + authorization + " " + requestBody.get("CategoryCode").asInt());
            return objectMapper.createObjectNode().put("ok", true);
        },
        (attempt, exception) -> {
        }
    );

    JsonNode result = client.post("/auctions/items", body);

    assertThat(result.get("ok").asBoolean()).isTrue();
    assertThat(calls).containsExactly("POST /auctions/items bearer token 200010");
}
```

If the existing test helper uses a different `properties(...)` method, keep that helper and only change the lambda body. This test should not call the real network.

- [ ] **Step 2: Run RED**

```bash
cd backend && ./mvnw -Dtest=LostarkApiClientTest test
```

Expected: compile failure because `post(String, JsonNode)` and the four-argument executor do not exist.

- [ ] **Step 3: Implement POST without changing GET callers**

Change `LostarkApiClient` to support both request styles:

```java
public JsonNode get(String path) {
    return request(HttpMethod.GET, path, null);
}

public JsonNode post(String path, JsonNode body) {
    return request(HttpMethod.POST, path, body);
}

private JsonNode request(HttpMethod method, String path, JsonNode body) {
    Optional<String> authorization = properties.authorization();

    if (authorization.isEmpty()) {
        throw new LostarkApiException(LostarkApiErrorCode.AUTH_ERROR, null, "Missing Lostark API authorization.");
    }

    for (int attempt = 0; attempt <= properties.retryCount(); attempt++) {
        try {
            return requestExecutor.execute(method, path, authorization.get(), body);
        } catch (LostarkApiException exception) {
            if (attempt >= properties.retryCount() || !isRetryable(exception.getCode())) {
                throw exception;
            }

            retryDelay.beforeRetry(attempt + 1, exception);
        }
    }

    throw new IllegalStateException("Lostark API retry loop exited unexpectedly.");
}

@FunctionalInterface
public interface RequestExecutor {
    JsonNode execute(HttpMethod method, String path, String authorization, JsonNode body);
}
```

Update the constructor adapter if needed so existing tests can pass `body -> null` for GET. Update `LostarkClientConfig` or the REST executor to send `.body(body)` only for non-null bodies.

- [ ] **Step 4: Run GREEN**

```bash
cd backend && ./mvnw -Dtest=LostarkApiClientTest test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/lostark/LostarkApiClient.java backend/src/test/java/com/rosaeng/sangdamso/lostark/LostarkApiClientTest.java
git commit -m "feat: add lostark api post support"
```

## Task 2: Extract Reusable Spec-Up Character Context

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpCharacterContext.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java`

- [ ] **Step 1: Add failing context test**

Add a test proving the context contains normalized fields needed by both character lookup and spec-up:

```java
@Test
void buildsReusableSpecUpContext() {
    FakeLostarkApiClient client = clientWithArmoryFixture();
    MarketSnapshotService market = marketSnapshotWithReadyFixture();
    CharacterService service = new CharacterService(client, market);

    SpecUpCharacterContext context = service.buildSpecUpContext("붐버", false);

    assertThat(context.characterName()).isEqualTo("붐버");
    assertThat(context.profile()).isNotNull();
    assertThat(context.equipment().isArray()).isTrue();
    assertThat(context.avatars().isArray()).isTrue();
    assertThat(context.engravings().isArray()).isTrue();
    assertThat(context.gems().isArray()).isTrue();
    assertThat(context.marketSnapshot()).isNotNull();
    assertThat(context.engravingBookPrices().isArray()).isTrue();
}
```

Use existing `CharacterServiceTest` fixtures where possible. If helper names differ, keep the assertions and wire the fake client the same way current tests do.

- [ ] **Step 2: Run RED**

```bash
cd backend && ./mvnw -Dtest=CharacterServiceTest test
```

Expected: compile failure because `SpecUpCharacterContext` and `buildSpecUpContext` do not exist.

- [ ] **Step 3: Add context record**

Create `SpecUpCharacterContext`:

```java
package com.rosaeng.sangdamso.efficiency;

import tools.jackson.databind.JsonNode;

public record SpecUpCharacterContext(
    String characterName,
    JsonNode profile,
    JsonNode equipment,
    JsonNode paradiseOrb,
    JsonNode avatars,
    JsonNode arkPassive,
    JsonNode arkGrid,
    JsonNode cards,
    JsonNode skills,
    JsonNode engravings,
    JsonNode gems,
    JsonNode classIdentityEffects,
    JsonNode criticalStats,
    JsonNode combatPowerAnalysis,
    JsonNode marketSnapshot,
    JsonNode engravingBookPrices
) {
}
```

- [ ] **Step 4: Extract context builder from `findCharacter`**

Move the current armory fetch and normalization block inside `CharacterService.findCharacter` into:

```java
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
```

Change `findCharacter` to call `buildSpecUpContext(characterName, false)` and then build `upgradeEfficiency` from that context. Change `loadMarketSnapshot()` to accept `boolean forceRefresh`.

- [ ] **Step 5: Run GREEN**

```bash
cd backend && ./mvnw -Dtest=CharacterServiceTest test
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpCharacterContext.java backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java
git commit -m "refactor: extract spec-up character context"
```

## Task 3: Port Accessory Normalization And Search Options

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java`

- [ ] **Step 1: Add failing tests**

Create `AccessoryNormalizerTest` with these tests:

```java
class AccessoryNormalizerTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AccessoryNormalizer normalizer = new AccessoryNormalizer();

    @Test
    void buildsRefinementSearchOptionsFromCurrentAccessory() {
        JsonNode accessory = toJsonNode(orderedMap(
            "Type", "목걸이",
            "DetailSections", List.of(orderedMap(
                "title", "연마 효과",
                "lines", List.of("추가 피해 +1.50%", "적에게 주는 피해 +0.90%")
            ))
        ));

        List<AccessoryNormalizer.SearchOption> options = normalizer.buildRefinementSearchOptions(accessory);

        assertThat(options).extracting(AccessoryNormalizer.SearchOption::secondOption).containsExactly(41, 42);
        assertThat(options).extracting(AccessoryNormalizer.SearchOption::minValue).containsExactly(150, 90);
        assertThat(options).extracting(AccessoryNormalizer.SearchOption::label)
            .containsExactly("추가 피해 1.50% 이상", "적에게 주는 피해 0.90% 이상");
    }

    @Test
    void normalizesAuctionAccessoryItem() {
        JsonNode raw = toJsonNode(orderedMap(
            "Name", "고대 목걸이",
            "Icon", "https://example.com/icon.png",
            "Grade", "고대",
            "GradeQuality", 92,
            "Tier", 4,
            "Level", 1700,
            "AuctionInfo", orderedMap("BuyPrice", 12345, "UpgradeLevel", 3, "TradeAllowCount", 2, "EndDate", "2026-05-29T00:00:00Z"),
            "Options", List.of(
                orderedMap("Type", "STAT", "OptionName", "힘", "Value", 12000, "IsValuePercentage", false),
                orderedMap("Type", "STAT", "OptionName", "치명", "Value", 500, "IsValuePercentage", false),
                orderedMap("Type", "ACCESSORY_UPGRADE", "OptionName", "추가 피해", "Value", 1.5, "IsValuePercentage", true),
                orderedMap("Type", "ARK_PASSIVE", "OptionName", "깨달음", "Value", 13, "IsValuePercentage", false)
            )
        ));

        JsonNode accessory = normalizer.normalizeAuctionAccessoryItem(raw, "목걸이");

        assertThat(accessory.get("Type").asString()).isEqualTo("목걸이");
        assertThat(accessory.get("BuyPrice").asInt()).isEqualTo(12345);
        assertThat(accessory.get("MainStatValue").asInt()).isEqualTo(12000);
        assertThat(accessory.get("EnlightenmentPoint").asInt()).isEqualTo(13);
        assertThat(accessory.get("DetailSections").get(0).get("title").asString()).isEqualTo("기본 효과");
        assertThat(accessory.get("DetailSections").get(1).get("title").asString()).isEqualTo("연마 효과");
    }

    @Test
    void rejectsIneligibleAccessoryCandidate() {
        JsonNode accessory = toJsonNode(orderedMap(
            "Type", "목걸이",
            "Grade", "고대",
            "Tier", 4,
            "Quality", 70,
            "BuyPrice", 10,
            "EnlightenmentPoint", 13
        ));

        AccessoryNormalizer.Eligibility eligibility = normalizer.isEligibleAccessoryCandidate(accessory);

        assertThat(eligibility.eligible()).isFalse();
        assertThat(eligibility.reason()).isEqualTo("QUALITY_BELOW_MAX_ENLIGHTENMENT_THRESHOLD");
    }

    private JsonNode toJsonNode(Object value) {
        return objectMapper.convertValue(value, JsonNode.class);
    }
}
```

- [ ] **Step 2: Run RED**

```bash
cd backend && ./mvnw -Dtest=AccessoryNormalizerTest test
```

Expected: compile failure because `AccessoryNormalizer` does not exist.

- [ ] **Step 3: Implement normalizer**

Create `AccessoryNormalizer` with:

```java
package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseDouble;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

public class AccessoryNormalizer {

    private static final Set<String> SUPPORTED_TYPES = Set.of("목걸이", "귀걸이", "반지");
    private static final int REFINEMENT_FIRST_OPTION = 7;
    private static final DecimalFormat PERCENT_FORMAT = new DecimalFormat("0.00");

    public List<SearchOption> buildRefinementSearchOptions(JsonNode accessory) {
        String type = text(accessory, "Type", "type");
        List<SearchOption> options = new ArrayList<>();

        for (String line : refinementLinesOf(accessory)) {
            SearchOption option = searchOptionForLine(type, line);
            if (option != null && options.stream().noneMatch(existing -> existing.secondOption() == option.secondOption())) {
                options.add(option);
            }
        }

        return options;
    }

    public JsonNode normalizeAuctionAccessoryItem(JsonNode item, String type) {
        JsonNode statOption = firstOption(item, "STAT", Set.of("힘", "민첩", "지능"));
        List<JsonNode> combatStats = options(item, "STAT", Set.of("치명", "특화", "신속"));
        List<JsonNode> refinementOptions = options(item, "ACCESSORY_UPGRADE", null);
        JsonNode enlightenmentOption = firstArkPassivePoint(item);
        List<Map<String, Object>> sections = new ArrayList<>();
        List<String> basicLines = new ArrayList<>();

        if (statOption != null) {
            basicLines.add(formatStatLine(statOption));
        }
        combatStats.stream().map(this::formatStatLine).forEach(basicLines::add);
        if (!basicLines.isEmpty()) {
            sections.add(orderedMap("title", "기본 효과", "lines", basicLines));
        }
        if (!refinementOptions.isEmpty()) {
            sections.add(orderedMap("title", "연마 효과", "lines", refinementOptions.stream().map(this::formatRefinementLine).toList()));
        }
        if (enlightenmentOption != null) {
            sections.add(orderedMap("title", "아크 패시브 포인트 효과", "lines", List.of(formatStatLine(enlightenmentOption))));
        }

        return toJsonNode(orderedMap(
            "Type", type,
            "Name", text(item, "Name"),
            "Icon", text(item, "Icon"),
            "Grade", text(item, "Grade"),
            "Quality", intValue(item, "GradeQuality"),
            "Tier", intValue(item, "Tier"),
            "ItemLevel", intValue(item, "Level"),
            "BuyPrice", intValue(child(item, "AuctionInfo"), "BuyPrice"),
            "UpgradeLevel", intValue(child(item, "AuctionInfo"), "UpgradeLevel"),
            "TradeRemainCount", intValue(child(item, "AuctionInfo"), "TradeAllowCount"),
            "EndDate", text(child(item, "AuctionInfo"), "EndDate"),
            "MainStatValue", statOption == null ? null : number(statOption, "Value"),
            "EnlightenmentPoint", enlightenmentOption == null ? null : number(enlightenmentOption, "Value"),
            "DetailSections", sections
        ));
    }

    public Eligibility isEligibleAccessoryCandidate(JsonNode accessory) {
        String type = text(accessory, "Type", "type");
        if (!SUPPORTED_TYPES.contains(type)) {
            return new Eligibility(false, "UNSUPPORTED_TYPE");
        }
        if (!"고대".equals(text(accessory, "Grade", "grade"))) {
            return new Eligibility(false, "UNSUPPORTED_GRADE");
        }
        if (intValue(accessory, "Tier", "tier") != 4) {
            return new Eligibility(false, "UNSUPPORTED_TIER");
        }
        if (intValue(accessory, "BuyPrice", "buyPrice") <= 0) {
            return new Eligibility(false, "MISSING_BUY_PRICE");
        }
        int point = intValue(accessory, "EnlightenmentPoint", "enlightenmentPoint");
        int quality = intValue(accessory, "Quality", "quality");
        if ((("목걸이".equals(type) && point >= 13) || (!"목걸이".equals(type) && point >= 9)) && quality < 90) {
            return new Eligibility(false, "QUALITY_BELOW_MAX_ENLIGHTENMENT_THRESHOLD");
        }
        return new Eligibility(true, "");
    }

    public String fingerprint(JsonNode accessory) {
        return String.join("|",
            text(accessory, "Type", "type"),
            text(accessory, "Name", "name"),
            String.valueOf(intValue(accessory, "Quality", "quality")),
            String.valueOf(intValue(accessory, "MainStatValue", "mainStatValue")),
            String.valueOf(intValue(accessory, "EnlightenmentPoint", "enlightenmentPoint")),
            refinementLinesOf(accessory).toString()
        );
    }

    public record SearchOption(int firstOption, int secondOption, int minValue, int maxValue, String label) {
        public Map<String, Object> requestMap() {
            return orderedMap("FirstOption", firstOption, "SecondOption", secondOption, "MinValue", minValue, "MaxValue", maxValue);
        }
    }

    public record Eligibility(boolean eligible, String reason) {
    }

    private SearchOption searchOptionForLine(String type, String line) {
        String text = line.replaceFirst("^(상|중|하)\\s+", "").replaceAll("\\s+", " ").trim();
        List<Rule> rules = List.of(
            new Rule("목걸이", 42, "적에게 주는 피해", true, List.of(24, 30, 37, 54, 55, 69, 84, 90, 115, 120, 140, 200), Pattern.compile("^적에게 주는 피해(?:\\s*증가)?\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
            new Rule("목걸이", 41, "추가 피해", true, List.of(31, 39, 48, 70, 90, 109, 117, 150, 160, 182, 260), Pattern.compile("^추가 피해\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
            new Rule("귀걸이", 45, "공격력", true, List.of(19, 24, 29, 40, 42, 54, 66, 70, 89, 95, 109, 155), Pattern.compile("^공격력\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
            new Rule("귀걸이", 46, "무기 공격력", true, List.of(36, 46, 56, 80, 82, 104, 126, 136, 172, 180, 210, 300), Pattern.compile("^무기 공격력\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
            new Rule("반지", 49, "치명타 적중률", true, List.of(19, 24, 29, 40, 42, 54, 66, 70, 89, 95, 109, 155), Pattern.compile("^치명타 적중률\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
            new Rule("반지", 50, "치명타 피해", true, List.of(48, 61, 74, 109, 110, 138, 170, 179, 230, 240, 282, 400), Pattern.compile("^치명타 피해\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%")),
            new Rule("", 53, "공격력", false, List.of(9, 14, 19, 24, 33, 40, 61, 68, 80, 118, 195, 390), Pattern.compile("^공격력\\s*\\+?\\s*(?<value>\\d+)$")),
            new Rule("", 54, "무기 공격력", false, List.of(23, 32, 50, 57, 75, 105, 147, 155, 195, 285, 480, 960), Pattern.compile("^무기 공격력\\s*\\+?\\s*(?<value>\\d+)$"))
        );

        for (Rule rule : rules) {
            if (!rule.type().isBlank() && !rule.type().equals(type)) {
                continue;
            }
            Matcher matcher = rule.pattern().matcher(text);
            if (!matcher.find()) {
                continue;
            }
            double parsed = Double.parseDouble(matcher.group("value"));
            int minValue = rule.percentage() ? (int) Math.round(parsed * 100) : (int) Math.round(parsed);
            int maxValue = rule.values().stream().mapToInt(Integer::intValue).max().orElse(minValue);
            String labelValue = rule.percentage() ? PERCENT_FORMAT.format(minValue / 100.0) + "%" : String.valueOf(minValue);
            return new SearchOption(REFINEMENT_FIRST_OPTION, rule.secondOption(), minValue, maxValue, rule.name() + " " + labelValue + " 이상");
        }

        return null;
    }

    private List<String> refinementLinesOf(JsonNode accessory) {
        List<String> lines = new ArrayList<>();
        for (JsonNode section : arrayItems(child(accessory, "DetailSections"))) {
            String title = text(section, "title", "Title");
            if (!title.contains("연마")) {
                continue;
            }
            for (JsonNode line : arrayItems(child(section, "lines"))) {
                lines.add(line.asString());
            }
            for (JsonNode line : arrayItems(child(section, "Lines"))) {
                lines.add(line.asString());
            }
        }
        return lines;
    }

    private JsonNode firstArkPassivePoint(JsonNode item) {
        return arrayItems(child(item, "Options")).stream()
            .filter(option -> Set.of("ARK_PASSIVE", "ARK_PASSIVE_POINT").contains(text(option, "Type")))
            .filter(option -> "깨달음".equals(text(option, "OptionName")))
            .findFirst()
            .orElse(null);
    }

    private JsonNode firstOption(JsonNode item, String type, Set<String> names) {
        return options(item, type, names).stream().findFirst().orElse(null);
    }

    private List<JsonNode> options(JsonNode item, String type, Set<String> names) {
        return arrayItems(child(item, "Options")).stream()
            .filter(option -> type.equals(text(option, "Type")))
            .filter(option -> names == null || names.contains(text(option, "OptionName")))
            .toList();
    }

    private String formatStatLine(JsonNode option) {
        return text(option, "OptionName") + " +" + wholeNumber(number(option, "Value"));
    }

    private String formatRefinementLine(JsonNode option) {
        String name = "적에게 주는 피해 증가".equals(text(option, "OptionName")) ? "적에게 주는 피해" : text(option, "OptionName");
        double value = number(option, "Value");
        return name + " +" + (Boolean.TRUE.equals(bool(option, "IsValuePercentage")) ? PERCENT_FORMAT.format(value) + "%" : wholeNumber(value));
    }

    private String text(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = child(node, field);
            if (value != null && !value.isNull() && !value.asString().isBlank()) {
                return value.asString();
            }
        }
        return "";
    }

    private int intValue(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = child(node, field);
            if (value != null && value.isNumber()) {
                return value.asInt();
            }
        }
        return 0;
    }

    private double number(JsonNode node, String field) {
        JsonNode value = child(node, field);
        return value == null || !value.isNumber() ? 0 : value.asDouble();
    }

    private Boolean bool(JsonNode node, String field) {
        JsonNode value = child(node, field);
        return value == null || !value.isBoolean() ? null : value.asBoolean();
    }

    private String wholeNumber(double value) {
        return Math.rint(value) == value ? String.valueOf((long) value) : String.valueOf(value);
    }

    private record Rule(String type, int secondOption, String name, boolean percentage, List<Integer> values, Pattern pattern) {
    }
}
```

- [ ] **Step 4: Run GREEN**

```bash
cd backend && ./mvnw -Dtest=AccessoryNormalizerTest test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizer.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryNormalizerTest.java
git commit -m "feat: port accessory normalization"
```

## Task 4: Port Accessory Auction Search

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchService.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchServiceTest.java`

- [ ] **Step 1: Add failing search service test**

Create a fake `LostarkApiClient` that records POST bodies and returns auction pages:

```java
@Test
void searchesMinimumThreePagesAndDeduplicatesCandidates() {
    FakeLostarkApiClient client = new FakeLostarkApiClient();
    AccessoryAuctionSearchService service = new AccessoryAuctionSearchService(client, new AccessoryNormalizer());
    JsonNode currentAccessory = toJsonNode(orderedMap(
        "Type", "목걸이",
        "DetailSections", List.of(orderedMap("title", "연마 효과", "lines", List.of("추가 피해 +1.50%")))
    ));

    AccessoryAuctionSearchService.SearchResult result = service.searchAccessoryCandidates("목걸이", currentAccessory, 6, false);

    assertThat(result.type()).isEqualTo("목걸이");
    assertThat(result.pagesFetched()).isEqualTo(3);
    assertThat(result.searchOptions()).containsExactly("추가 피해 1.50% 이상");
    assertThat(result.items()).hasSize(1);
    assertThat(result.items().get(0).get("TargetEquipmentIndex").asInt()).isEqualTo(6);
    assertThat(client.requests).hasSize(3);
    assertThat(client.requests.get(0).get("CategoryCode").asInt()).isEqualTo(200010);
    assertThat(client.requests.get(0).get("EtcOptions").get(0).get("SecondOption").asInt()).isEqualTo(41);
}
```

The fake client should return the same eligible item on each page so deduplication is required.

- [ ] **Step 2: Run RED**

```bash
cd backend && ./mvnw -Dtest=AccessoryAuctionSearchServiceTest test
```

Expected: compile failure because the service does not exist.

- [ ] **Step 3: Implement search service**

Core implementation:

```java
@Service
public class AccessoryAuctionSearchService {

    static final int MIN_PAGES_PER_TYPE = 3;
    static final int MAX_PAGES_PER_TYPE = 10;
    static final int MAX_CANDIDATES_PER_TYPE = 100;

    private final LostarkApiClient lostarkApiClient;
    private final AccessoryNormalizer normalizer;

    public SearchResult searchAccessoryCandidates(String type, JsonNode currentAccessory, int equipmentIndex, boolean forceRefresh) {
        int categoryCode = categoryCode(type);
        List<AccessoryNormalizer.SearchOption> options = normalizer.buildRefinementSearchOptions(currentAccessory);
        Map<String, JsonNode> candidatesByKey = new LinkedHashMap<>();
        int pagesFetched = 0;
        int rawItemsSeen = 0;
        int totalCount = 0;
        Instant updatedAt = Instant.now();

        for (int pageNo = 1; pageNo <= MAX_PAGES_PER_TYPE; pageNo++) {
            JsonNode body = toJsonNode(requestBody(categoryCode, pageNo, options));
            JsonNode raw = lostarkApiClient.post("/auctions/items", body);
            pagesFetched++;
            totalCount = Math.max(totalCount, intValue(raw, "TotalCount"));
            List<JsonNode> rawItems = arrayItems(child(raw, "Items"));
            rawItemsSeen += rawItems.size();

            for (JsonNode rawItem : rawItems) {
                JsonNode candidate = normalizer.normalizeAuctionAccessoryItem(rawItem, type);
                if (!normalizer.isEligibleAccessoryCandidate(candidate).eligible()) {
                    continue;
                }
                ObjectNode withTarget = (ObjectNode) candidate.deepCopy();
                withTarget.put("TargetEquipmentIndex", equipmentIndex);
                String key = equipmentIndex + "|" + normalizer.fingerprint(candidate) + "|price:" + text(candidate, "BuyPrice") + "|end:" + text(candidate, "EndDate");
                candidatesByKey.putIfAbsent(key, withTarget);
            }

            boolean passedMinimum = pageNo >= MIN_PAGES_PER_TYPE;
            boolean reachedLastPage = rawItems.isEmpty() || rawItemsSeen >= totalCount;
            boolean reachedLimit = candidatesByKey.size() >= MAX_CANDIDATES_PER_TYPE;
            if (passedMinimum && (reachedLastPage || reachedLimit)) {
                break;
            }
        }

        return new SearchResult(
            type,
            candidatesByKey.values().stream().limit(MAX_CANDIDATES_PER_TYPE).toList(),
            options.stream().map(AccessoryNormalizer.SearchOption::label).toList(),
            pagesFetched,
            updatedAt.toString()
        );
    }

    public record SearchResult(String type, List<JsonNode> items, List<String> searchOptions, int pagesFetched, String updatedAt) {
    }
}
```

Use `ArmoryJsonSupport.toJsonNode`, `arrayItems`, and `child`. Add small private helpers for `categoryCode`, `requestBody`, `intValue`, and `text`.

- [ ] **Step 4: Run GREEN**

```bash
cd backend && ./mvnw -Dtest=AccessoryAuctionSearchServiceTest test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryAuctionSearchServiceTest.java
git commit -m "feat: port accessory auction search"
```

## Task 5: Port Accessory Efficiency Scoring

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryEfficiencyService.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryEfficiencyServiceTest.java`

- [ ] **Step 1: Add failing scoring test**

Create a test with one current ring and one better ring:

```java
@Test
void ranksPositiveAccessoryReplacementByGoldPerCombatPowerPercent() {
    AccessoryEfficiencyService service = new AccessoryEfficiencyService();
    JsonNode profile = toJsonNode(orderedMap(
        "CharacterClassName", "창술사",
        "CombatPower", "1000000",
        "Stats", List.of(
            orderedMap("Type", "공격력", "Value", "100000"),
            orderedMap("Type", "치명", "Value", "1000")
        )
    ));
    JsonNode equipment = toJsonNode(List.of(
        orderedMap("Type", "무기", "Name", "+11 무기", "MainStatValue", 0, "WeaponPower", 100000),
        currentRing()
    ));
    JsonNode candidates = toJsonNode(List.of(betterRing(10000, 1)));
    Map<String, JsonNode> context = new LinkedHashMap<>();
    context.put("profile", profile);
    context.put("equipment", equipment);
    context.put("arkPassive", toJsonNode(orderedMap("Points", List.of(orderedMap("Name", "깨달음", "Value", 80)))));
    context.put("engravings", toJsonNode(List.of()));
    context.put("gems", toJsonNode(List.of()));
    context.put("criticalStats", null);

    JsonNode result = service.build(context, candidates);

    assertThat(result.get("Status").asString()).isEqualTo("ready");
    assertThat(result.get("TopRecommendation").get("Type").asString()).isEqualTo("accessory");
    assertThat(result.get("TopRecommendation").get("BuyPrice").asInt()).isEqualTo(10000);
    assertThat(result.get("Comparisons").size()).isEqualTo(1);
    assertThat(result.get("Comparisons").get(0).get("CombatPowerGainPercent").asDouble()).isGreaterThan(0);
}
```

Keep helper methods `currentRing()` and `betterRing(...)` in the test file. They should return maps with `Type`, `BuyPrice`, `TargetEquipmentIndex`, `DetailSections`, `MainStatValue`, and `EnlightenmentPoint`.

- [ ] **Step 2: Run RED**

```bash
cd backend && ./mvnw -Dtest=AccessoryEfficiencyServiceTest test
```

Expected: compile failure because `AccessoryEfficiencyService` does not exist.

- [ ] **Step 3: Implement scoring service**

Port the JavaScript behavior with these public and private boundaries:

```java
public JsonNode build(Map<String, JsonNode> context, JsonNode candidates) {
    Double currentEstimate = combatPowerEstimator.estimate(
        context.get("profile"),
        context.get("equipment"),
        context.get("engravings"),
        context.get("gems")
    );
    Double currentOfficial = number(context.get("profile"), "CombatPower");

    if (currentOfficial == null || currentOfficial <= 0 || currentEstimate == null || currentEstimate <= 0) {
        return toJsonNode(orderedMap(
            "Status", "unavailable",
            "TopRecommendation", null,
            "Comparisons", List.of(),
            "MissingInputs", List.of("현재 전투력 계산값")
        ));
    }

    List<Map<String, Object>> comparisons = arrayItems(candidates).stream()
        .filter(candidate -> Set.of("목걸이", "귀걸이", "반지").contains(text(candidate, "Type", "type")))
        .map(candidate -> bestReplacementForCandidate(context, candidate, currentOfficial, currentEstimate))
        .filter(Objects::nonNull)
        .sorted(Comparator.comparingDouble(item -> ((Number) item.get("GoldPerOnePercentCombatPower")).doubleValue()))
        .limit(3)
        .toList();

    if (comparisons.isEmpty()) {
        return toJsonNode(orderedMap("Status", "noRecommendation", "TopRecommendation", null, "Comparisons", List.of(), "MissingInputs", List.of()));
    }

    return toJsonNode(orderedMap("Status", "ready", "TopRecommendation", comparisons.get(0), "Comparisons", comparisons, "MissingInputs", List.of()));
}
```

Implement helpers from `lib/spec/accessoryEfficiencySimulation.js`:

- `matchingAccessoryIndexes`
- `replaceAccessoryAtIndex`
- `profileWithAccessoryStatDelta`
- `combatContextWithAccessoryDelta`
- `enlightenmentPointOf`
- `evaluateReplacement`

Use the existing `UpgradeCombatPowerEstimator` first. If its current method is too narrow for accessory deltas, add an overload that accepts modified `arkPassive` later in this task and update the test to prove enlightenment deltas affect the estimate.

- [ ] **Step 4: Run GREEN**

```bash
cd backend && ./mvnw -Dtest=AccessoryEfficiencyServiceTest test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/AccessoryEfficiencyService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/AccessoryEfficiencyServiceTest.java
git commit -m "feat: port accessory efficiency scoring"
```

## Task 6: Port Spec-Up Recommendation Merge

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpRecommendationService.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/SpecUpRecommendationServiceTest.java`

- [ ] **Step 1: Add failing merge test**

```java
@Test
void mergesAccessoryAndUpgradeCandidatesByEfficiencyScore() {
    SpecUpRecommendationService service = new SpecUpRecommendationService();
    JsonNode accessoryRecommendation = toJsonNode(orderedMap(
        "Status", "ready",
        "Comparisons", List.of(orderedMap(
            "Type", "accessory",
            "BuyPrice", 100000,
            "CombatPowerGainPercent", 1.0,
            "ReplacedEquipmentIndex", 6,
            "ReplacedAccessory", orderedMap("Type", "목걸이"),
            "Candidate", orderedMap("Type", "목걸이")
        )),
        "MissingInputs", List.of("악세 테스트")
    ));
    JsonNode upgradeEfficiency = toJsonNode(orderedMap(
        "MarketDataStatus", "ready",
        "Candidates", List.of(orderedMap(
            "Id", "gem-1",
            "Type", "gem",
            "Label", "보석 7->8",
            "CostGold", 200000,
            "NetCostGold", 200000,
            "GainPercent", 3.0,
            "GainType", "combatPower",
            "EfficiencyScore", 1.5,
            "ScoreUnit", "전투력 % / 10만 골드"
        )),
        "MissingInputs", List.of("강화 테스트")
    ));

    JsonNode result = service.build(accessoryRecommendation, upgradeEfficiency, 5);

    assertThat(result.get("Status").asString()).isEqualTo("ready");
    assertThat(result.get("TopCandidates").get(0).get("Type").asString()).isEqualTo("gem");
    assertThat(result.get("TopCandidates").get(1).get("Type").asString()).isEqualTo("accessory");
    assertThat(result.get("MissingInputs")).hasSize(2);
}
```

- [ ] **Step 2: Run RED**

```bash
cd backend && ./mvnw -Dtest=SpecUpRecommendationServiceTest test
```

Expected: compile failure because `SpecUpRecommendationService` does not exist.

- [ ] **Step 3: Implement merge service**

Implement the Java equivalent of `lib/spec/specUpRecommendation.js`:

```java
public JsonNode build(JsonNode accessoryRecommendation, JsonNode upgradeEfficiency, int limit) {
    List<Map<String, Object>> candidates = new ArrayList<>();
    arrayItems(child(accessoryRecommendation, "Comparisons")).stream()
        .map(this::normalizeAccessoryComparison)
        .filter(Objects::nonNull)
        .forEach(candidates::add);
    arrayItems(child(upgradeEfficiency, "Candidates")).stream()
        .map(this::normalizeUpgradeCandidate)
        .filter(Objects::nonNull)
        .forEach(candidates::add);
    candidates.sort(Comparator.comparingDouble(this::score).reversed());

    return toJsonNode(orderedMap(
        "Status", candidates.isEmpty() ? "noRecommendation" : "ready",
        "TopCandidates", candidates.stream().limit(limit).toList(),
        "AccessoryRecommendation", accessoryRecommendation,
        "UpgradeEfficiency", upgradeEfficiency,
        "MissingInputs", mergedMissingInputs(accessoryRecommendation, upgradeEfficiency)
    ));
}
```

Use `EfficiencyScore = GainPercent / NetCostGold * 100000` when an input candidate does not already provide a positive score.

- [ ] **Step 4: Run GREEN**

```bash
cd backend && ./mvnw -Dtest=SpecUpRecommendationServiceTest test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpRecommendationService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/SpecUpRecommendationServiceTest.java
git commit -m "feat: merge spec-up recommendations"
```

## Task 7: Add Spring Spec-Up Orchestration Service

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyService.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyServiceTest.java`

- [ ] **Step 1: Add failing orchestration test**

Use fakes for `CharacterService`, `AccessoryAuctionSearchService`, `AccessoryEfficiencyService`, `UpgradeEfficiencyService`, and `SpecUpRecommendationService`. Assert the service returns the current response contract:

```java
@Test
void buildsSpecUpEfficiencyResponse() {
    SpecUpEfficiencyService service = serviceWithReadyFakes();

    JsonNode result = service.findSpecUpEfficiency("붐버", false);

    assertThat(result.get("CharacterName").asString()).isEqualTo("붐버");
    assertThat(result.get("UpdatedAt").asString()).isNotBlank();
    assertThat(result.get("MarketUpdatedAt").asString()).isEqualTo("2026-05-29T00:00:00Z");
    assertThat(result.get("AccessoryMarketUpdatedAt").asString()).isEqualTo("2026-05-29T00:01:00Z");
    assertThat(result.get("SearchSummary").get(0).get("Type").asString()).isEqualTo("목걸이");
    assertThat(result.get("Recommendation").get("Status").asString()).isEqualTo("ready");
}
```

- [ ] **Step 2: Run RED**

```bash
cd backend && ./mvnw -Dtest=SpecUpEfficiencyServiceTest test
```

Expected: compile failure because `SpecUpEfficiencyService` does not exist.

- [ ] **Step 3: Implement service**

Core behavior:

```java
@Service
public class SpecUpEfficiencyService {

    public JsonNode findSpecUpEfficiency(String characterName, boolean forceRefresh) {
        SpecUpCharacterContext context = characterService.buildSpecUpContext(characterName, forceRefresh);
        AccessorySearchBundle accessorySearch = searchAccessories(context, forceRefresh);
        JsonNode accessoryRecommendation = buildAccessoryRecommendation(context, accessorySearch.candidates());
        JsonNode upgradeEfficiency = upgradeEfficiencyService.build(upgradeEfficiencyContext(context));
        JsonNode recommendation = recommendationService.build(accessoryRecommendation, upgradeEfficiency, 5);

        return toJsonNode(orderedMap(
            "CharacterName", context.characterName(),
            "UpdatedAt", Instant.now(clock).toString(),
            "MarketUpdatedAt", text(context.marketSnapshot(), "updatedAt", "UpdatedAt"),
            "AccessoryMarketUpdatedAt", accessorySearch.updatedAt(),
            "SearchSummary", accessorySearch.searchSummary(),
            "Recommendation", recommendation
        ));
    }
}
```

`searchAccessories` should:

- inspect `context.equipment()`,
- select `목걸이`, `귀걸이`, `반지`,
- call `AccessoryAuctionSearchService.searchAccessoryCandidates(type, item, index, forceRefresh)`,
- catch auction failures and return an empty candidate array plus `AccessoryRecommendation.Status: "unavailable"` later,
- aggregate search summaries.

`upgradeEfficiencyContext` should pass the same keys currently used by `CharacterService.upgradeEfficiencyContext`.

- [ ] **Step 4: Run GREEN**

```bash
cd backend && ./mvnw -Dtest=SpecUpEfficiencyServiceTest test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyService.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyServiceTest.java
git commit -m "feat: orchestrate spec-up efficiency"
```

## Task 8: Add Spring Controller Contract

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyController.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyControllerTest.java`

- [ ] **Step 1: Add failing controller test**

```java
@WebMvcTest(SpecUpEfficiencyController.class)
@Import({GlobalExceptionHandler.class, SpecUpEfficiencyControllerTest.TestConfig.class})
class SpecUpEfficiencyControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired FakeSpecUpEfficiencyService service;

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

        assertThat(service.forceRefresh).isTrue();
    }
}
```

- [ ] **Step 2: Run RED**

```bash
cd backend && ./mvnw -Dtest=SpecUpEfficiencyControllerTest test
```

Expected: compile failure because controller does not exist.

- [ ] **Step 3: Implement controller**

```java
@RestController
@RequestMapping("/api/efficiency/spec-up")
public class SpecUpEfficiencyController {

    private final SpecUpEfficiencyService service;

    public SpecUpEfficiencyController(SpecUpEfficiencyService service) {
        this.service = service;
    }

    @GetMapping("/{name}")
    public JsonNode findSpecUpEfficiency(
        @PathVariable String name,
        @RequestParam(name = "refresh", defaultValue = "0") String refresh
    ) {
        String trimmedName = name.trim();

        if (trimmedName.isEmpty()) {
            throw new BffException(HttpStatus.BAD_REQUEST, "INVALID_CHARACTER_NAME", "조회할 캐릭터명을 입력해줘.");
        }

        return service.findSpecUpEfficiency(trimmedName, "1".equals(refresh) || "true".equalsIgnoreCase(refresh));
    }
}
```

- [ ] **Step 4: Run GREEN**

```bash
cd backend && ./mvnw -Dtest=SpecUpEfficiencyControllerTest test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyController.java backend/src/test/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyControllerTest.java
git commit -m "feat: add spec-up efficiency endpoint"
```

## Task 9: Switch Route Ownership And Remove Replaced Next Route

**Files:**
- Delete: `app/api/efficiency/spec-up/[name]/route.js`
- Modify: `docs/backend-api-ownership.md`
- Modify: `docs/development-log.md`

- [ ] **Step 1: Verify frontend calls same path**

Run:

```bash
rg -n "api/efficiency/spec-up|/efficiency/spec-up" app components lib tests
```

Expected: `components/CombatPowerEfficiencyPage.jsx` calls `/api/efficiency/spec-up/${encodeURIComponent(normalizedName)}` and does not import the deleted route directly.

- [ ] **Step 2: Delete replaced Next route**

Delete:

```text
app/api/efficiency/spec-up/[name]/route.js
```

No UI code should change because the browser path stays the same.

- [ ] **Step 3: Update ownership docs**

Update `docs/backend-api-ownership.md` table:

```markdown
| `/api/efficiency/spec-up/{name}` | Spring Boot | Spring Boot | Spring owner active; Next route removed |
| `/api/efficiency/accessories/recovery` | Next.js | Spring Boot | Follow-up migration |
```

Append to `docs/development-log.md` under 2026-05-29:

```markdown
- Spring `GET /api/efficiency/spec-up/{name}`가 악세 교체 추천과 강화/보석/각인/아바타 후보를 통합해 Top 5를 반환하도록 추가했다.
- 기존 Next.js `app/api/efficiency/spec-up/[name]/route.js`는 Spring 소유권 활성화 후 제거했다.
- `/api/efficiency/accessories/recovery`는 별도 후속 이식 대상으로 남겼다.
```

- [ ] **Step 4: Commit**

```bash
git add app/api/efficiency/spec-up/[name]/route.js docs/backend-api-ownership.md docs/development-log.md
git commit -m "chore: move spec-up route ownership to spring"
```

## Task 10: Full Verification

**Files:**
- All changed files

- [ ] **Step 1: Run focused backend tests**

```bash
cd backend && ./mvnw -Dtest=LostarkApiClientTest,CharacterServiceTest,AccessoryNormalizerTest,AccessoryAuctionSearchServiceTest,AccessoryEfficiencyServiceTest,SpecUpRecommendationServiceTest,SpecUpEfficiencyServiceTest,SpecUpEfficiencyControllerTest test
```

Expected: all focused tests pass.

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && ./mvnw test
```

Expected: all backend tests pass.

- [ ] **Step 3: Run frontend tests and build**

```bash
npm test
npm run lint
npm run build
```

Expected: tests pass, lint exits 0, build succeeds.

- [ ] **Step 4: Check diff hygiene**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. `git status --short` should only show intentional final changes if any remain.

- [ ] **Step 5: Final commit if verification changed docs or tests**

If Task 10 produced any intentional changes:

```bash
git add <changed-files>
git commit -m "test: verify spring spec-up efficiency api"
```

## Self-Review

- Spec coverage: the plan covers Spring endpoint ownership, accessory auction search, accessory normalization, accessory replacement scoring, upgrade-efficiency reuse, Top 5 merge, partial failure behavior, route ownership docs, and verification.
- Scope check: recovery API is intentionally excluded and documented as a follow-up.
- Placeholder scan: no unfinished marker or unspecified test command remains.
- Type consistency: route path, response field names, and score fields match the approved design and existing frontend contract.
