import test from "node:test";
import assert from "node:assert/strict";
import { EXCLUDED_EQUIPMENT_TYPES, extractParadiseOrbInfo, normalizeEquipmentItem } from "../lib/lostark/equipment.js";
import {
  abilityStoneSample,
  armorSample,
  braceletSample,
  excludedSamples,
  necklaceSample,
  paradiseOrbSample,
  supportParadiseOrbSample,
  weaponSample
} from "./fixtures/equipmentSamples.js";

test("normalizes equipment without returning the original Tooltip", () => {
  const normalized = normalizeEquipmentItem(weaponSample);

  assert.deepEqual(Object.keys(normalized), [
    "Type",
    "Name",
    "Icon",
    "Grade",
    "Quality",
    "ItemLevelText",
    "DetailSections",
    "WeaponStats"
  ]);
  assert.equal(normalized.Quality, 97);
  assert.equal(normalized.ItemLevelText, "아이템 레벨 1,740.00");
  assert.deepEqual(normalized.WeaponStats, {
    WeaponPower: {
      Value: 12345,
      Text: "무기 공격력 +12345"
    },
    AdditionalDamage: {
      Value: 30,
      Text: "추가 피해 +30.00%"
    }
  });
  assert.equal("Tooltip" in normalized, false);
});

test("keeps quality only for weapons, armor, and accessories", () => {
  assert.equal(normalizeEquipmentItem(weaponSample).Quality, 97);
  assert.equal(normalizeEquipmentItem(armorSample).Quality, 91);
  assert.equal(normalizeEquipmentItem(necklaceSample).Quality, 83);
  assert.equal(normalizeEquipmentItem(abilityStoneSample).Quality, null);
  assert.equal(normalizeEquipmentItem(braceletSample).Quality, null);
});

test("marks compass, charm, and orb equipment types as excluded", () => {
  const visibleTypes = [weaponSample, ...excludedSamples]
    .filter((item) => !EXCLUDED_EQUIPMENT_TYPES.has(item.Type))
    .map((item) => item.Type);

  assert.deepEqual(visibleTypes, ["무기"]);
});

test("extracts max paradise power from excluded orb equipment", () => {
  const paradiseOrb = extractParadiseOrbInfo([weaponSample, paradiseOrbSample]);

  assert.equal(paradiseOrb.Type, "보주");
  assert.equal(paradiseOrb.Name, "눈부신 비전의 보주");
  assert.equal(paradiseOrb.EffectName, "맥스웰 맥시마");
  assert.equal(paradiseOrb.EffectRole, "attack");
  assert.deepEqual(paradiseOrb.MaxParadisePower, {
    Value: 48275714,
    Text: "시즌2 달성 최대 낙원력 : 48,275,714"
  });
  assert.equal("Tooltip" in paradiseOrb, false);
});

test("classifies support paradise orb from special effect text", () => {
  const paradiseOrb = extractParadiseOrbInfo([supportParadiseOrbSample]);

  assert.equal(paradiseOrb.EffectName, "투영");
  assert.equal(paradiseOrb.EffectRole, "support");
  assert.equal(paradiseOrb.MaxParadisePower.Value, 1000000);
});

test("extracts accessory detail sections", () => {
  const normalized = normalizeEquipmentItem(necklaceSample);

  assert.deepEqual(
    normalized.DetailSections.map((section) => section.title),
    ["기본 효과", "연마 효과", "아크 패시브 포인트 효과"]
  );
  assert.deepEqual(normalized.DetailSections[0].lines, ["힘 +17831", "민첩 +17831", "지능 +17831", "치명 +420", "특화 +420"]);
  assert.deepEqual(normalized.DetailSections[1].lines, ["추가 피해 +2.60%"]);
  assert.deepEqual(normalized.DetailSections[2].lines, ["깨달음 +13"]);
});

test("extracts equipment main stat without triple-counting all-stat accessories", () => {
  const normalizedArmor = normalizeEquipmentItem(armorSample);
  const normalizedNecklace = normalizeEquipmentItem(necklaceSample);

  assert.deepEqual(normalizedArmor.MainStats, [
    {
      Stat: "민첩",
      Value: 139346,
      Text: "민첩 +139346"
    }
  ]);
  assert.equal(normalizedArmor.MainStatValue, 139346);
  assert.equal(normalizedArmor.MainStatText, "주스탯 +139,346");
  assert.deepEqual(normalizedNecklace.MainStats, [
    { Stat: "힘", Value: 17831, Text: "힘 +17831" },
    { Stat: "민첩", Value: 17831, Text: "민첩 +17831" },
    { Stat: "지능", Value: 17831, Text: "지능 +17831" }
  ]);
  assert.equal(normalizedNecklace.MainStatValue, 17831);
});

test("extracts bracelet detail sections", () => {
  const normalized = normalizeEquipmentItem(braceletSample);

  assert.deepEqual(
    normalized.DetailSections.map((section) => section.title),
    ["팔찌 효과", "아크 패시브 포인트 효과"]
  );
  assert.deepEqual(normalized.DetailSections[0].lines, ["특화 +120", "순환 : 공격 적중 시 30초 동안 피해량 증가"]);
  assert.deepEqual(normalized.DetailSections[1].lines, ["도약 +9"]);
});

test("extracts ability stone engravings and effects", () => {
  const normalized = normalizeEquipmentItem(abilityStoneSample);

  assert.deepEqual(normalized.DetailSections, []);
  assert.deepEqual(normalized.AbilityStone, {
    Engravings: [
      { Name: "예리한 둔기", Level: 3, ValueText: "Lv.3", IsPenalty: false },
      { Name: "타격의 대가", Level: 2, ValueText: "Lv.2", IsPenalty: false },
      { Name: "공격력 감소", Level: 0, ValueText: "Lv.0", IsPenalty: true }
    ],
    Effects: [
      { Title: "기본 효과", Lines: ["체력 +15196"] },
      { Title: "세공 단계 보너스", Lines: ["체력 +3525"] },
      { Title: "레벨 보너스", Lines: ["기본 공격력 +1.50%"] }
    ]
  });
});
