# Upgrade Efficiency Model Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the upgrade-efficiency recommendation engine from JavaScript runtime ownership into Spring Boot and return ranked candidates from `upgradeEfficiency.Candidates`.

**Architecture:** Keep JavaScript as the parity reference while Java becomes the runtime source of truth. Split the Java implementation into small services: market cost extraction, candidate building, combat-power delta estimation, and character-service wiring. Use failing Java tests for each candidate family before implementation.

**Tech Stack:** Spring Boot 4, Java 21, Jackson `JsonNode`, Maven/JUnit/AssertJ, existing Next.js response contract.

---

## File Structure

- Create `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyConstants.java`
  - Holds honing materials, honing tables, gem basic-attack table, and engraving combat-power tables.
- Create `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeMarketCostService.java`
  - Converts `marketSnapshot` into cost inputs for honing, avatars, gems, accessories, and engraving books.
- Create `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeCombatPowerEstimator.java`
  - Estimates the combat-power value needed for gem and engraving deltas using the same model slices currently used by JS upgrade-efficiency candidates.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyService.java`
  - Builds rank-safe candidates and returns `MarketDataStatus`, `UpdatedAt`, `CostInputs`, `Candidates`, `Insights`, and `MissingInputs`.
- Modify `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`
  - Injects `MarketSnapshotService` and passes snapshot, avatars, engravings, ark passive, ark grid, cards, and paradise orb into upgrade-efficiency context.
- Modify tests under `backend/src/test/java/com/rosaeng/sangdamso/spec/`.

## Task 1: Lock Current Empty-Service Failure With Honing Fixture

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyServiceTest.java`

- [ ] **Step 1: Add failing test for honing candidates**

Add a test fixture with the existing JS market snapshot shape and 11강 weapon/armor equipment. Assert:

```java
assertThat(result.get("MarketDataStatus").asString()).isEqualTo("ready");
assertThat(result.get("CostInputs").get("Honing").get("WeaponMaterials").size()).isEqualTo(5);
assertThat(result.get("Candidates")).anySatisfy(candidate ->
    assertThat(candidate.get("Type").asString()).isEqualTo("weaponHoning"));
assertThat(result.get("Candidates")).anySatisfy(candidate ->
    assertThat(candidate.get("Type").asString()).isEqualTo("armorHoning"));
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeEfficiencyServiceTest test
```

Expected: fails because `Candidates` is empty.

## Task 2: Port Market Cost Inputs And Honing Candidates

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyConstants.java`
- Create: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeMarketCostService.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyService.java`
- Test: `backend/src/test/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyServiceTest.java`

- [ ] **Step 1: Add constants**

Copy JS constants for:

- `WEAPON_POWER_BY_LEVEL`
- `ARMOR_MAIN_STAT_BY_SLOT`
- `HONING_PROBABILITY_BY_TARGET_LEVEL`
- `HONING_BREATH_BY_TARGET_LEVEL`
- `WEAPON_HONING_AMOUNTS_BY_TARGET_LEVEL`
- `ARMOR_HONING_AMOUNTS_BY_TARGET_LEVEL`
- `SHARD_POUCH_SIZES`

- [ ] **Step 2: Implement cost extraction**

Build `CostInputs.Honing.WeaponMaterials` and `CostInputs.Honing.ArmorMaterials` from snapshot groups `honing-materials` and `honing-supports`. Normalize bundle prices into `UnitPrice`; for shards choose the cheapest price per shard across pouch sizes.

- [ ] **Step 3: Implement expected honing cost**

Use:

```text
expectedAttempts = 1 / effectiveProbability
materialCost = sum(requiredAmount * unitPrice)
expectedCostGold = (materialCost + rawGold) * expectedAttempts
```

For breath material, choose breath only when full-breath expected cost beats no-breath expected cost.

- [ ] **Step 4: Implement candidates**

Return `weaponHoning` and `armorHoning` candidates with existing PascalCase keys and `EfficiencyScore = GainPercent / NetCostGold * 100000`.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeEfficiencyServiceTest test
```

Expected: pass.

## Task 3: Port Legendary Avatar Candidates

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyServiceTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyService.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeMarketCostService.java`

- [ ] **Step 1: Add failing avatar test**

Use a snapshot with `legendary-avatars` items for `머리` and `상의`, and avatars where `머리` has applied `Value: 1` and `상의` has applied `Value: 2`. Assert Java returns only `legendaryAvatar` for `머리`.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeEfficiencyServiceTest test
```

Expected: avatar test fails because the candidate is absent.

- [ ] **Step 3: Implement avatar candidates**

Read applied avatar stat by slot from `StatEffects` only when `IsStatApplied`, `IsInner`, or `isInner` is true. Use target stat percent `2`. Candidate `GainType` is `mainStatPercent` and caveat is `아바타 주스탯 기준. 실제 최종 피해 환산은 주스탯-공격력 모델 필요`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeEfficiencyServiceTest test
```

Expected: pass.

