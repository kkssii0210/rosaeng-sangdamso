# Spring Boot Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Rosaeng Sangdamso application API behavior from Next.js API Routes into Spring Boot while keeping the browser-facing UI stable.

**Architecture:** Use a strangler migration. Each `/api/*` endpoint has one active owner at a time, first Next.js then Spring Boot after parity. Next.js remains UI-only after character, market, spec calculation, and Sggu consultation behavior move into Spring Boot.

**Tech Stack:** Next.js 16, React 19, Node test runner, Spring Boot 4, Java 21, Maven, Jackson `JsonNode`, Spring MVC tests.

---

## File Structure

### New Files

- `docs/superpowers/plans/2026-05-29-spring-boot-migration.md`
  - Master migration plan.
- `docs/backend-api-ownership.md`
  - Endpoint ownership table and migration state.
- `lib/api/backendRouting.js`
  - Frontend-side helper for stable same-origin API paths if UI needs centralization.
- `backend/src/main/java/com/rosaeng/sangdamso/character/ArmorySection.java`
  - Enum for Lostark armory section paths and response keys.
- `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterContractTest.java`
  - Spring response shape and error contract tests.
- `backend/src/main/java/com/rosaeng/sangdamso/market/*`
  - Spring market snapshot client, service, DTOs, cache.
- `backend/src/main/java/com/rosaeng/sangdamso/spec/*`
  - Java ports of calculation modules.
- `backend/src/main/java/com/rosaeng/sangdamso/consultant/*`
  - Sggu context/prompt/local LLM/RAG API code.

### Modified Files

- `next.config.mjs`
  - Adds opt-in rewrites for migrated endpoints.
- `README.md`
  - Documents two-process Spring Boot + Next.js development.
- `docs/development-log.md`
  - Records migration progress after each phase.
- `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`
  - Moves from raw armory assembly to normalized DTO assembly.
- `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterResponse.java`
  - Evolves with canonical DTO fields.
- `app/page.jsx`
  - Should keep calling `/api/characters/{name}`. No direct backend port should leak into UI.
- `app/api/characters/[name]/route.js`
  - Removed only after Spring parity and rewrite.
- `app/api/market/snapshot/route.js`
  - Removed only after Spring parity and rewrite.
- `app/api/consult/sggu/route.js`
  - Removed only after Spring parity and rewrite.

---

## Phase 1: Contract And Routing Foundation

### Task 1.1: Write Endpoint Ownership Document

**Files:**
- Create: `docs/backend-api-ownership.md`
- Modify: `docs/development-log.md`

- [ ] **Step 1: Add ownership table**

Create `docs/backend-api-ownership.md`:

```md
# Backend API Ownership

Date: 2026-05-29

| Browser Path | Active Owner | Target Owner | Migration State |
| --- | --- | --- | --- |
| `/api/characters/{name}` | Next.js | Spring Boot | Spring exists, parity incomplete |
| `/api/market/snapshot` | Next.js | Spring Boot | Not started |
| `/api/consult/sggu` | Next.js | Spring Boot | Not started |

Rules:

- UI code calls browser-facing same-origin paths only.
- One active owner per path.
- Spring Boot becomes active owner only after parity tests and smoke checks pass.
- Replaced Next.js API route is deleted after Spring Boot ownership is active.
```

- [ ] **Step 2: Verify document has no incomplete markers**

Run: `rg -n "TB[D]|TO[DO]|FIX[ME]" docs/backend-api-ownership.md`

Expected: exit `1`, no output.

- [ ] **Step 3: Commit**

```bash
git add docs/backend-api-ownership.md docs/development-log.md
git commit -m "docs: track backend api ownership"
```

### Task 1.2: Add Character Contract Tests

**Files:**
- Create: `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterContractTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterResponse.java` only if test exposes missing JSON field names.

- [ ] **Step 1: Write failing contract test**

Create `CharacterContractTest.java`:

```java
package com.rosaeng.sangdamso.character;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

class CharacterContractTest {

    private static final String[] EXPECTED_TOP_LEVEL_KEYS = {
        "profile",
        "equipment",
        "paradiseOrb",
        "avatars",
        "arkPassive",
        "arkGrid",
        "cards",
        "skills",
        "engravings",
        "gems",
        "classIdentityEffects",
        "criticalStats",
        "combatPowerAnalysis",
        "upgradeEfficiency"
    };

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void characterResponseKeepsFrontendTopLevelContract() {
        CharacterResponse response = new CharacterResponse(
            objectMapper.createObjectNode().put("CharacterName", "도화가"),
            objectMapper.createArrayNode(),
            null,
            objectMapper.createArrayNode(),
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            objectMapper.createArrayNode(),
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            null,
            null,
            null,
            null
        );

        Map<String, JsonNode> json = objectMapper.convertValue(response, Map.class);

        assertThat(json.keySet()).containsExactly(EXPECTED_TOP_LEVEL_KEYS);
    }
}
```

