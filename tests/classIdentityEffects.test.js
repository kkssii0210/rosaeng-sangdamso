import test from "node:test";
import assert from "node:assert/strict";
import { buildClassIdentityEffects, getClassIdentityEffects } from "../lib/spec/classIdentityEffects.js";

test("returns class identity effect slots for a known class", () => {
  const result = getClassIdentityEffects("소울이터");

  assert.equal(result.ClassName, "소울이터");
  assert.equal(result.HasManualRule, true);
  assert.deepEqual(result.IdentityNames, ["빙의 게이지", "영혼석", "사신화"]);
  assert.equal(result.Effects[0].Id, "souleater-full-moon-reaper-form-critical-rate");
  assert.equal(result.Effects[0].Name, "사신화 치명타 적중률");
  assert.equal(result.Effects[0].Kind, "critRate");
  assert.equal(result.Effects[0].Value, 20);
  assert.equal(result.Effects[0].Confidence, "verified");
  assert.equal(result.Effects[0].IsActive, false);
  assert.deepEqual(result.Effects[0].RequiredArkPassiveNames, ["만월의 집행자"]);
});

test("builds class identity effects from profile class name", () => {
  const result = buildClassIdentityEffects({
    CharacterClassName: "바드"
  });

  assert.equal(result.ClassName, "바드");
  assert.equal(result.HasManualRule, true);
  assert.deepEqual(result.IdentityNames, ["세레나데"]);
  assert.deepEqual(result.Effects, []);
});

test("activates full moon souleater identity effects from ark passive", () => {
  const result = buildClassIdentityEffects({
    CharacterClassName: "소울이터"
  }, {
    arkPassive: {
      Effects: [
        {
          Description: "깨달음 2티어 만월의 집행자 Lv.3"
        }
      ]
    }
  });

  assert.equal(result.Effects[0].IsActive, true);
  assert.deepEqual(result.Effects[0].Activation.MatchedArkPassiveNames, ["만월의 집행자"]);
});

test("activates technique berserker burst critical rate from engraving context", () => {
  const result = buildClassIdentityEffects({
    CharacterClassName: "버서커"
  }, {
    engravings: [
      {
        Name: "광전사의 비기"
      }
    ]
  });

  assert.equal(result.Effects[0].Id, "berserker-technique-burst-critical-rate");
  assert.equal(result.Effects[0].Value, 50);
  assert.equal(result.Effects[0].IsActive, true);
  assert.deepEqual(result.Effects[0].Activation.MatchedAnyNames, ["광전사의 비기"]);
});

test("activates slayer burst critical rate for punisher and predator", () => {
  const punisher = buildClassIdentityEffects({
    CharacterClassName: "슬레이어"
  }, {
    arkPassive: {
      Effects: [
        {
          Description: "깨달음 2티어 처단자 Lv.3"
        }
      ]
    }
  });
  const predator = buildClassIdentityEffects({
    CharacterClassName: "슬레이어"
  }, {
    engravings: [
      {
        Name: "포식자"
      }
    ]
  });

  assert.equal(punisher.Effects[0].Id, "slayer-burst-critical-rate");
  assert.equal(punisher.Effects[0].Value, 30);
  assert.equal(punisher.Effects[0].IsActive, true);
  assert.deepEqual(punisher.Effects[0].Activation.MatchedAnyNames, ["처단자"]);
  assert.equal(predator.Effects[0].Value, 30);
  assert.equal(predator.Effects[0].IsActive, true);
  assert.deepEqual(predator.Effects[0].Activation.MatchedAnyNames, ["포식자"]);
});

test("returns an empty rule for an unknown class", () => {
  const result = getClassIdentityEffects("새 클래스");

  assert.equal(result.ClassName, "새 클래스");
  assert.equal(result.HasManualRule, false);
  assert.deepEqual(result.IdentityNames, []);
  assert.deepEqual(result.Effects, []);
});

test("does not expose mutable rule internals", () => {
  const first = getClassIdentityEffects("소울이터");
  first.IdentityNames.push("변조");
  first.Effects[0].Value = 100;

  const second = getClassIdentityEffects("소울이터");

  assert.deepEqual(second.IdentityNames, ["빙의 게이지", "영혼석", "사신화"]);
  assert.equal(second.Effects[0].Value, 20);
});
