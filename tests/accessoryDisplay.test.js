import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccessoryDisplay,
  getMainStatNameForClass
} from "../lib/spec/accessoryDisplay.js";

test("uses dexterity for Arthetine gunner classes", () => {
  assert.equal(getMainStatNameForClass("블래스터"), "민첩");
});

test("builds accessory display around one class main stat and refinement options", () => {
  const display = buildAccessoryDisplay({
    accessory: {
      MainStatValue: 15232,
      DetailSections: [
        {
          title: "기본 효과",
          lines: ["힘 +15232", "민첩 +15232", "지능 +15232", "체력 +3981"]
        },
        {
          title: "연마 효과",
          lines: ["적에게 주는 피해 +2.00%", "최대 마나 +15", "추가 피해 +1.60%"]
        }
      ]
    },
    mainStatName: "민첩"
  });

  assert.equal(display.MainStatLine, "민첩 +15,232");
  assert.deepEqual(display.RefinementLines, ["적에게 주는 피해 +2.00%", "최대 마나 +15", "추가 피해 +1.60%"]);
});

test("renames auction candidate main stat to the character main stat", () => {
  const display = buildAccessoryDisplay({
    accessory: {
      MainStatValue: 12646,
      DetailSections: [
        {
          title: "기본 효과",
          lines: ["힘 +12,646"]
        },
        {
          title: "연마 효과",
          lines: ["치명타 피해 +4.00%", "치명타 적중률 +0.40%"]
        }
      ]
    },
    mainStatName: "민첩"
  });

  assert.equal(display.MainStatLine, "민첩 +12,646");
});
