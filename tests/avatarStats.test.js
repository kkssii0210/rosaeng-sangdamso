import test from "node:test";
import assert from "node:assert/strict";
import { buildAvatarStatSummary } from "../lib/spec/avatarStats.js";

test("sums only applied avatar stat effects", () => {
  const summary = buildAvatarStatSummary([
    {
      Type: "무기 아바타",
      IsInner: true,
      StatEffects: [{ Stat: "민첩", Value: 2, Text: "민첩 +2.00%" }]
    },
    {
      Type: "머리 아바타",
      IsInner: true,
      StatEffects: [{ Stat: "민첩", Value: 2, Text: "민첩 +2.00%" }]
    },
    {
      Type: "머리 아바타",
      IsInner: false,
      StatEffects: [{ Stat: "민첩", Value: 1, Text: "민첩 +1.00%" }]
    }
  ]);

  assert.equal(summary.AppliedAvatarCount, 2);
  assert.equal(summary.IgnoredStatEffectCount, 1);
  assert.deepEqual(summary.StatBonuses, [
    {
      Stat: "민첩",
      Value: 4,
      Text: "민첩 +4.00%"
    }
  ]);
});
