# Spring Calculation Migration

이 문서는 프론트엔드 계산식을 Spring Boot BFF로 완전히 이전하기 위한 진행표다.

## Baseline

| Check | Result | Notes |
| --- | --- | --- |
| Frontend tests | PASS | `npm test` → 126 passed after adding golden fixture export coverage |
| Backend tests | PASS in WSL | User ran WSL Ubuntu backend test: 162 tests, 0 failures, 0 errors, BUILD SUCCESS |

## Ownership Rule

Java/Spring Boot가 browser-facing API 계산 결과의 source of truth다.

- `app/*`와 `components/*`는 계산하지 않는다.
- `lib/ui/*`는 표시, 링크, 상태, 문구 조립만 담당한다.
- `lib/spec/*`와 `lib/lostark/*`는 현재 reference/parity-test model로 남아 있지만 runtime UI가 직접 import하면 안 된다.
- JS와 Java 결과가 다를 경우 먼저 fixture와 domain rule을 확인한다.

## Frontend Calculation Inventory

| Frontend file | Export/function | Spring target | Status | Test mapping |
| --- | --- | --- | --- | --- |
| `lib/spec/mainStats.js` | `buildMainStatSummary` | `spec/MainStatsService` | migrated / verify parity | `MainStatsServiceTest` |
| `lib/spec/criticalStats.js` | `buildCriticalStats` | `spec/CriticalStatsService` | migrated / verify parity | `CriticalStatsServiceTest` |
| `lib/spec/avatarStats.js` | `buildAvatarStatSummary` | `spec/AvatarStatsService` | migrated / verify parity | `AvatarStatsServiceTest` |
| `lib/spec/classIdentityEffects.js` | `buildClassIdentityEffects` | `spec/ClassIdentityService` | migrated / verify parity | `ClassIdentityServiceTest` |
| `lib/spec/combatPowerModel.js` | `buildCombatPowerAnalysis` | `spec/CombatPowerAnalysisService` | partial / high priority verify | `CombatPowerAnalysisServiceTest` |
| `lib/spec/upgradeEfficiency.js` | `buildUpgradeEfficiency` | `spec/UpgradeEfficiencyService` | migrated / high priority verify | `UpgradeEfficiencyServiceTest` |
| `lib/spec/specUpRecommendation.js` | `buildSpecUpRecommendation` | `efficiency/SpecUpRecommendationService` | migrated / high priority verify | `SpecUpRecommendationServiceTest` |
| `lib/spec/accessoryEfficiencySimulation.js` | `replaceAccessoryAtIndex`, `buildAccessoryEfficiencyRecommendation` | `efficiency/AccessoryEfficiencyService` | migrated / high priority verify | `AccessoryEfficiencyServiceTest` |
| `lib/spec/accessoryRecoveryEstimate.js` | `percentile`, `summarizeExactMatchPrices`, `buildRecoveryEstimate` | `efficiency/AccessoryRecoveryEstimateService` | migrated / verify parity | `AccessoryRecoveryEstimateServiceTest` |
| `lib/spec/accessoryContributions.js` | `formatContributionPercent`, `isAccessoryType`, `parseAccessoryEffectLine`, `buildAccessoryContributionIndex` | `spec/AccessoryContributionService` or embedded calculator | pending | new Java parity test |
| `lib/spec/engravingContributions.js` | `formatEngravingContributionPercent`, `buildEngravingContributionIndex` | `spec/EngravingContributionService` or embedded calculator | pending | new Java parity test |
| `lib/spec/damageModel.js` | ratio/multiplier helpers | `spec/DamageModel` shared helper | pending | new Java parity test |
| `lib/spec/accessoryDisplay.js` | `getMainStatNameForClass`, `buildAccessoryDisplay` | DTO/display mapper or `lib/ui` only | decide | existing accessory display tests |

## `/api/efficiency/spec-up/{name}` Contract

Spring owner:

