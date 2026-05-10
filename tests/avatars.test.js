import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAvatarItem, normalizeAvatars } from "../lib/lostark/avatars.js";

function createAvatarTooltip({ statLine, isInner = true, isSet = false }) {
  return JSON.stringify({
    AvatarAttribute: {
      IsInner: isInner,
      IsSet: isSet
    },
    Element_001: {
      type: "ItemTitle",
      value: {
        qualityValue: -1
      }
    },
    ...(statLine
      ? {
          Element_005: {
            type: "ItemPartBox",
            value: {
              Element_000: "<FONT COLOR='#A9D0F5'>기본 효과</FONT>",
              Element_001: statLine
            }
          }
        }
      : {})
  });
}

test("normalizes avatar stat effects from tooltip", () => {
  const normalized = normalizeAvatarItem({
    Type: "무기 아바타",
    Name: "탐식하는 도약의 데스사이드",
    Icon: "https://cdn-lostark.game.onstove.com/sample-avatar.png",
    Grade: "전설",
    IsInner: true,
    IsSet: false,
    Tooltip: createAvatarTooltip({ statLine: "민첩 +2.00%" })
  });

  assert.deepEqual(normalized.StatEffects, [
    {
      Stat: "민첩",
      Value: 2,
      Text: "민첩 +2.00%"
    }
  ]);
  assert.equal(normalized.IsInner, true);
  assert.equal(normalized.IsStatApplied, true);
  assert.equal(normalized.IsSet, false);
});

test("keeps cosmetic avatars without combat stat effects", () => {
  const normalized = normalizeAvatars([
    {
      Type: "얼굴1 아바타",
      Name: "찬란한 얼굴",
      Grade: "영웅",
      IsInner: false,
      IsSet: false,
      Tooltip: createAvatarTooltip({ statLine: "", isInner: false })
    }
  ]);

  assert.deepEqual(normalized[0].StatEffects, []);
});