- [ ] **Step 2: Run test**

Run: `cd backend && ./mvnw -Dtest=CharacterContractTest test`

Expected: pass if current record field names match frontend contract; fail if Jackson field naming changed.

- [ ] **Step 3: Run backend tests**

Run: `cd backend && ./mvnw test`

Expected: `Tests run: 25`, `BUILD SUCCESS`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/com/rosaeng/sangdamso/character/CharacterContractTest.java backend/src/main/java/com/rosaeng/sangdamso/character/CharacterResponse.java
git commit -m "test: lock character response contract"
```

### Task 1.3: Add Opt-In Spring API Rewrite

**Files:**
- Modify: `next.config.mjs`
- Create: `tests/backendRouting.test.js` if a helper is introduced.

- [ ] **Step 1: Add opt-in rewrite**

Update `next.config.mjs` so local migration can route only selected paths to Spring Boot:

```js
const springApiBaseUrl = process.env.SPRING_API_BASE_URL || "http://127.0.0.1:8080";

const migratedApiPaths = (process.env.SPRING_API_PATHS || "")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);

const nextConfig = {
  async rewrites() {
    const beforeFiles = migratedApiPaths.map((source) => ({
      source,
      destination: `${springApiBaseUrl}${source}`
    }));

    return {
      beforeFiles
    };
  }
};

export default nextConfig;
```

Example:

```bash
SPRING_API_PATHS=/api/characters/:path* npm run dev
```

- [ ] **Step 2: Run lint and build**

Run: `npm run lint`

Expected: exit `0`.

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add next.config.mjs
git commit -m "chore: add opt-in spring api rewrites"
```

---

## Phase 2: Character Lookup Complete Migration

### Task 2.1: Introduce Armory Section Enum

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/ArmorySection.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`
- Test: `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java`

- [ ] **Step 1: Add enum**

```java
package com.rosaeng.sangdamso.character;

public enum ArmorySection {
    EQUIPMENT("equipment"),
    AVATARS("avatars"),
    ARK_PASSIVE("arkpassive"),
    ARK_GRID("arkgrid"),
    CARDS("cards"),
    SKILLS("combat-skills"),
    ENGRAVINGS("engravings"),
    GEMS("gems");

    private final String pathSegment;

    ArmorySection(String pathSegment) {
        this.pathSegment = pathSegment;
    }

    public String path(String basePath) {
        return basePath + "/" + pathSegment;
    }
}
```

- [ ] **Step 2: Replace string literals in `CharacterService`**

Use `ArmorySection.EQUIPMENT.path(basePath)` etc. Keep response fields unchanged.

- [ ] **Step 3: Run focused test**

Run: `cd backend && ./mvnw -Dtest=CharacterServiceTest test`

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/character/ArmorySection.java backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java
git commit -m "refactor: name armory sections"
```

### Task 2.2: Port Equipment Normalization

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizer.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/character/equipment/EquipmentNormalizerTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`

- [ ] **Step 1: Write failing test**

Test minimum contract first: excluded equipment types removed, output keeps `Type`, `Name`, `Icon`, `Grade`, `Quality`, `ItemLevelText`, `DetailSections`.

- [ ] **Step 2: Port from `lib/lostark/equipment.js` in slices**

Port only behavior covered by tests. Keep parsing helpers private.

- [ ] **Step 3: Wire into `CharacterService`**

Normalize `equipment` before response. Keep `paradiseOrb` extraction separate.

- [ ] **Step 4: Verify**

Run:

```bash
cd backend && ./mvnw -Dtest=EquipmentNormalizerTest,CharacterServiceTest test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/character backend/src/test/java/com/rosaeng/sangdamso/character
git commit -m "feat: normalize equipment in spring bff"
```

### Task 2.3: Port Cards, Gems, Avatars, Engravings Normalizers

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/cards/CardsNormalizer.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/gems/GemsNormalizer.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/avatar/AvatarNormalizer.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/character/engraving/EngravingsNormalizer.java`
- Create matching `*Test.java` files.
- Modify: `CharacterService.java`

- [ ] **Step 1: For each module, copy current JS fixture behavior into Java tests**

Use fixture snippets from existing `tests/cards.test.js`, `tests/gems.test.js`, `tests/avatars.test.js`, and `tests/engravings.test.js`.

