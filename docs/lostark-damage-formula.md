# Lostark Damage Formula Reference

Last updated: 2026-05-10

This is the project reference for spec-efficiency work. Read this file before changing calculation code under `lib/spec` or adding backend calculation endpoints.

## Sources

- Inven, "로스트빌드 만지다 포기한 사람들을 위한 옵션 정리": https://www.inven.co.kr/board/lostark/4821/109666
- Inven, "로스트아크의 데미지 계산식 한 장 정리 및 해설": https://www.inven.co.kr/board/lostark/4821/109679
- Lostark Open API observed endpoints:
  - `/armories/characters/{characterName}/equipment`
  - `/armories/characters/{characterName}/avatars`

The Inven posts are community research, not official Smilegate documentation. Treat the formulas as a working model and keep calculation code easy to revise.

## Core Shape

The referenced posts describe Lostark damage as a chain of independent categories. The broad shape we should model is:

```text
finalDamage =
  baseSkillDamage
  * attackPowerDerivedTerm
  * additionalDamageBucket
  * damageIncreaseBuckets
  * enemyDamageTakenBucket
  * enemyDefenseBucket
  * criticalBucket
  * skillSpecificBuckets
  * finalSkillMultipliers
```

For efficiency display, the preferred calculation is marginal contribution:

```text
contribution(option) = currentTotalMultiplier / totalMultiplierWithoutOption - 1
```

This is more stable than assigning a raw value directly, because additive buckets lose efficiency as their bucket total grows.

Accessory contribution implementation: `lib/spec/accessoryContributions.js`.

- Accessory critical-rate and critical-damage lines use `criticalStats` as the current combat context when it is available.
- The accessory's own critical-rate and critical-damage lines are subtracted from that context before marginal contribution is calculated, then added back through the accessory entries. This prevents double counting.
- Critical rate is capped to 100% in the average critical multiplier.
- If `criticalStats` is unavailable, the fallback critical rate is the profile `치명` tooltip only.
- If the character has `뭉툭한 가시`, critical rate is capped by that node instead of the default 100% cap, and overcapped critical rate is converted into the evolution-damage bucket.
- `치명타 시 적에게 주는 피해` is included in the critical average model, so critical-rate and critical-damage marginal values account for 회심-style effects.

## Attack Power

Important terms from the referenced formula post:

- Pure attack power starts from main stat and weapon power.
- Basic attack power applies "basic attack power increase" effects.
- Final attack power applies flat attack increases and attack increase rates.
- Skill damage starts from the skill's own base damage plus an attack-power coefficient.

Project implementation notes:

- `equipment` tooltip gives weapon power as a weapon `ItemPartBox` line such as `무기 공격력 +259554`.
- We normalize this as `equipment[].WeaponStats.WeaponPower.Value`.
- Weapon quality additional damage is a separate line such as `추가 피해 +30.00%`; normalize it as `equipment[].WeaponStats.AdditionalDamage.Value`.
- When only weapon power percent changes and main stat is fixed, damage contribution is approximately `sqrt(1 + weaponPowerPercent) - 1`. Exact final attack-power contribution needs current main stat, current weapon power, attack-power buckets, and Lostark rounding behavior.
- `아드레날린` is modeled at max stacks for attack power. Example: `공격력이 1.50% 증가, 최대 6중첩` is treated as `+9.0%` attack power in the current max-stack context.
- Accessory `공격력 +%` lines share the attack-power percent bucket with max-stack `아드레날린`, so their marginal contribution is calculated against the existing attack-power context.
- `깨달음` point progress has a hidden weapon-power percent bonus that is not exposed as a normal effect tooltip. Parse `arkPassive.Points[].Description` and add `깨달음 level * 0.1%` as weapon power. Example: `6랭크 25레벨` gives weapon power `+2.5%`.
- Accessory `무기 공격력 +%` lines share the weapon-power percent context with the hidden `깨달음` bonus.

## Major Buckets

### Additional Damage

Internal operation: additive.

Examples:

- weapon quality `추가 피해`
- accessory `추가 피해`
- ark passive `달인` max-stack `추가 피해`
- pet specialty additional damage
- elixir/additional-damage style effects

Formula:

```text
additionalDamageBucket = 1 + sum(additionalDamagePercent) / 100
```

Accessory `추가 피해 +%` contribution must be calculated against the existing additional-damage context. The current project can read weapon quality additional damage from `equipment[].WeaponStats.AdditionalDamage.Value`, and parses ark passive `달인` 추가 피해 at max stacks, so necklace additional-damage lines use:

```text
accessoryAdditionalDamageContribution =
  (1 + existingAdditionalDamage + accessoryAdditionalDamage)
  / (1 + existingAdditionalDamage)
  - 1
```

Card collection effects and pet-ranch additional damage are not exposed by the current Lostark Open API response, so they are not included yet.

### Evolution-Type Damage

Internal operation: additive inside the evolution bucket. It multiplies with other damage categories.

Examples:

- ark passive evolution-type damage
- support effects that add evolution-type damage