## Task 4: Add Combat-Power Delta Estimator For Gems And Engravings

**Files:**
- Create: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeCombatPowerEstimator.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyConstants.java`
- Create: `backend/src/test/java/com/rosaeng/sangdamso/spec/UpgradeCombatPowerEstimatorTest.java`

- [ ] **Step 1: Add failing estimator tests**

Test two deltas:

- Changing one damage gem from level 7 to 8 increases estimate above current estimate.
- Changing `원한` from 유물 level 3 to level 4 increases estimate above current estimate.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeCombatPowerEstimatorTest test
```

Expected: fails because estimator class does not exist.

- [ ] **Step 3: Implement estimator**

Estimator inputs:

- `profile`
- `equipment`
- `arkPassive`
- `arkGrid`
- `cards`
- `engravings`
- `gems`
- `paradiseOrb`

Minimum supported slices for upgrade deltas:

- profile basic attack from 공격력 tooltip
- equipment fallback formula `sqrt(mainStat * weaponPower / 6)`
- basic attack percent from gem `AdditionalEffects`
- pure gem combat-power factor by level
- engraving combat-power table by book count and ability stone level
- combat level factor

Return `null` when neither profile basic attack nor equipment formula can produce a base attack value.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeCombatPowerEstimatorTest test
```

Expected: pass.

## Task 5: Port Gem Candidates

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyServiceTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyService.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeMarketCostService.java`

- [ ] **Step 1: Add failing gem candidate test**

Use current gem level 7, snapshot prices for level 7 and 8 damage gems, and a profile with basic attack tooltip. Assert candidate:

```java
assertThat(gemCandidate.get("Label").asString()).isEqualTo("라이징 스피어 7->8");
assertThat(gemCandidate.get("NetCostGold").asInt()).isEqualTo(100000);
assertThat(gemCandidate.get("GainType").asString()).isEqualTo("combatPower");
assertThat(gemCandidate.get("GainPercent").asDouble()).isGreaterThan(0);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeEfficiencyServiceTest test
```

Expected: fails because gem candidate is absent.

- [ ] **Step 3: Implement gem candidates**

Index snapshot `gems` by `GemLevel` and `GemEffectType`. Build next-level candidate when current level is below 10 and next price exists. Net cost is next price minus current price when current price exists and is lower, otherwise next price.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeEfficiencyServiceTest test
```

Expected: pass.

## Task 6: Port Engraving-Book Candidates

**Files:**
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyServiceTest.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeEfficiencyService.java`
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/spec/UpgradeMarketCostService.java`

- [ ] **Step 1: Add failing engraving candidate test**

Use `원한` level 3 and `아드레날린` level 4 with engraving-book cost inputs. Assert only `원한 각인 3->4` is recommended and `아드레날린 4->5` is excluded.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeEfficiencyServiceTest test
```

Expected: fails because engraving candidate is absent.

- [ ] **Step 3: Implement engraving candidates**

Use five-book cost inputs. Candidate target level is `currentLevel + 1`; current level `4` is excluded. Gain uses `UpgradeCombatPowerEstimator` current and next estimate.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=UpgradeEfficiencyServiceTest test
```

Expected: pass.

## Task 7: Wire Market Snapshot Into Character Lookup

**Files:**
- Modify: `backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java`
- Modify: `backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java`

- [ ] **Step 1: Add failing character-service test**

Construct `CharacterService` with a fake `MarketSnapshotService` or overload constructor dependency so a ready snapshot reaches `UpgradeEfficiencyService`. Assert `response.upgradeEfficiency().get("MarketDataStatus").asString()` is `ready`.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd backend && ./mvnw -Dtest=CharacterServiceTest test
```

Expected: fails because context has no market snapshot.

- [ ] **Step 3: Inject market snapshot safely**

Inject `MarketSnapshotService` into `CharacterService`. In character lookup, call `getSnapshot(false)` after armory normalization. If snapshot load throws `BffException`, pass no snapshot and let `UpgradeEfficiencyService` return `unavailable` instead of failing character lookup.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd backend && ./mvnw -Dtest=CharacterServiceTest test
```

Expected: pass.

## Task 8: Final Verification And Docs

**Files:**
- Modify: `docs/development-log.md`
- Modify: `docs/lostark-damage-formula.md` only if combat formula rules change beyond copied model slices.

- [ ] **Step 1: Update development log**

Add a 2026-05-29 entry saying Spring `UpgradeEfficiencyService` now owns ranked upgrade-efficiency candidates and lists supported candidate types.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
cd backend && ./mvnw test
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Commit**

Run:

```bash
git add backend/src/main/java/com/rosaeng/sangdamso/spec backend/src/main/java/com/rosaeng/sangdamso/character/CharacterService.java backend/src/test/java/com/rosaeng/sangdamso/spec backend/src/test/java/com/rosaeng/sangdamso/character/CharacterServiceTest.java docs/development-log.md docs/lostark-damage-formula.md
git commit -m "feat: migrate upgrade efficiency model to spring"
```