- [ ] **Step 2: Implement minimal Java normalizer**

Use `JsonNode` input/output first. Introduce typed DTO only if repeated access becomes unclear.

- [ ] **Step 3: Wire normalizers**

Spring response should return normalized sections for `avatars`, `cards`, `engravings`, and `gems`.

- [ ] **Step 4: Verify**

Run:

```bash
cd backend && ./mvnw -Dtest=*NormalizerTest,CharacterServiceTest test
npm test -- tests/cards.test.js tests/gems.test.js tests/avatars.test.js tests/engravings.test.js
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/character backend/src/test/java/com/rosaeng/sangdamso/character
git commit -m "feat: normalize armory sections in spring bff"
```

### Task 2.4: Port Combat And Upgrade Analysis By Fixture

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/spec/*`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/spec/*`
- Modify: `CharacterService.java`
- Modify: `docs/lostark-damage-formula.md` only when Java implementation clarifies a formula.

- [ ] **Step 1: Start with stable pure modules**

Port in this order:

1. `mainStats`
2. `avatarStats`
3. `cards`
4. `gems`
5. `criticalStats`
6. `combatPowerModel`
7. `upgradeEfficiency`

- [ ] **Step 2: For each module, create Java test from JS expected result**

Example test shape:

```java
@Test
void computesExpectedCombatPowerForBomberFixture() {
    JsonNode armory = fixture("bomber-armory.json");

    CombatPowerResult result = combatPowerService.analyze(armory);

    assertThat(result.estimateFloor()).isEqualTo(5505);
}
```

- [ ] **Step 3: Port smallest implementation**

Keep one Java service per JS module. Do not combine unrelated formulas.

- [ ] **Step 4: Verify each slice**

Run:

```bash
cd backend && ./mvnw -Dtest=*SpecTest,*Combat*Test,*Upgrade*Test test
```

Expected: pass.

- [ ] **Step 5: Commit per module**

Use messages:

```bash
git commit -m "feat: port main stat calculations"
git commit -m "feat: port combat power analysis"
git commit -m "feat: port upgrade efficiency analysis"
```

---

## Phase 3: Market Snapshot And Cache Migration

### Task 3.1: Add Spring Market Snapshot API

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/market/MarketController.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/market/MarketSnapshotService.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/market/MarketSnapshotCache.java`
- Create tests under `backend/src/test/java/com/rosaeng/sangdamso/market/`

- [ ] **Step 1: Write controller tests**

Test missing key maps to `MISSING_API_KEY`; upstream failure maps to `LOSTARK_API_ERROR`.

- [ ] **Step 2: Implement service and cache**

Match current JS cache behavior: TTL, force refresh, concurrent refresh deduplication.

- [ ] **Step 3: Verify**

Run:

```bash
cd backend && ./mvnw -Dtest=Market*Test test
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/market backend/src/test/java/com/rosaeng/sangdamso/market
git commit -m "feat: add spring market snapshot api"
```

### Task 3.2: Switch Market Route Owner

**Files:**
- Modify: `docs/backend-api-ownership.md`
- Modify: `next.config.mjs`
- Delete: `app/api/market/snapshot/route.js` after rewrite verified.

- [ ] **Step 1: Enable rewrite path**

Use env:

```bash
SPRING_API_PATHS=/api/market/snapshot npm run dev
```

- [ ] **Step 2: Smoke test**

Run:

```bash
curl -s http://127.0.0.1:3000/api/market/snapshot | node -e "process.stdin.on('data', d => { const x = JSON.parse(d); console.log(Boolean(x.cacheExpiresAt)); })"
```

Expected: `true` for valid key environment.

- [ ] **Step 3: Delete replaced Next route**

Remove `app/api/market/snapshot/route.js`.

- [ ] **Step 4: Verify**

Run: `npm run build`

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add docs/backend-api-ownership.md next.config.mjs app/api/market/snapshot/route.js
git commit -m "chore: move market api ownership to spring"
```

---

## Phase 4: Spec-Up Calculation Migration

### Task 4.1: Retire Runtime JS Spec Imports

**Files:**
- Modify: `app/api/characters/[name]/route.js` until deleted.
- Modify: `app/page.jsx` only if payload assumptions need UI guarding.
- Modify: `docs/backend-api-ownership.md`

- [ ] **Step 1: Confirm no frontend component imports `lib/spec/*`**

Run:

```bash
rg "lib/spec|../lib/spec|../../lib/spec" app components lib/ui
```

Expected: no output.

- [ ] **Step 2: Move active character route to Spring**

Set ownership table for `/api/characters/{name}` to Spring Boot after Phase 2 parity.

- [ ] **Step 3: Delete Next character route**

Remove `app/api/characters/[name]/route.js`.

- [ ] **Step 4: Verify**

Run:

```bash
npm test
npm run lint
npm run build
cd backend && ./mvnw test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/characters docs/backend-api-ownership.md
git commit -m "chore: move character api ownership to spring"
```

---

## Phase 5: Sggu Consultant And RAG Migration

### Task 5.1: Add Spring Consultant API

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/ConsultantController.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguContextBuilder.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/SgguPromptBuilder.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/consultant/LocalLlmClient.java`
- Create tests under `backend/src/test/java/com/rosaeng/sangdamso/consultant/`

- [ ] **Step 1: Port validation behavior**

Match current errors:

- blank message -> `INVALID_MESSAGE`, HTTP `400`
- missing character context -> `INVALID_ARMORY`, HTTP `400`
- Ollama unavailable -> `LOCAL_LLM_UNAVAILABLE`, HTTP `503`
- Ollama bad response -> `LOCAL_LLM_ERROR`, HTTP `502`

- [ ] **Step 2: Port prompt/context behavior**

Keep compact context fields used by current `lib/consultant/sgguContext.js` and `sgguPrompt.js`.

- [ ] **Step 3: Verify**

Run:

```bash
cd backend && ./mvnw -Dtest=Consultant*Test,Sggu*Test,LocalLlm*Test test
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/consultant backend/src/test/java/com/rosaeng/sangdamso/consultant
git commit -m "feat: add spring sggu consultant api"
```

### Task 5.2: Move Consult Route Owner

**Files:**
- Modify: `docs/backend-api-ownership.md`
- Delete: `app/api/consult/sggu/route.js` after rewrite verified.

- [ ] **Step 1: Smoke test through Next rewrite**

Run local servers and call same-origin `/api/consult/sggu`.

- [ ] **Step 2: Delete Next consult route**

Remove `app/api/consult/sggu/route.js`.

- [ ] **Step 3: Verify**

Run:

```bash
npm test
npm run build
cd backend && ./mvnw test
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add docs/backend-api-ownership.md app/api/consult/sggu
git commit -m "chore: move consult api ownership to spring"
```

---

## Phase 6: Remove Next.js API Routes And Backend JS

### Task 6.1: Remove Replaced Runtime Routes

**Files:**
- Delete: `app/api/characters/[name]/route.js`
- Delete: `app/api/market/snapshot/route.js`
- Delete: `app/api/consult/sggu/route.js`
- Modify: `README.md`
- Modify: `docs/backend-api-ownership.md`

- [ ] **Step 1: Confirm no active Next API routes remain for migrated features**

Run:

```bash
find app/api -type f -name 'route.js' -print
```

Expected: no `characters`, `market`, or `consult` routes.

- [ ] **Step 2: Update README**

Document:

```md
Backend runs on `http://127.0.0.1:8080`.
Next.js renders UI and proxies migrated `/api/*` paths to Spring Boot in local development.
Run backend with `cd backend && ./mvnw spring-boot:run`.
Run frontend with `SPRING_API_PATHS=/api/characters/:path*,/api/market/snapshot,/api/consult/sggu npm run dev`.
```

- [ ] **Step 3: Verify full project**

Run:

```bash
npm test
npm run lint
npm run build
cd backend && ./mvnw test
git diff --check
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add app/api README.md docs/backend-api-ownership.md
git commit -m "chore: remove migrated next api routes"
```

### Task 6.2: Archive Or Delete Replaced JS Backend Modules

**Files:**
- Remove JS modules only when no frontend code or tests use them.
- Keep `lib/ui/*`.
- Keep tests only while they protect Java parity or frontend behavior.

- [ ] **Step 1: Find runtime imports**

Run:

```bash
rg "lib/lostark|lib/spec|lib/consultant|lib/llm" app components lib tests
```

- [ ] **Step 2: Remove modules with no runtime or test purpose**

Do not remove a module if a frontend component imports it.

- [ ] **Step 3: Verify**

Run:

```bash
npm test
npm run lint
npm run build
cd backend && ./mvnw test
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add lib tests
git commit -m "chore: remove replaced js backend modules"
```

---

## Final Verification

- [ ] Run full verification:

```bash
npm test
npm run lint
npm run build
cd backend && ./mvnw test
git diff --check
```

- [ ] Confirm ownership:

```bash
find app/api -type f -name 'route.js' -print
```

Expected: no migrated application API route remains.

- [ ] Confirm docs:

```bash
rg -n "Spring Boot" README.md docs/backend-api-ownership.md docs/development-log.md
```

Expected: migration state documented.