Formula:

```text
evolutionDamageBucket = 1 + sum(evolutionDamagePercent) / 100
```

`뭉툭한 가시` special handling:

```text
effectiveCritRate = min(totalCritRate, bluntThornCritCap)
convertedEvolutionDamage =
  min((totalCritRate - bluntThornCritCap) * conversionRate, maxConvertedEvolutionDamage)
```

For the observed `뭉툭한 가시 Lv.2` tooltip:

- critical rate cap: `80%`
- conversion: overcapped critical rate `* 150%`
- converted evolution damage cap: `75%`

When calculating a marginal option such as `아드레날린`, compare the current converted evolution damage with the converted evolution damage after removing that option's critical-rate source. Do not simply discard critical rate above 100%.

Hidden ark passive point bonuses:

- `진화` at rank 6 adds evolution-type damage `+6%`. This is not exposed as a normal selected-node tooltip, so derive it from `arkPassive.Points[].Description` such as `6랭크 21레벨`.
- `도약` point bonuses primarily affect hyper-awakening damage and are ignored in the current general damage-efficiency model.

### Outgoing Damage

Internal operation: additive inside the same outgoing-damage bucket. It multiplies with other categories.

Examples:

- accessory `적에게 주는 피해`
- same-category outgoing damage effects

Formula:

```text
outgoingDamageBucket = 1 + sum(outgoingDamagePercent) / 100
```

### Independent Damage-Increase Effects

The sources note that engravings, cards, some ark passive effects, tripods, and gems are often independent multipliers. However, identical wording or same-category effects can be additive exceptions.

Project rule:

- Do not place every "피해 증가" string into one global bucket.
- First classify by system and exact wording.
- If we cannot classify an effect, mark it as `unknownDamageIncrease` and do not use it for final efficiency until we have evidence.

## Critical Damage

There are two different critical categories.

Project extraction module: `lib/spec/criticalStats.js`.

The module keeps these buckets separate:

- `GlobalCriticalRatePercent`: currently usable character-wide critical rate sources.
- `ConditionalCriticalRatePercent`: stack, state, or trigger-based critical rate sources.
- `GlobalCriticalDamageBonusPercent`: character-wide `치명타 피해/치명타 피해량` bonus above base critical damage.
- `ConditionalCriticalDamageBonusPercent`: state, skill-family, or trigger-based critical damage bonus.
- `SkillFamilySources`: effects limited to a named skill family such as `포격 스킬`; keep them out of generic global character values until the calculation target is skill-family aware.
- `SkillSources`: selected tripod effects and other skill-scoped values; do not merge into global character values.
- `ConditionalCriticalOutgoingDamagePercent`: `공격이 치명타로 적중 시 적에게 주는 피해` style effects.
- `SpecialSources`: non-critical or special parsed sources such as `아드레날린` attack power, `예리한 둔기` expected penalty, ark passive evolution damage, hidden ark passive point bonuses, and critical-rate caps. `SpecialEngravingSources` is kept as a backward-compatible alias.

Stack handling:

- `달인` critical-rate effects are calculated at max stacks. Example: `치명타 적중률 +1.4%, 최대 5중첩` is treated as `+7.0%`.
- Do not apply this generic multiplication to engravings such as `아드레날린`; their tooltip already states the critical-rate value at max stacks.
- For `아드레날린`, only the attack-power-per-stack text is multiplied by max stacks. The critical-rate text is used as written.

### Critical Damage Increase

Internal operation: additive.

Examples:

- `치명타 피해`
- some engraving, ring, bracelet effects
- `예리한 둔기` critical damage

Average-damage model:

```text
critAverage = 1 + critRate * (baseCritBonus + sum(critDamageIncreasePercent) / 100)
```

Use base critical damage bonus as `1.0` when no other source proves a different base. That means a normal critical hit is modeled as 200% damage.

When `치명타 시 적에게 주는 피해` exists:

```text
critHitMultiplier =
  (2 + critDamageIncreasePercent / 100)
  * (1 + criticalOutgoingDamagePercent / 100)

critAverage = 1 + effectiveCritRate * (critHitMultiplier - 1)
```

`예리한 둔기` also has an expected damage penalty. The current project model stores this as a separate expected multiplier:

```text
keenBluntExpectedPenalty = 1 - (20% reduction * 10% assumed trigger chance)
                         = 0.98
```

Keep this separate from `치명타 피해`; it is a constant expected multiplier and should not dilute marginal accessory critical-damage contribution.

### Critical Hit Damage Increase

Internal operation: multiplicative inside this family according to the referenced option summary.

Examples:

- `공격이 치명타로 적중 시 적에게 주는 피해 증가`
- ark passive 회심-style effects
- bracelet critical-hit damage effects

Do not merge this into `치명타 피해`.

## Class Identity Effects

Project rule table: `lib/spec/classIdentityEffects.js`.