- Controller: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyController.java`
- Service: `backend/src/main/java/com/rosaeng/sangdamso/efficiency/SpecUpEfficiencyService.java`

Current top-level response fields from `SpecUpEfficiencyService`:

| Field | Meaning | Notes |
| --- | --- | --- |
| `CharacterName` | resolved character name | required for display |
| `UpdatedAt` | response calculation timestamp | UTC instant string |
| `MarketUpdatedAt` | market snapshot timestamp | may be null |
| `AccessoryMarketUpdatedAt` | latest accessory auction search timestamp | may be null |
| `SearchSummary` | accessory candidate search summaries | array |
| `Recommendation` | unified Top 5 recommendation result | required calculation payload |

Current `Recommendation` responsibilities:

- Merge accessory replacement recommendation and upgrade efficiency candidates.
- Produce top candidates for the UI panels.
- Keep calculation/ranking in Spring, not in React.

Frontend display-only assumptions:

- Components may check for missing/null fields defensively.
- Components may format labels, prices, percentages, and fallback copy.
- Components may not recompute recommendation ranking.
- Components may not estimate combat power from raw armory sections.
- Components may not call `lib/spec/*` directly.

## Frontend API Usage Check

Current observed usage:

- `components/CombatPowerEfficiencyPage.jsx` calls `GET /api/efficiency/spec-up/${encodeURIComponent(normalizedName)}`.
- `components/CombatPowerEfficiencyPage.jsx` calls `POST /api/efficiency/accessories/recovery` for recovery estimates.
- `components/CombatPowerEfficiencyPage.jsx` calls `POST /api/consult/sggu` for Sggu consultation using the API result.
- `components/SpecUpRecommendationPanel.jsx` and `components/AccessoryRecommendationPanel.jsx` render API result objects.

Existing architecture guard:

- `tests/projectStructure.test.js` already checks that browser UI does not import Lostark/spec reference modules directly.

## Next Implementation Order

1. Use WSL Ubuntu for backend tests (`export PATH="/home/user/.local/bin:$PATH"`).
2. Golden fixture export now covers initial parity seeds:
   - `main-stats.json`
   - `damage-model.json`
   - `spec-up-recommendation.json`
   - `accessory-recovery-estimate.json`
3. Java fixture sanity test reads `backend/src/test/resources/golden/*.json` and passes in WSL.
4. Java `DamageModel` parity against `damage-model.json` passes in WSL.
5. `CriticalStatsService` now delegates critical-rate/evolution-damage rounding helpers to `DamageModel`; user-confirmed related and full backend tests pass in WSL.
6. `CombatPowerAnalysisService` now delegates percent rounding to `DamageModel`; user-confirmed targeted and full backend tests pass in WSL.
7. `CombatPowerAnalysisService` partial JS parity seed is fixed against `combat-power-analysis.json`; user-confirmed full backend tests pass in WSL after updating `CharacterServiceTest` to the JS-aligned `unavailable` status when base attack inputs are missing.
8. `UpgradeEfficiencyService` JS parity seed is fixed against `upgrade-efficiency.json`; user-confirmed targeted Java tests pass in WSL.
9. `SpecUpRecommendationService` JS parity seed is fixed against `spec-up-recommendation.json`; user-confirmed targeted Java tests pass in WSL.
10. `AccessoryEfficiencyService` JS parity seed is fixed against `accessory-efficiency.json`; user-confirmed targeted and full backend tests pass in WSL after aligning combat-stat profile delta and rounded estimate semantics.
11. `AccessoryRecoveryEstimateService` JS parity seed is fixed against `accessory-recovery-estimate.json`; user-confirmed targeted Java tests pass in WSL with JS gross recovery mapped to Java `EstimatedGrossRecoveryGold` while preserving Java fee-aware net fields.
12. `AccessoryContributionService` JS parity seed is fixed against `accessory-contribution.json`; user-confirmed targeted Java tests pass in WSL.
13. `EngravingContributionService` JS parity seed is fixed against `engraving-contribution.json`; user-confirmed targeted Java tests pass in WSL.
14. User-confirmed full backend `./mvnw test` passes in WSL after completing the Java parity services.
15. Frontend production import quarantine is implemented: `CharacterResponse` now exposes backend-owned `mainStats`, `avatarStats`, `accessoryContributions`, and `engravingContributions`; browser components consume those response fields instead of `lib/spec/*` wrappers; stale `lib/ui/*` wrapper modules and unused `lib/lostark/characterEfficiencyContext.js` were removed; `tests/projectStructure.test.js` now guards `app`, `components`, `lib/ui`, and `lib/lostark` from direct `lib/spec`/`lib/lostark` production imports. User-facing frontend behavior still needs backend WSL test confirmation after the response-contract expansion.

## Verification Commands

Frontend:

```bash
cd '/c/새 폴더/lostark'
npm test
npm run lint
npm run build
```

Backend, after Java is available:

```bash
cd '/c/새 폴더/lostark/backend'
./mvnw test
```

Production import guard:

```bash
cd '/c/새 폴더/lostark'
grep -R "../lib/spec\|@/lib/spec\|lib/spec" -n app components --include='*.js' --include='*.jsx'
```

Expected: no output.

## Backend Test Environment

Hermes/Git Bash still does not expose `java`, but WSL Ubuntu has a working JDK 21 and backend tests pass there.

User-confirmed WSL Ubuntu Java:

```text
/home/user/.local/bin/java
openjdk version "21.0.11" 2026-04-21 LTS
/home/user/.local/bin/javac
javac 21.0.11
```

User-confirmed backend baselines in WSL Ubuntu:

```text
Initial baseline: Tests run: 162, Failures: 0, Errors: 0, Skipped: 0, BUILD SUCCESS
After GoldenFixtureTest: all tests passed again (expected count: 163)
```

Use WSL Ubuntu for backend verification:

```bash
export PATH="/home/user/.local/bin:$PATH"
cd "/mnt/c/새 폴더/lostark/backend"
./mvnw test
```
