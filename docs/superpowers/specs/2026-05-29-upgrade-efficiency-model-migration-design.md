# Upgrade Efficiency Model Migration Design

Date: 2026-05-29

## Decision

Spring Boot will become the authoritative engine for upgrade-efficiency recommendations. The full JavaScript upgrade-efficiency model will move into Java in phases, with the existing JavaScript implementation kept temporarily as the parity oracle.

This is larger than a narrow MVP, but it matches the project direction: Next.js renders the UI, while Spring Boot owns API behavior, market data, cache, character normalization, combat-power analysis, and Sggu consultation context.

## Goals

- Fill `upgradeEfficiency.Candidates` in `GET /api/characters/{name}` with real ranked spec-up candidates.
- Preserve current JavaScript model behavior while moving ownership to Spring Boot.
- Rank upgrade candidates by normalized efficiency: gain per gold.
- Keep uncertain calculations out of top rankings until parity tests prove them.
- Feed the same recommendation model into the armory UI, efficiency page, and Sggu consultation context.
- Remove JavaScript runtime ownership for upgrade-efficiency calculation after Java reaches parity.

## Non-Goals

- Redesign the armory UI.
- Add user accounts or saved budgets.
- Build a new market crawler beyond the current snapshot queries.
- Change combat-power formula rules without matching documentation updates.
- Delete JavaScript model code before Java parity is proven.

## Current State

Next.js and Java are split:

- `lib/spec/upgradeEfficiency.js` already builds honing, engraving-book, gem, and legendary-avatar candidates.
- `lib/spec/specUpRecommendation.js` merges accessory and upgrade candidates into top recommendations.
- UI components already display `upgradeEfficiency.Candidates` and `Recommendation.TopCandidates`.
- Spring Boot owns `/api/characters/{name}`, `/api/market/snapshot`, and `/api/consult/sggu`.
- `backend/.../UpgradeEfficiencyService.java` currently returns an empty `Candidates` array.
- `CharacterService` currently builds upgrade-efficiency context without a market snapshot, so Spring character lookup cannot calculate price-backed candidates yet.
- `backend/.../CombatPowerAnalysisService.java` is partial, so Java cannot safely rank gem and engraving candidates yet.

## Target Contract

`upgradeEfficiency` should keep the existing frontend-friendly shape:

```json
{
  "MarketDataStatus": "ready",
  "UpdatedAt": "2026-05-29T00:00:00Z",
  "CostInputs": {},
  "Candidates": [
    {
      "Id": "weapon-honing-11-12",
      "Type": "weaponHoning",
      "Label": "무기 11->12",
      "CostGold": 12345,
      "NetCostGold": 12345,
      "GainPercent": 0.1234,
      "GainType": "combatPower",
      "EfficiencyScore": 0.9999,
      "ScoreUnit": "전투력 % / 10만 골드",
      "Target": "무기",
      "CurrentLevel": 11,
      "TargetLevel": 12,
      "CostDetail": {},
      "Caveat": "노숨 기대비용 기준"
    }
  ],
  "Insights": [],
  "MissingInputs": []
}
```

`Candidates` contains only rank-safe candidates. `Insights` contains useful but not-yet-rank-safe guidance. `MissingInputs` names blocked inputs directly.

## Ranking Rule

All rank-safe candidates use:

```text
EfficiencyScore = GainPercent / NetCostGold * 100000
```

The score unit is `전투력 % / 10만 골드` when `GainType` is `combatPower`. If a candidate is not direct combat-power gain, such as main-stat-only avatar gain, it can enter the list only when its caveat clearly states the weaker basis.

## Migration Phases

### Phase 1: Cost Inputs And Honing Candidates

Port market-cost extraction and honing candidates first.

Scope:

- Honing material unit prices.
- Destiny shard pouch price normalization.
- Breath material detection.
- `MarketSnapshotService` injection into character lookup or an equivalent read-through service boundary.
- Graceful fallback when market snapshot is unavailable.
- Weapon honing `current -> next` candidate.
- Armor honing `current -> next` candidates.
- Expected honing cost using existing JavaScript constants and formulas.

Done when:

- Java tests match JavaScript fixture output for cost inputs.
- Java returns at least weapon and armor honing candidates when market data exists.
- `upgradeEfficiency.MarketDataStatus` is `ready` with market snapshot and `unavailable` without it.
- Character lookup still succeeds when the market snapshot cannot be loaded; the response reports missing market data instead of failing the whole armory request.

### Phase 2: Legendary Avatar Candidates

Port legendary-avatar recommendations.

Scope:

- Current applied avatar stat percent by slot.
- Legendary avatar floor price by slot.
- Candidate for each eligible slot below the target stat percent.
- Existing caveat: avatar gain is main-stat based, not full final-damage simulation.

