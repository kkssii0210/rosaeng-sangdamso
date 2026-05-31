import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAnalysisHref,
  buildEfficiencyHref,
  resolveAnalysisCharacterName,
  resolveEfficiencyCharacterName
} from "../lib/ui/efficiencyNavigation.js";

test("builds an efficiency simulator URL from the looked-up character", () => {
  assert.equal(buildEfficiencyHref(" 붐버 "), "/efficiency?character=%EB%B6%90%EB%B2%84");
});

test("keeps the efficiency simulator behind a resolved character", () => {
  assert.equal(buildEfficiencyHref(" "), "/");
});

test("builds an analysis URL from the current efficiency character", () => {
  assert.equal(buildAnalysisHref(" 붐버 "), "/?character=%EB%B6%90%EB%B2%84");
});

test("resolves the analysis character query", () => {
  assert.equal(resolveAnalysisCharacterName(new URLSearchParams("character=%EB%B6%90%EB%B2%84")), "붐버");
});

test("uses only the efficiency character query for simulator entry", () => {
  const searchParams = new URLSearchParams("character=%EB%B6%90%EB%B2%84");

  assert.equal(resolveEfficiencyCharacterName({ searchParams, recentCharacterName: "다른캐릭" }), "붐버");
});

test("does not open the efficiency simulator from recent local character alone", () => {
  assert.equal(
    resolveEfficiencyCharacterName({
      searchParams: new URLSearchParams(""),
      recentCharacterName: " 최근캐릭 "
    }),
    ""
  );
});
