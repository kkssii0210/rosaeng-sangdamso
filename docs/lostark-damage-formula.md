# Lostark Damage Formula Reference

Last updated: 2026-05-15

This is the project reference for spec-efficiency work. Read this file before changing calculation code under `lib/spec` or adding backend calculation endpoints.

## Sources

- Inven, "로스트빌드 만지다 포기한 사람들을 위한 옵션 정리": https://www.inven.co.kr/board/lostark/4821/109666
- Inven, "로스트아크의 데미지 계산식 한 장 정리 및 해설": https://www.inven.co.kr/board/lostark/4821/109679
- Inven, "딜러 전투력 로직 분석 (25년 7월 9일 패치 반영)": https://www.inven.co.kr/board/lostark/4821/106546
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

## Combat Power Display Model

Source: Inven article by `재련`, "딜러 전투력 로직 분석 (25년 7월 9일 패치 반영)", posted 2025-06-30 and later updated for the 2025-07-09 patch context.

This model is for the in-game displayed `CombatPower` value, not direct final damage. Treat it as a separate score model for spec-up guidance. It is community research, not official Smilegate documentation.

Broad shape:

```text
pureBaseAttackPower = sqrt(mainStat * weaponPower / 6)

combatPower =
  pureBaseAttackPower
  * 0.0288
  * 0.01
  * product(1 + combatPowerIncreaseFactor)
```

The community source writes the base coefficient as `0.0288`; the project applies an additional `0.01` display scale so the result matches the decimal in-game/Lopec combat-power value.

Rules for project modeling:

- `mainStat` means the class main stat among 힘/민첩/지능 after permanent stat sources.
- `weaponPower` means weapon attack power after permanent weapon-power sources.
- `낙원력` is not exposed as a profile field in the current Lostark Open API response. The equipped `보주` tooltip exposes the hidden maximum value in the `특수 효과` section as `시즌2 달성 최대 낙원력 : {value}`. Parse this before filtering excluded equipment.
- Temporary food or feast style buffs should not be included in `pureBaseAttackPower`.
- Effects that raise main stat or weapon power through permanent character state affect `pureBaseAttackPower` first. Examples include honing, bracelet stat/weapon-power lines, weapon quality, combat avatar stat, and high-grade ability-stone stat effects.
- Weapon-power percent sources share one additive bucket before `pureBaseAttackPower`. For example, `깨달음` karma level `+2.5%` plus accessory honing `무기 공격력 +1.8%` and `+0.8%` becomes raw weapon power `* 1.051`, not `* 1.025 * 1.018 * 1.008`.
- Flat `공격력 +` and percent `공격력 %` are not part of `pureBaseAttackPower`. The Inven model treats them as separate combat-power factors, calibrated around an endgame dealer base-attack reference near `142k`. Exact reference differs slightly by source category, so keep it configurable.
- Most score factors multiply independently. Do not place combat-power factors into the final-damage bucket model without a separate mapping.

Known combat-power factors from the source, summarized for implementation:

- Combat level factor:
  - Lv.55-59: `+8.95%`
  - Lv.60-64: `+18.56%`
  - Lv.65-69: `+23.97%`
  - Lv.70: `+29.45%`
- Weapon quality contributes through its displayed additional-damage value. Quality 100 is modeled as roughly `+30.00%`; some qualities can differ by `0.01%` from tooltip display.
- TODO: Esther weapon holders can diverge from the current weapon/base-attack normalization. Do not hardcode from one character; compare several Esther weapon characters first, then add a separate equipment-path adjustment if the gap is consistent.
- Ark passive point factors are separate multiplicative buckets. Evolution, enlightenment, and leap each become their own factor and multiply with each other:
  - evolution points used in 2T-4T: `+0.75%` each after the elixir/transcendence removal compensation. The first-row stat points are excluded from this combat-power factor, so a 100-point 2T-4T setup contributes `+75%`.
  - enlightenment points use a flat capped model from the stripped Boomber retest: `min(points, 100) * 0.7%`. Both 100P and 101P contribute `+70%`. Parsed selected-node, side-node, and 4T data is retained only as diagnostics.
  - leap points used: `+0.2%` each
- Karma:
  - evolution rank adds `+0.6%` combat power per rank; max-health levels do not affect dealer combat power.
  - enlightenment levels add weapon-power percent, so their value flows through `pureBaseAttackPower`; combine it additively with accessory `무기 공격력 +%` before applying it to raw weapon power. Enlightenment rank points also add the normal enlightenment-point factor when usable.
  - leap level adds a very small hyper-awakening-damage-derived factor, observed as `+0.02%` per level; leap rank gives 2 leap points, so it also adds the normal leap-point factor when usable.
