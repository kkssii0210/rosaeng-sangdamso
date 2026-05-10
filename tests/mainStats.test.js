import test from "node:test";
import assert from "node:assert/strict";
import { buildMainStatSummary } from "../lib/spec/mainStats.js";

test("builds internal main stat total from normalized equipment values", () => {
  const summary = buildMainStatSummary([
    { Type: "무기", Name: "무기", MainStatValue: null },
    { Type: "투구", Name: "투구", MainStatValue: 139346 },
    { Type: "목걸이", Name: "목걸이", MainStatValue: 17831 },
    { Type: "팔찌", Name: "팔찌", MainStatValue: 1200 }
  ]);

  assert.equal(summary.MainStatTotal, 158377);
  assert.deepEqual(
    summary.Items.map((item) => [item.Type, item.Value]),
    [
      ["투구", 139346],
      ["목걸이", 17831],
      ["팔찌", 1200]
    ]
  );
});