Some class identity effects are not exposed as structured Armory API fields. If an identity effect affects damage, critical rate, critical damage, cooldown, attack speed, or a skill-specific bucket, store it in the class identity rule table first and keep it separate from API-parsed tooltip sources.

Rule shape:

```text
ClassName
IdentityNames
Effects[]
  Id
  Name
  Kind
  Value
  Unit
  Operation
  Scope
  AppliesWhen
  Target
  Source
  Confidence
  Notes
  RequiredAnyNames
  RequiredArkPassiveNames
  RequiredEngravingNames
  IsActive
  Activation
```

Use `Value: null` and `Confidence: "unverified"` until the exact value is confirmed. Unverified values must not be included in final damage or efficiency calculations.

Known manual rules:

- `소울이터` / `만월의 집행자`: `사신화` 상태에서 `사신 스킬` 치명타 적중률 +20%. Activate only when the character has `만월의 집행자` in ark passive or engraving context.
- `버서커` / `광전사의 비기`: `폭주` 상태에서 치명타 적중률 +50%.
- `슬레이어` / `처단자` or `포식자`: `폭주` 상태에서 치명타 적중률 +30%.

## Enemy Damage Taken and Defense

Enemy damage taken and defense reduction are separate from player outgoing damage.

Working buckets:

```text
enemyDamageTakenBucket = 1 + sum(enemyDamageTakenPercent) / 100
enemyDefenseBucket = product(defenseReductionOrIgnoreEffects)
```

The exact defense formula depends on target defense and content. Keep it parameterized instead of baking in one raid value.

## Skill-Specific Damage

The detailed formula post observed that skill-specific damage can multiply by large system groups. Example pattern:

```text
(1 + specializationSkillDamage)
* (1 + gemSkillDamage)
* (1 + arkPassiveSkillDamageA + arkPassiveSkillDamageB)
* (1 + arkGridSkillDamageA)
* (1 + arkGridSkillDamageB)
```

The post explicitly warns that this was measured on a specific class context. For project code:

- Keep class-specific skill-damage rules in a separate layer.
- Do not apply one class's skill-specific formula globally.
- Prefer a conservative unknown bucket until we have class evidence.

## Rounding

The detailed formula post emphasizes that Lostark display values and internal values can be affected by floor/round-down behavior.

Project rule:

- Store raw numeric values as numbers.
- Display with two decimals for contribution percentages.
- Do not round intermediate multipliers unless we have verified the exact game-side step.
- Add explicit tests whenever introducing a floor/rounding rule.

## Accessories

Current implemented accessory buckets:

- `추가 피해`: additive bucket
- `적에게 주는 피해` / `주는 피해`: additive outgoing-damage bucket
- `공격력`: additive attack-power bucket for current accessory-only model
- `무기 공격력`: weapon-power percent model, using square-root contribution
- `치명타 적중률`: critical average bucket
- `치명타 피해`: critical average bucket
- utility lines such as max mana or status-duration effects: parsed as zero direct damage contribution

Current limitations:

- Accessory contribution now includes weapon quality additional damage, parsed ark passive point bonuses, max-stack `달인` 추가 피해, selected global critical sources, `치명타 시 적에게 주는 피해`, and `뭉툭한 가시` conversion.
- It still does not include card collection effects, pet-ranch effects, avatar stat percent through the full main-stat attack-power formula, class skill coefficients, target defense, or enemy damage taken.
- Skill-family sources such as `포격 스킬` are separated into `SkillFamilySources`; generic accessory contribution does not automatically apply them until the UI/model supports selecting a target skill family.

## Weapon Data

From the Lostark equipment endpoint:

- Weapon power is in the weapon tooltip `기본 효과`.
- Weapon additional damage is in the weapon tooltip `추가 효과`.

Normalized shape:

```json
{
  "Type": "무기",
  "WeaponStats": {
    "WeaponPower": {
      "Value": 259554,
      "Text": "무기 공격력 +259554"
    },
    "AdditionalDamage": {
      "Value": 30,
      "Text": "추가 피해 +30.00%"
    }
  }
}
```

## Avatar Data

Lostark avatar data comes from `/armories/characters/{characterName}/avatars`, not the equipment endpoint.

Observed combat stat lines:

- Legendary combat avatars can expose main stat lines such as `민첩 +2.00%`.
- Heroic combat avatars can expose main stat lines such as `민첩 +1.00%`.
- Cosmetic slots such as face or movement effects may have no direct combat stat line.

Normalized shape:

```json
{
  "Type": "무기 아바타",
  "Grade": "전설",
  "IsInner": true,
  "StatEffects": [
    {
      "Stat": "민첩",
      "Value": 2,
      "Text": "민첩 +2.00%"
    }
  ]
}
```

Calculation note:

- Avatar main stat percent should eventually affect attack power through the main stat and weapon-power formula.
- Do not treat avatar stat percent as direct final damage percent.
- In the normalized API response, `IsStatApplied` follows `IsInner`; only `IsStatApplied: true` avatar stat effects should be counted. `IsInner: false` is treated as the dress-up/appearance slot for stat calculations.