- Dealer engraving combat-power factors use the measured table keyed by engraving name, relic-book progress, and ability-stone level. API `Level 0/1/2/3/4` maps to relic-book progress `0/5/10/15/20`, and `AbilityStoneLevel 0/1/2/3/4` selects the stone bonus column. Examples at relic-book 20 and stone level 0 are `원한 +21%`, `아드레날린 +19.4%`, `돌격대장 +19.2%`, `질량 증가 +19%`, `기습의 대가/결투의 대가 +18.1%`, `저주받은 인형/타격의 대가/안정된 상태/바리케이드/달인의 저력 +17%`, `속전속결/슈퍼 차지 +16.8%`, `예리한 둔기 +17.36%`, and `에테르 포식자 +16.2%` at 30 stacks. Legendary or no-relic-book engravings use the relic-book 0 row. Ability-stone basic attack percent, such as `기본 공격력 +1.50%`, is separate from the engraving table and is added to the `baseAttack` bucket.
- Elixir and transcendence combat-power factors are removed from the current model. Do not add the old theoretical elixir maximum (`회심 12%`, `치피/보피 2.4%`, `투구/장갑 1.44%`, six `공5` lines for `3.24%`, total `24.96%`) as an independent factor.
- Accessory honing effects:
  - shared flat attack-power lines use an endgame base-attack reference rather than `pureBaseAttackPower`.
  - ring critical-rate and critical-damage options use fixed combat-power coefficients from the source, not the character-specific critical average model.
  - necklace additional damage is evaluated against an assumed existing additional-damage context around weapon-quality 30%.
  - earring `공격력 %` is a direct factor; earring `무기 공격력 %` flows through `pureBaseAttackPower`.
- Combat stats use a simple display-score factor based on the sum of 치명/특화/신속:

```text
combatStatFactor = 1 + ((crit + specialization + swiftness) * 0.03) / 100
```

- Bracelet modeling applies only special-option combat-power factors independently in the bracelet bucket. Bracelet combat stats use the combat-stat factor, bracelet leap points use the ark-passive point factor, and base weapon-power lines flow through the selected base-attack model instead of being duplicated in the bracelet bucket.
  - Paired special options use the measured high/mid/low tables: crit-rate plus critical outgoing damage, crit-damage plus critical outgoing damage, additional damage plus demon damage, cooldown penalty plus outgoing damage, and outgoing damage plus stagger-target outgoing damage.
  - Standalone special options use bracelet-specific high/mid/low coefficients for outgoing damage, additional damage, back/head/non-directional skill outgoing damage, critical rate, and critical damage. These differ from accessory honing coefficients.
  - Buff-style weapon-power bracelet options add only their buff portion in the bracelet bucket. Base flat weapon power is not duplicated there.
- Gems:
  - Normal skill gems expose tooltip `기본 공격력 %` and each 4T gem also has an independent pure combat-power multiplier. `기본 공격력 %` multiplies combat power after the pure base attack is selected.
  - 4T pure gem combat-power factors by level: Lv.1 `+1.28%`, Lv.2 `+1.92%`, Lv.3 `+2.56%`, Lv.4 `+3.20%`, Lv.5 `+3.84%`, Lv.6 `+4.48%`, Lv.7 `+5.12%`, Lv.8 `+5.76%`, Lv.9 `+6.40%`, Lv.10 `+7.04%`.
  - Ark-grid gems are read from `/arkgrid.Effects` when available. Dealer combat-power factors currently include `공격력`, `추가 피해`, `보스 피해`, and `무기 공격력`.
  - Ark-grid gem `공격력` is added to the same displayed attack-power bucket as accessory `공격력 +%` lines.
  - Ark-grid gem `추가 피해` is added to the raw additional-damage bucket with weapon quality, necklace additional damage, and the current pet-ranch `+1.00%` assumption. For example, Boomber's `29.61 + 1.60 + 1.77 + 1.00 = 33.98%`.
  - Ark-grid gem `보스 피해` is not merged by moving chaos `달 : 불타는 일격` out of the core table, because lower point values do not map cleanly to boss damage. Keep `불타는 일격` on the normal chaos-core combat-power table, then apply the gem as a marginal factor against the Boomber-observed `불타는 일격` boss-damage context `1.82%`: `(1 + (1.82 + gemBossDamage) / 100) / (1 + 1.82 / 100) - 1`.
  - Ark-grid gem `무기 공격력` is converted through the base-attack approximation `sqrt(1 + weaponPowerPercent / 100) - 1`.
  - These Ark-grid gem values are multiplied into the current displayed-combat-power estimate as independent factors.
  - Support-oriented Ark-grid gem effects such as `낙인력`, `아군 피해 강화`, and `아군 공격 강화` are not applied to dealer combat power.

- Paradise orb:
  - The current source is an Inven comment, not official documentation; keep confidence lower than directly observed tooltip values.
  - The raw formula is in basis points where `20` means `0.20%`.
  - Attack orbs (`영험`, `신성`, or damage/attack-style special effects):

```text
paradiseOrbCombatPowerPercent = (20 + 800 * maxParadisePower / 100000000) / 100
```

  - Support/heal orbs (`투영`, heal/recovery/protection-style special effects):