Done when:

- Java tests match JavaScript fixture behavior for heroic and already-legendary avatar slots.
- Candidates sort correctly beside honing candidates.

### Phase 3: Combat-Power Model Parity Foundation

Make Java combat-power estimates strong enough for delta-based candidates.

Scope:

- Port JavaScript combat-power model slices required by gems and engraving books.
- Keep formula docs synchronized with any moved rule.
- Compare Java results against existing JavaScript regression fixtures within explicit tolerances.

Done when:

- Java can calculate current and modified combat-power estimates for gems and engravings.
- Existing known measured-character fixtures either pass or are documented as unsupported with a specific missing input.

### Phase 4: Gem Candidates

Port gem upgrade candidates.

Scope:

- Gem level and effect type indexing from market snapshot.
- Current-level and next-level price comparison.
- Net cost as next buy price minus current buy price when both are available.
- Level-based basic attack percent adjustment.
- Candidate gain from Java combat-power delta.

Done when:

- Java gem candidate tests match JavaScript fixture behavior.
- Missing gem price or unsupported effect type prevents ranking instead of creating a low-confidence candidate.

### Phase 5: Engraving-Book Candidates

Port engraving-book recommendations.

Scope:

- Current engraving level parsing.
- Target level capped at existing model rules.
- Five-book cost input.
- Candidate gain from Java combat-power delta.
- Missing market price reporting.

Done when:

- Java engraving-book candidate tests match JavaScript fixture behavior.
- Already capped engravings are excluded.

### Phase 6: Accessory Recommendation Integration

Merge accessory recommendation candidates into a unified Top 5.

Scope:

- Keep current accessory recommendation behavior as a separate service until parity is available.
- Normalize accessory comparisons into spec-up candidates.
- Sort accessory, honing, gem, engraving, and avatar candidates by the same score rule when candidate confidence is sufficient.

Done when:

- `Recommendation.TopCandidates` can be built from Java-owned candidates.
- Sggu context reads the same Top 5 that the UI displays.

### Phase 7: JavaScript Runtime Removal

Remove replaced JavaScript runtime ownership.

Scope:

- Stop using JavaScript upgrade-efficiency modules for runtime API responses.
- Keep JavaScript fixtures only if they remain useful for parity tests.
- Update docs and ownership notes.

Done when:

- Next.js no longer owns upgrade-efficiency API behavior.
- Java tests, frontend tests, lint, build, and backend smoke checks pass.

## Data Flow

```text
Lostark API
  -> Spring character normalizers
      -> equipment, avatars, gems, engravings, profile
Market snapshot
  -> Spring market cost inputs
Java spec services
  -> combatPowerAnalysis
  -> upgradeEfficiency.Candidates
  -> unified Recommendation.TopCandidates
Next.js UI
  -> render armory, upgrade panel, simulator link
Sggu consultant
  -> use same TopCandidates in compact context
```

## Error Handling

- Missing API key keeps existing `MISSING_API_KEY`.
- Lostark market or armory failure keeps existing `LOSTARK_API_ERROR`.
- Missing market snapshot returns `MarketDataStatus: "unavailable"` and empty candidates.
- Missing optional price inputs produce `MissingInputs`; they should not fail the character lookup.
- Unsupported formula inputs should keep candidates out of ranking until support exists.

## Testing Strategy

Testing uses parity before deletion:

- Java unit tests for each candidate type.
- Java fixture tests that mirror existing JavaScript `upgradeEfficiency.test.js` cases.
- Contract tests for `upgradeEfficiency` response shape.
- Character service tests that prove market snapshot presence flows into `UpgradeEfficiencyService`.
- UI tests only if response shape changes.
- Smoke check against a real character after each active-owner change.

Standard verification:

```bash
npm test
npm run lint
npm run build
cd backend && ./mvnw test
git diff --check
```

## Risks

- Calculation drift between JavaScript and Java.
  - Mitigation: JavaScript remains oracle until each phase passes parity tests.
- Combat-power model incompleteness.
  - Mitigation: rank only candidates whose required model slice has parity.
- Large migration scope.
  - Mitigation: phase gates prevent deleting JavaScript before Java can replace it.
- Market snapshot gaps.
  - Mitigation: report missing inputs and avoid fabricating rankings.

## Open Implementation Notes

- Prefer focused Java services over one large `UpgradeEfficiencyService` file as the model grows.
- Constants should be copied once into Java with tests that lock values used in calculations.
- Candidate DTO maps should preserve current PascalCase keys because the UI already consumes them.
- Any formula rule changed during porting must update `docs/lostark-damage-formula.md` in the same implementation phase.