```text
paradiseOrbCombatPowerPercent = (14 + 544 * maxParadisePower / 100000000) / 100
```

- Ark grid core:
  - Source: Inven, "딜러 기준 코어 전투력 증가량" (`https://www.inven.co.kr/board/lostark/4821/108143`).
  - Order cores use the point threshold table below. `해` and `달` share the same values; `별` uses the star values.
  - Relic order `해/달`: 10P `+1.50%`, 14P `+4.00%`, 17P `+7.50%`, 18P `+7.67%`, 19P `+7.83%`, 20P `+8.00%`.
  - Ancient order `해/달`: 10P `+1.50%`, 14P `+4.00%`, 17P `+8.50%`, 18P `+8.67%`, 19P `+8.83%`, 20P `+9.00%`.
  - Relic order `별`: 10P `+1.00%`, 14P `+2.50%`, 17P `+4.50%`, 18P `+4.67%`, 19P `+4.83%`, 20P `+5.00%`.
  - Ancient order `별`: 10P `+1.00%`, 14P `+2.50%`, 17P `+5.50%`, 18P `+5.67%`, 19P `+5.83%`, 20P `+6.00%`.
  - Relic chaos `현란한 공격`/`불타는 일격`/`공격`: 10P `+0.50%`, 14P `+1.00%`, 17P `+2.50%`, 18P `+2.67%`, 19P `+2.83%`, 20P `+3.00%`.
  - Relic chaos `안정적인 공격`/`재빠른 공격`/`흡수의 일격`/`부수는 일격`: 10P `+0.00%`, 14P `+0.50%`, 17P `+1.50%`, 18P `+1.67%`, 19P `+1.83%`, 20P `+2.00%`.
  - Ancient chaos `해`/`달` options add `+1.00%` at 17-20P.
  - Ancient chaos `별 : 공격` adds `+1.00%` at 17-20P.
  - Chaos `별 : 무기` is not a direct combat-power factor. The community table converts it under an endgame weapon-power assumption near 184,000: 10P `about +0.35%`, 14P `about +0.70%`, 17P `about +2.20%`, 18P `about +2.30%`, 19P `about +2.41%`, 20P `about +2.53%`.

Important implementation warning:

- This combat-power model intentionally differs from the real damage-efficiency model. Some factors use fixed assumptions, category-specific calibration, or display-score weights. Use it to explain or approximate the in-game `CombatPower` number, not to rank gold efficiency unless we explicitly decide to optimize for displayed combat power.
- Current project implementation lives in `lib/spec/combatPowerModel.js`. It is a partial verifier: it extracts base attack, stable factors, known score factors, and paradise-orb score factors, then reports the gap against the Open API `profile.CombatPower` value instead of claiming exact parity. For high-end characters, direct multiplication can overcount because API `기본 공격력`, Ark passive point semantics, and display scaling are not fully separated yet.
- Current project extraction for hidden `낙원력` lives in `lib/lostark/equipment.js` as `extractParadiseOrbInfo`. The value is surfaced in `combatPowerAnalysis.ParadisePower`. The attack/support distinction is inferred from the orb special-effect tooltip.

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
- Combat-power verification now keeps two base-attack candidates separate:
  - `ProfileBaseAttackBeforeBasicPercent`: Open API `공격력` tooltip `기본 공격력` divided by parsed `기본 공격력 %` sources. This is the preferred displayed-combat-power base when available because the profile already includes permanent character state that equipment tooltips do not expose cleanly.
  - `EquipmentFormulaBaseAttackPower`: `sqrt(sum(equipment.MainStatValue) * effectiveWeaponPower / 6)`, where `effectiveWeaponPower = rawWeaponPower * (1 + sum(weaponPowerPercentSources) / 100)`. This is used only as fallback when the profile tooltip is missing, and is also exposed as a diagnostic gap against the profile-derived base.
- Equipment formula output is already pure/base attack. Do not divide it by `기본 공격력 %` again. Apply `기본 공격력 %` as a normal base-attack factor after selecting the pure base.
- When only weapon power percent changes and main stat is fixed, damage contribution is approximately `sqrt(1 + weaponPowerPercent / 100) - 1`. Exact final attack-power contribution needs current main stat, current weapon power, attack-power buckets, and Lostark rounding behavior.
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

Equipped card-set effects are exposed by `/armories/characters/{characterName}/cards` and normalized in `lib/lostark/cards.js`. Card damage effects such as elemental damage and direct outgoing damage are summed within the card bucket and multiplied directly into the combat-power estimate. Card collection effects and pet-ranch additional damage are not exposed by the current Lostark Open API response, so they are not included yet.

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
- Lostark's visible combat-power display floors the final number to an integer. Example: an internal value of `854.93` is shown as `854`.
- Keep the decimal value for calculation and Lopec-style decimal comparison. Use the floored value only when comparing against the in-game visible integer.
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
