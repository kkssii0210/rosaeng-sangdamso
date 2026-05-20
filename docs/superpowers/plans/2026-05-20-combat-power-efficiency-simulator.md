# Combat Power Efficiency Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first `전투력 효율 시뮬레이터` module: T4 ancient accessory replacement recommendations ranked by gold needed per +1% combat power.

**Architecture:** Keep the first implementation in the existing Next.js/JavaScript stack. Add focused domain modules for auction accessory normalization, replacement simulation, recovery-price estimation, and auction page fetching; then expose two Next.js API routes and a dedicated `/efficiency` page. The simulator uses the current official combat power plus the internal combat-power model delta as the user-facing expected combat power.

**Tech Stack:** Next.js 16 App Router, React 19, Node.js 22, native `fetch`, `node:test`, ES modules, existing Lostark Open API helpers and calculation modules.

---

## File Structure

- Create: `tests/fixtures/accessoryEfficiencySamples.js`
  - Small deterministic fixtures for current equipment, auction candidates, auction pages, and recovery matches.
- Create: `lib/lostark/accessoryAuction.js`
  - Converts Lostark auction items into normalized equipment-like accessories.
  - Owns T4 ancient accessory category constants, enlightenment quality thresholds, option bucket parsing, and accessory fingerprints.
- Create: `tests/accessoryAuction.test.js`
  - Verifies candidate normalization, quality filtering, enlightenment MAX validation, and fingerprints.
- Create: `lib/spec/accessoryEfficiencySimulation.js`
  - Replaces current accessories virtually, runs `buildCombatPowerAnalysis`, ranks candidates by gold per +1% combat power, and returns top recommendation plus top three comparisons.
- Create: `tests/accessoryEfficiencySimulation.test.js`
  - Verifies neck replacement, earring/ring best-slot selection, no-recommendation state, and metric sorting.
- Create: `lib/spec/accessoryRecoveryEstimate.js`
  - Estimates current accessory recovery value from exact-match auction items and confidence rules.
- Create: `tests/accessoryRecoveryEstimate.test.js`
  - Verifies exact match, median price, confidence threshold, and hidden net-efficiency cases.
- Create: `lib/lostark/accessoryAuctionApi.js`
  - Fetches accessory auction pages, applies short raw-page cache, enforces search limits, and supports forced refresh.
- Create: `tests/accessoryAuctionApi.test.js`
  - Uses fake POST functions to verify page traversal, cache separation, and refresh behavior without network.
- Create: `lib/lostark/characterEfficiencyContext.js`
  - Fetches the armory payloads required by the simulator and builds the same normalized calculation context as the character analysis route.
- Create: `tests/characterEfficiencyContext.test.js`
  - Verifies character-not-found and successful context assembly with fake fetch functions.
- Create: `app/api/efficiency/accessories/[name]/route.js`
  - Fast recommendation API.
- Create: `app/api/efficiency/accessories/recovery/route.js`
  - Recovery-price estimate API.
- Create: `components/AppNavigation.jsx`
  - Top-level navigation for `캐릭터 분석 | 전투력 효율 시뮬레이터`.
- Create: `components/CombatPowerEfficiencyPage.jsx`
  - Client page shell for character input, loading, recommendation, comparison, and recovery estimate states.
- Create: `components/AccessoryRecommendationPanel.jsx`
  - Recommendation card and top-three comparison rendering.
- Create: `app/efficiency/page.jsx`
  - Dedicated simulator route.
- Modify: `app/page.jsx`
  - Save the last searched character name and show top-level navigation after welcome.
- Modify: `app/globals.css`
  - Styles for navigation, simulator layout, recommendation card, comparison details, and error states.

## Implementation Notes

- Do not include bracelets in the first active calculation module.
- Do not mix gems, avatars, or honing into the first recommendation ranking.
- Do not expose the internal candidate combat-power estimate as the primary number. Show `현재 공식 전투력 + 내부 계산 상승분`.
- Keep all network tests fixture/fake based. No test should call Lostark Open API.
- Keep commits narrow and in the order below.

---

### Task 1: Auction Accessory Normalization

**Files:**
- Create: `tests/fixtures/accessoryEfficiencySamples.js`
- Create: `tests/accessoryAuction.test.js`
- Create: `lib/lostark/accessoryAuction.js`

- [ ] **Step 1: Write fixture data**

Create `tests/fixtures/accessoryEfficiencySamples.js`:

```js
export const currentAccessoryEquipment = [
  {
    Type: "무기",
    Name: "테스트 무기",
    WeaponStats: {
      WeaponPower: { Value: 200000 },
      AdditionalDamage: { Value: 30 }
    }
  },
  {
    Type: "목걸이",
    Name: "현재 목걸이",
    Grade: "고대",
    Quality: 91,
    MainStatValue: 68000,
    DetailSections: [
      { title: "기본 효과", lines: ["힘 +68,000"] },
      { title: "연마 효과", lines: ["적에게 주는 피해 +1.20%", "추가 피해 +0.80%"] },
      { title: "아크 패시브 포인트 효과", lines: ["깨달음 +13"] }
    ]
  },
  {
    Type: "귀걸이",
    Name: "현재 귀걸이 A",
    Grade: "고대",
    Quality: 90,
    MainStatValue: 52000,
    DetailSections: [
      { title: "기본 효과", lines: ["힘 +52,000"] },
      { title: "연마 효과", lines: ["무기 공격력 +0.80%"] },
      { title: "아크 패시브 포인트 효과", lines: ["깨달음 +9"] }
    ]
  },
  {
    Type: "귀걸이",
    Name: "현재 귀걸이 B",
    Grade: "고대",
    Quality: 92,
    MainStatValue: 53000,
    DetailSections: [
      { title: "기본 효과", lines: ["힘 +53,000"] },
      { title: "연마 효과", lines: ["무기 공격력 +1.20%"] },
      { title: "아크 패시브 포인트 효과", lines: ["깨달음 +9"] }
    ]
  },
  {
    Type: "반지",
    Name: "현재 반지 A",
    Grade: "고대",
    Quality: 90,
    MainStatValue: 50000,
    DetailSections: [
      { title: "기본 효과", lines: ["힘 +50,000"] },
      { title: "연마 효과", lines: ["치명타 피해 +2.40%"] },
      { title: "아크 패시브 포인트 효과", lines: ["깨달음 +9"] }
    ]
  },
  {
    Type: "반지",
    Name: "현재 반지 B",
    Grade: "고대",
    Quality: 91,
    MainStatValue: 50500,
    DetailSections: [
      { title: "기본 효과", lines: ["힘 +50,500"] },
      { title: "연마 효과", lines: ["치명타 적중률 +0.95%"] },
      { title: "아크 패시브 포인트 효과", lines: ["깨달음 +9"] }
    ]
  }
];

export const auctionAccessoryItems = {
  validNecklace: {
    Name: "후보 목걸이",
    Grade: "고대",
    Tier: 4,
    Level: 1640,
    Icon: "https://cdn-lostark.game.onstove.com/accessory.png",
    GradeQuality: 92,
    AuctionInfo: {
      BuyPrice: 120000,
      TradeAllowCount: 2,
      EndDate: "2026-05-20T12:00:00"
    },
    Options: [
      { Type: "STAT", OptionName: "힘", Value: 70000, IsValuePercentage: false },
      { Type: "ACCESSORY_UPGRADE", OptionName: "적에게 주는 피해", Value: 2, IsValuePercentage: true },
      { Type: "ACCESSORY_UPGRADE", OptionName: "추가 피해", Value: 1.6, IsValuePercentage: true },
      { Type: "ARK_PASSIVE_POINT", OptionName: "깨달음", Value: 13, IsValuePercentage: false }
    ]
  },
  lowQualityRing: {
    Name: "낮은 품질 반지",
    Grade: "고대",
    Tier: 4,
    Level: 1640,
    GradeQuality: 70,
    AuctionInfo: { BuyPrice: 1000 },
    Options: [
      { Type: "STAT", OptionName: "힘", Value: 42000, IsValuePercentage: false },
      { Type: "ACCESSORY_UPGRADE", OptionName: "치명타 피해", Value: 4, IsValuePercentage: true },
      { Type: "ARK_PASSIVE_POINT", OptionName: "깨달음", Value: 8, IsValuePercentage: false }
    ]
  },
  validRing: {
    Name: "후보 반지",
    Grade: "고대",
    Tier: 4,
    Level: 1640,
    GradeQuality: 90,
    AuctionInfo: { BuyPrice: 60000 },
    Options: [
      { Type: "STAT", OptionName: "힘", Value: 50500, IsValuePercentage: false },
      { Type: "ACCESSORY_UPGRADE", OptionName: "치명타 피해", Value: 4, IsValuePercentage: true },
      { Type: "ARK_PASSIVE_POINT", OptionName: "깨달음", Value: 9, IsValuePercentage: false }
    ]
  }
};
```

- [ ] **Step 2: Write failing normalization tests**

Create `tests/accessoryAuction.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCESSORY_AUCTION_CATEGORIES,
  buildAccessoryFingerprint,
  getAccessoryEnlightenmentThreshold,
  isEligibleAccessoryCandidate,
  normalizeAuctionAccessoryItem
} from "../lib/lostark/accessoryAuction.js";
import { auctionAccessoryItems } from "./fixtures/accessoryEfficiencySamples.js";

test("defines T4 ancient category codes for supported accessories", () => {
  assert.deepEqual(
    ACCESSORY_AUCTION_CATEGORIES.map((item) => [item.type, item.categoryCode]),
    [
      ["목걸이", 200010],
      ["귀걸이", 200020],
      ["반지", 200030]
    ]
  );
});

test("returns enlightenment MAX quality thresholds by accessory type", () => {
  assert.equal(getAccessoryEnlightenmentThreshold("목걸이"), 90);
  assert.equal(getAccessoryEnlightenmentThreshold("귀걸이"), 90);
  assert.equal(getAccessoryEnlightenmentThreshold("반지"), 90);
});

test("normalizes auction item into equipment-like accessory", () => {
  const normalized = normalizeAuctionAccessoryItem(auctionAccessoryItems.validNecklace, "목걸이");

  assert.equal(normalized.Type, "목걸이");
  assert.equal(normalized.Name, "후보 목걸이");
  assert.equal(normalized.Grade, "고대");
  assert.equal(normalized.Quality, 92);
  assert.equal(normalized.MainStatValue, 70000);
  assert.equal(normalized.BuyPrice, 120000);
  assert.equal(normalized.EnlightenmentPoint, 13);
  assert.deepEqual(normalized.DetailSections, [
    { title: "기본 효과", lines: ["힘 +70,000"] },
    { title: "연마 효과", lines: ["적에게 주는 피해 +2.00%", "추가 피해 +1.60%"] },
    { title: "아크 패시브 포인트 효과", lines: ["깨달음 +13"] }
  ]);
});

test("filters out candidates below max enlightenment quality or point", () => {
  const lowQuality = normalizeAuctionAccessoryItem(auctionAccessoryItems.lowQualityRing, "반지");
  const validRing = normalizeAuctionAccessoryItem(auctionAccessoryItems.validRing, "반지");

  assert.equal(isEligibleAccessoryCandidate(lowQuality).eligible, false);
  assert.equal(isEligibleAccessoryCandidate(lowQuality).reason, "BELOW_MAX_ENLIGHTENMENT");
  assert.equal(isEligibleAccessoryCandidate(validRing).eligible, true);
});

test("builds stable fingerprint from type quality and option grades", () => {
  const normalized = normalizeAuctionAccessoryItem(auctionAccessoryItems.validRing, "반지");

  assert.equal(
    buildAccessoryFingerprint(normalized),
    "반지|고대|q90|stat:힘:50,500|ark:깨달음:9|refine:치명타 피해:4.00"
  );
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```bash
npm test -- tests/accessoryAuction.test.js
```

Expected: FAIL with module-not-found for `lib/lostark/accessoryAuction.js`.

- [ ] **Step 4: Implement accessory auction normalization**

Create `lib/lostark/accessoryAuction.js` with these exports and behavior:

```js
export const ACCESSORY_AUCTION_CATEGORIES = [
  { type: "목걸이", categoryCode: 200010, maxEnlightenmentPoint: 13, minMaxQuality: 90 },
  { type: "귀걸이", categoryCode: 200020, maxEnlightenmentPoint: 9, minMaxQuality: 90 },
  { type: "반지", categoryCode: 200030, maxEnlightenmentPoint: 9, minMaxQuality: 90 }
];

export function getAccessoryEnlightenmentThreshold(type) {
  return ACCESSORY_AUCTION_CATEGORIES.find((item) => item.type === type)?.minMaxQuality ?? 90;
}

export function normalizeAuctionAccessoryItem(item, type) {
  const options = Array.isArray(item?.Options) ? item.Options : [];
  const statOption = options.find((option) => ["힘", "민첩", "지능"].includes(option?.OptionName));
  const arkOption = options.find((option) => String(option?.Type || "").includes("ARK_PASSIVE") || option?.OptionName === "깨달음");
  const refinementOptions = options.filter((option) => String(option?.Type || "").includes("ACCESSORY"));
  const mainStatValue = toNumber(statOption?.Value, null);
  const enlightenmentPoint = toNumber(arkOption?.Value, null);
  const detailSections = [];

  if (statOption && mainStatValue !== null) {
    detailSections.push({ title: "기본 효과", lines: [`${statOption.OptionName} +${mainStatValue.toLocaleString("ko-KR")}`] });
  }

  if (refinementOptions.length) {
    detailSections.push({
      title: "연마 효과",
      lines: refinementOptions.map(formatRefinementOption)
    });
  }

  if (arkOption && enlightenmentPoint !== null) {
    detailSections.push({ title: "아크 패시브 포인트 효과", lines: [`${arkOption.OptionName} +${enlightenmentPoint}`] });
  }

  return {
    Type: type,
    Name: item?.Name || "",
    Icon: item?.Icon || "",
    Grade: item?.Grade || "",
    Quality: toNumber(item?.GradeQuality, null),
    Tier: toNumber(item?.Tier, null),
    ItemLevel: toNumber(item?.Level, null),
    BuyPrice: getAuctionBuyPrice(item),
    TradeRemainCount: toNumber(item?.AuctionInfo?.TradeAllowCount, null),
    EndDate: item?.AuctionInfo?.EndDate || "",
    MainStatValue: mainStatValue,
    EnlightenmentPoint: enlightenmentPoint,
    DetailSections: detailSections
  };
}

export function isEligibleAccessoryCandidate(accessory) {
  const rule = ACCESSORY_AUCTION_CATEGORIES.find((item) => item.type === accessory?.Type);
  const quality = toNumber(accessory?.Quality, 0);
  const point = toNumber(accessory?.EnlightenmentPoint, 0);

  if (!rule || accessory?.Grade !== "고대" || toNumber(accessory?.Tier, 4) !== 4) {
    return { eligible: false, reason: "UNSUPPORTED_ACCESSORY" };
  }

  if (quality < rule.minMaxQuality || point < rule.maxEnlightenmentPoint) {
    return { eligible: false, reason: "BELOW_MAX_ENLIGHTENMENT" };
  }

  if (!Number.isFinite(toNumber(accessory?.BuyPrice, null)) || accessory.BuyPrice <= 0) {
    return { eligible: false, reason: "MISSING_BUY_PRICE" };
  }

  return { eligible: true, reason: "" };
}

export function buildAccessoryFingerprint(accessory) {
  const stat = firstLine(accessory, "기본 효과").replace(/\s+/g, "").replace("+", ":");
  const ark = firstLine(accessory, "아크 패시브").replace(/\s+/g, "").replace("+", ":");
  const refinements = sectionLines(accessory, "연마")
    .map((line) => line.replace(/\s*\+\s*/, ":").replace("%", ""))
    .sort();

  return [
    accessory?.Type || "",
    accessory?.Grade || "",
    `q${accessory?.Quality ?? ""}`,
    stat ? `stat:${stat}` : "",
    ark ? `ark:${ark}` : "",
    ...refinements.map((line) => `refine:${line}`)
  ].filter(Boolean).join("|");
}

function formatRefinementOption(option) {
  const value = toNumber(option?.Value, 0);
  const suffix = option?.IsValuePercentage ? "%" : "";
  return `${option?.OptionName || ""} +${value.toFixed(option?.IsValuePercentage ? 2 : 0)}${suffix}`;
}

function getAuctionBuyPrice(item) {
  return toNumber(item?.AuctionInfo?.BuyPrice, null)
    ?? toNumber(item?.AuctionInfo?.StartPrice, null)
    ?? toNumber(item?.AuctionInfo?.BidStartPrice, null);
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sectionLines(accessory, titlePattern) {
  return (accessory?.DetailSections || [])
    .filter((section) => String(section.title || section.Title || "").includes(titlePattern))
    .flatMap((section) => section.lines || section.Lines || []);
}

function firstLine(accessory, titlePattern) {
  return sectionLines(accessory, titlePattern)[0] || "";
}
```

- [ ] **Step 5: Run the normalization tests**

Run:

```bash
npm test -- tests/accessoryAuction.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the normalization module**

Run:

```bash
git add lib/lostark/accessoryAuction.js tests/accessoryAuction.test.js tests/fixtures/accessoryEfficiencySamples.js
git commit -m "feat: normalize auction accessories"
```

Expected: one commit with the fixture, test, and normalization module.

---

### Task 2: Accessory Replacement Simulation

**Files:**
- Create: `tests/accessoryEfficiencySimulation.test.js`
- Create: `lib/spec/accessoryEfficiencySimulation.js`

- [ ] **Step 1: Write failing simulation tests**

Create `tests/accessoryEfficiencySimulation.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAuctionAccessoryItem } from "../lib/lostark/accessoryAuction.js";
import {
  buildAccessoryEfficiencyRecommendation,
  replaceAccessoryAtIndex
} from "../lib/spec/accessoryEfficiencySimulation.js";
import { auctionAccessoryItems, currentAccessoryEquipment } from "./fixtures/accessoryEfficiencySamples.js";

const profile = {
  CharacterName: "테스트캐릭",
  CombatPower: "1000000",
  CharacterLevel: 70,
  Stats: [
    {
      Type: "공격력",
      Value: "100000",
      Tooltip: [
        "힘, 민첩, 지능과 무기 공격력을 기반으로 증가한 기본 공격력은 <font color='#99ff99'>100000</font> 입니다.",
        "공격력 증감 효과로 공격력이 <font color='#99ff99'>0</font> 증가되었습니다."
      ]
    },
    { Type: "치명", Value: "100" }
  ]
};

test("replaces one accessory without mutating the original equipment array", () => {
  const candidate = normalizeAuctionAccessoryItem(auctionAccessoryItems.validNecklace, "목걸이");
  const replaced = replaceAccessoryAtIndex(currentAccessoryEquipment, 1, candidate);

  assert.equal(replaced[1].Name, "후보 목걸이");
  assert.equal(currentAccessoryEquipment[1].Name, "현재 목걸이");
  assert.notEqual(replaced, currentAccessoryEquipment);
});

test("ranks eligible candidates by gold per one percent combat power", () => {
  const candidates = [
    normalizeAuctionAccessoryItem(auctionAccessoryItems.validNecklace, "목걸이"),
    normalizeAuctionAccessoryItem(auctionAccessoryItems.validRing, "반지")
  ];
  const result = buildAccessoryEfficiencyRecommendation({
    profile,
    equipment: currentAccessoryEquipment,
    candidates,
    combatContext: {
      arkPassive: {},
      arkGrid: {},
      cards: {},
      engravings: [],
      gems: [],
      paradiseOrb: null
    }
  });

  assert.equal(result.Status, "ready");
  assert.equal(result.TopRecommendation.Type, "accessory");
  assert.equal(result.TopRecommendation.Candidate.Name.length > 0, true);
  assert.equal(result.TopRecommendation.CurrentOfficialCombatPower, 1000000);
  assert.equal(result.TopRecommendation.ExpectedCombatPower > 1000000, true);
  assert.equal(result.TopRecommendation.GoldPerOnePercentCombatPower > 0, true);
  assert.equal(result.Comparisons.length <= 3, true);
  assert.equal(result.Comparisons[0].GoldPerOnePercentCombatPower <= result.Comparisons.at(-1).GoldPerOnePercentCombatPower, true);
});

test("selects the best current ring slot for a ring candidate", () => {
  const candidate = normalizeAuctionAccessoryItem(auctionAccessoryItems.validRing, "반지");
  const result = buildAccessoryEfficiencyRecommendation({
    profile,
    equipment: currentAccessoryEquipment,
    candidates: [candidate],
    combatContext: {
      arkPassive: {},
      arkGrid: {},
      cards: {},
      engravings: [],
      gems: [],
      paradiseOrb: null
    }
  });

  assert.equal(result.TopRecommendation.Candidate.Type, "반지");
  assert.match(result.TopRecommendation.ReplacedAccessory.Name, /^현재 반지/);
  assert.equal(Number.isInteger(result.TopRecommendation.ReplacedEquipmentIndex), true);
});

test("returns no-recommendation when no candidate improves combat power", () => {
  const weakCandidate = {
    ...currentAccessoryEquipment[1],
    Name: "약한 후보",
    BuyPrice: 100000,
    DetailSections: [
      { title: "기본 효과", lines: ["힘 +68,000"] },
      { title: "연마 효과", lines: ["최대 마나 +15"] },
      { title: "아크 패시브 포인트 효과", lines: ["깨달음 +13"] }
    ]
  };
  const result = buildAccessoryEfficiencyRecommendation({
    profile,
    equipment: currentAccessoryEquipment,
    candidates: [weakCandidate],
    combatContext: {
      arkPassive: {},
      arkGrid: {},
      cards: {},
      engravings: [],
      gems: [],
      paradiseOrb: null
    }
  });

  assert.equal(result.Status, "noRecommendation");
  assert.equal(result.TopRecommendation, null);
  assert.deepEqual(result.Comparisons, []);
});
```

- [ ] **Step 2: Run the simulation tests and verify failure**

Run:

```bash
npm test -- tests/accessoryEfficiencySimulation.test.js
```

Expected: FAIL with module-not-found for `lib/spec/accessoryEfficiencySimulation.js`.

- [ ] **Step 3: Implement replacement simulation**

Create `lib/spec/accessoryEfficiencySimulation.js` with these exported functions:

```js
import { buildAccessoryContributionIndex } from "./accessoryContributions.js";
import { buildCombatPowerAnalysis } from "./combatPowerModel.js";

const ACCESSORY_TYPES = new Set(["목걸이", "귀걸이", "반지"]);

export function replaceAccessoryAtIndex(equipment, index, candidate) {
  return equipment.map((item, itemIndex) => (itemIndex === index ? { ...candidate } : item));
}

export function buildAccessoryEfficiencyRecommendation({
  profile = {},
  equipment = [],
  candidates = [],
  combatContext = {},
  criticalStats = null
} = {}) {
  const currentAnalysis = buildCombatPowerAnalysis({ profile, equipment, ...combatContext });
  const currentOfficialCombatPower = toNumber(currentAnalysis.OfficialCombatPower, toNumber(profile.CombatPower, null));
  const currentEstimate = toNumber(currentAnalysis.Formula?.Estimate, null);

  if (!currentOfficialCombatPower || !currentEstimate) {
    return { Status: "unavailable", TopRecommendation: null, Comparisons: [], MissingInputs: ["현재 전투력 계산값"] };
  }

  const evaluated = candidates
    .flatMap((candidate) => evaluateCandidateAgainstSlots({
      profile,
      equipment,
      candidate,
      combatContext,
      criticalStats,
      currentOfficialCombatPower,
      currentEstimate
    }))
    .filter((item) => item.CombatPowerGain > 0 && item.CombatPowerGainPercent > 0)
    .sort((left, right) => left.GoldPerOnePercentCombatPower - right.GoldPerOnePercentCombatPower);

  if (!evaluated.length) {
    return { Status: "noRecommendation", TopRecommendation: null, Comparisons: [], MissingInputs: [] };
  }

  return {
    Status: "ready",
    TopRecommendation: evaluated[0],
    Comparisons: evaluated.slice(0, 3),
    MissingInputs: []
  };
}

function evaluateCandidateAgainstSlots({ profile, equipment, candidate, combatContext, criticalStats, currentOfficialCombatPower, currentEstimate }) {
  const candidateType = candidate?.Type;

  if (!ACCESSORY_TYPES.has(candidateType)) {
    return [];
  }

  return equipment
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item?.Type === candidateType)
    .map(({ item, index }) => evaluateReplacement({
      profile,
      equipment,
      candidate,
      replacedAccessory: item,
      replacedEquipmentIndex: index,
      combatContext,
      criticalStats,
      currentOfficialCombatPower,
      currentEstimate
    }))
    .filter(Boolean)
    .sort((left, right) => left.GoldPerOnePercentCombatPower - right.GoldPerOnePercentCombatPower)
    .slice(0, 1);
}

function evaluateReplacement({ profile, equipment, candidate, replacedAccessory, replacedEquipmentIndex, combatContext, criticalStats, currentOfficialCombatPower, currentEstimate }) {
  const simulatedEquipment = replaceAccessoryAtIndex(equipment, replacedEquipmentIndex, candidate);
  const simulatedAnalysis = buildCombatPowerAnalysis({ profile, equipment: simulatedEquipment, ...combatContext });
  const simulatedEstimate = toNumber(simulatedAnalysis.Formula?.Estimate, null);

  if (!simulatedEstimate) {
    return null;
  }

  const combatPowerGain = simulatedEstimate - currentEstimate;
  const combatPowerGainPercent = combatPowerGain / currentOfficialCombatPower * 100;
  const buyPrice = toNumber(candidate.BuyPrice, null);

  if (!buyPrice || combatPowerGainPercent <= 0) {
    return null;
  }

  return {
    Type: "accessory",
    Candidate: candidate,
    ReplacedAccessory: replacedAccessory,
    ReplacedEquipmentIndex: replacedEquipmentIndex,
    CurrentOfficialCombatPower: currentOfficialCombatPower,
    ExpectedCombatPower: Math.round(currentOfficialCombatPower + combatPowerGain),
    CombatPowerGain: round(combatPowerGain, 2),
    CombatPowerGainPercent: round(combatPowerGainPercent, 4),
    BuyPrice: buyPrice,
    GoldPerOnePercentCombatPower: Math.round(buyPrice / combatPowerGainPercent),
    DamageReference: buildAccessoryContributionIndex(simulatedEquipment, profile, criticalStats)
  };
}

function toNumber(value, fallback) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits) {
  const multiplier = 10 ** digits;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
```

- [ ] **Step 4: Run the simulation tests**

Run:

```bash
npm test -- tests/accessoryEfficiencySimulation.test.js
```

Expected: PASS.

- [ ] **Step 5: Run related existing calculation tests**

Run:

```bash
npm test -- tests/combatPowerModel.test.js tests/accessoryContributions.test.js tests/accessoryEfficiencySimulation.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the simulation engine**

Run:

```bash
git add lib/spec/accessoryEfficiencySimulation.js tests/accessoryEfficiencySimulation.test.js
git commit -m "feat: rank accessory combat power efficiency"
```

Expected: one commit with the simulation engine and tests.

---

### Task 3: Recovery Estimate Engine

**Files:**
- Create: `tests/accessoryRecoveryEstimate.test.js`
- Create: `lib/spec/accessoryRecoveryEstimate.js`

- [ ] **Step 1: Write failing recovery tests**

Create `tests/accessoryRecoveryEstimate.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAuctionAccessoryItem } from "../lib/lostark/accessoryAuction.js";
import {
  buildRecoveryEstimate,
  percentile,
  summarizeExactMatchPrices
} from "../lib/spec/accessoryRecoveryEstimate.js";
import { currentAccessoryEquipment } from "./fixtures/accessoryEfficiencySamples.js";

function ringMatch(price) {
  return normalizeAuctionAccessoryItem({
    Name: `매칭 반지 ${price}`,
    Grade: "고대",
    Tier: 4,
    Level: 1640,
    GradeQuality: 90,
    AuctionInfo: { BuyPrice: price },
    Options: [
      { Type: "STAT", OptionName: "힘", Value: 50000, IsValuePercentage: false },
      { Type: "ACCESSORY_UPGRADE", OptionName: "치명타 피해", Value: 2.4, IsValuePercentage: true },
      { Type: "ARK_PASSIVE_POINT", OptionName: "깨달음", Value: 9, IsValuePercentage: false }
    ]
  }, "반지");
}

test("computes percentile values from sorted numeric prices", () => {
  assert.equal(percentile([100, 200, 300, 400], 0.5), 250);
  assert.equal(percentile([100, 200, 300, 400], 0.25), 175);
  assert.equal(percentile([100, 200, 300, 400], 0.75), 325);
});

test("summarizes exact match prices with median and spread", () => {
  const summary = summarizeExactMatchPrices([ringMatch(100000), ringMatch(110000), ringMatch(120000)]);

  assert.equal(summary.Count, 3);
  assert.equal(summary.MedianPrice, 110000);
  assert.equal(summary.InterquartileRange, 10000);
});

test("returns high confidence only for three stable exact matches", () => {
  const currentRing = currentAccessoryEquipment.find((item) => item.Name === "현재 반지 A");
  const estimate = buildRecoveryEstimate({
    currentAccessory: currentRing,
    auctionCandidates: [ringMatch(100000), ringMatch(110000), ringMatch(120000)],
    recommendation: {
      BuyPrice: 300000,
      CombatPowerGainPercent: 0.5
    }
  });

  assert.equal(estimate.Status, "ready");
  assert.equal(estimate.Confidence, "high");
  assert.equal(estimate.EstimatedRecoveryGold, 110000);
  assert.equal(estimate.NetCostGold, 190000);
  assert.equal(estimate.NetGoldPerOnePercentCombatPower, 380000);
});

test("hides net efficiency when exact matches are insufficient", () => {
  const currentRing = currentAccessoryEquipment.find((item) => item.Name === "현재 반지 A");
  const estimate = buildRecoveryEstimate({
    currentAccessory: currentRing,
    auctionCandidates: [ringMatch(100000), ringMatch(110000)],
    recommendation: {
      BuyPrice: 300000,
      CombatPowerGainPercent: 0.5
    }
  });

  assert.equal(estimate.Status, "lowConfidence");
  assert.equal(estimate.Confidence, "low");
  assert.equal(estimate.NetGoldPerOnePercentCombatPower, null);
});
```

- [ ] **Step 2: Run the recovery tests and verify failure**

Run:

```bash
npm test -- tests/accessoryRecoveryEstimate.test.js
```

Expected: FAIL with module-not-found for `lib/spec/accessoryRecoveryEstimate.js`.

- [ ] **Step 3: Implement exact-match recovery estimates**

Create `lib/spec/accessoryRecoveryEstimate.js` with these exports:

```js
import { buildAccessoryFingerprint } from "../lostark/accessoryAuction.js";

export function buildRecoveryEstimate({ currentAccessory, auctionCandidates = [], recommendation = {} } = {}) {
  const currentFingerprint = buildAccessoryFingerprint(currentAccessory);
  const exactMatches = auctionCandidates.filter((candidate) => buildAccessoryFingerprint(candidate) === currentFingerprint);
  const summary = summarizeExactMatchPrices(exactMatches);
  const stableSpread = summary.MedianPrice > 0 && summary.InterquartileRange / summary.MedianPrice <= 0.35;
  const highConfidence = summary.Count >= 3 && stableSpread;

  if (!highConfidence) {
    return {
      Status: "lowConfidence",
      Confidence: "low",
      EvidenceCount: summary.Count,
      EstimatedRecoveryGold: summary.MedianPrice || null,
      NetCostGold: null,
      NetGoldPerOnePercentCombatPower: null
    };
  }

  const buyPrice = Number(recommendation.BuyPrice);
  const gainPercent = Number(recommendation.CombatPowerGainPercent);
  const netCost = Math.max(0, buyPrice - summary.MedianPrice);

  return {
    Status: "ready",
    Confidence: "high",
    EvidenceCount: summary.Count,
    EstimatedRecoveryGold: summary.MedianPrice,
    NetCostGold: netCost,
    NetGoldPerOnePercentCombatPower: gainPercent > 0 ? Math.round(netCost / gainPercent) : null
  };
}

export function summarizeExactMatchPrices(matches) {
  const prices = matches
    .map((item) => Number(item.BuyPrice))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  return {
    Count: prices.length,
    MedianPrice: prices.length ? Math.round(percentile(prices, 0.5)) : null,
    InterquartileRange: prices.length ? Math.round(percentile(prices, 0.75) - percentile(prices, 0.25)) : null
  };
}

export function percentile(sortedValues, ratio) {
  if (!sortedValues.length) {
    return null;
  }

  const index = (sortedValues.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}
```

- [ ] **Step 4: Run recovery tests**

Run:

```bash
npm test -- tests/accessoryRecoveryEstimate.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit recovery estimate engine**

Run:

```bash
git add lib/spec/accessoryRecoveryEstimate.js tests/accessoryRecoveryEstimate.test.js
git commit -m "feat: estimate accessory recovery value"
```

Expected: one commit with recovery estimate engine and tests.

---

### Task 4: Auction Page Search And Cache

**Files:**
- Create: `tests/accessoryAuctionApi.test.js`
- Create: `lib/lostark/accessoryAuctionApi.js`

- [ ] **Step 1: Write failing auction API tests**

Create `tests/accessoryAuctionApi.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCESSORY_SEARCH_LIMITS,
  createAccessoryAuctionSearch
} from "../lib/lostark/accessoryAuctionApi.js";
import { auctionAccessoryItems } from "./fixtures/accessoryEfficiencySamples.js";

test("searches accessory pages until max candidates are reached", async () => {
  const requests = [];
  const search = createAccessoryAuctionSearch({
    postAuction: async (body) => {
      requests.push(body);
      return {
        TotalCount: 999,
        Items: Array.from({ length: 15 }, () => auctionAccessoryItems.validRing)
      };
    },
    now: () => 1000
  });

  const result = await search.searchAccessoryCandidates({ type: "반지", forceRefresh: true });

  assert.equal(result.items.length, ACCESSORY_SEARCH_LIMITS.maxCandidatesPerType);
  assert.equal(requests[0].CategoryCode, 200030);
  assert.equal(requests[0].ItemTier, 4);
  assert.equal(requests[0].ItemGrade, "고대");
  assert.equal(requests[0].Sort, "BUY_PRICE");
  assert.equal(requests[0].SortCondition, "ASC");
});

test("uses raw page cache when forceRefresh is false", async () => {
  let callCount = 0;
  const search = createAccessoryAuctionSearch({
    postAuction: async () => {
      callCount += 1;
      return { TotalCount: 1, Items: [auctionAccessoryItems.validRing] };
    },
    now: () => 1000
  });

  await search.searchAccessoryCandidates({ type: "반지" });
  await search.searchAccessoryCandidates({ type: "반지" });

  assert.equal(callCount, 3);
});

test("bypasses cache when forceRefresh is true", async () => {
  let callCount = 0;
  const search = createAccessoryAuctionSearch({
    postAuction: async () => {
      callCount += 1;
      return { TotalCount: 1, Items: [auctionAccessoryItems.validRing] };
    },
    now: () => 1000
  });

  await search.searchAccessoryCandidates({ type: "반지" });
  await search.searchAccessoryCandidates({ type: "반지", forceRefresh: true });

  assert.equal(callCount, 6);
});
```

- [ ] **Step 2: Run auction API tests and verify failure**

Run:

```bash
npm test -- tests/accessoryAuctionApi.test.js
```

Expected: FAIL with module-not-found for `lib/lostark/accessoryAuctionApi.js`.

- [ ] **Step 3: Implement cached page search**

Create `lib/lostark/accessoryAuctionApi.js` with these exports:

```js
import {
  ACCESSORY_AUCTION_CATEGORIES,
  isEligibleAccessoryCandidate,
  normalizeAuctionAccessoryItem
} from "./accessoryAuction.js";

export const ACCESSORY_SEARCH_LIMITS = {
  minPagesPerType: 3,
  maxPagesPerType: 10,
  maxCandidatesPerType: 100,
  rawPageTtlMs: 2 * 60 * 1000
};

export function createAccessoryAuctionSearch({ postAuction, now = Date.now } = {}) {
  const cache = new Map();

  async function getPage({ type, categoryCode, pageNo, forceRefresh }) {
    const key = `${type}:${pageNo}`;
    const cached = cache.get(key);
    const currentTime = now();

    if (!forceRefresh && cached && cached.expiresAt > currentTime) {
      return { ...cached.value, cached: true };
    }

    const request = {
      CategoryCode: categoryCode,
      ItemTier: 4,
      ItemGrade: "고대",
      PageNo: pageNo,
      Sort: "BUY_PRICE",
      SortCondition: "ASC"
    };
    const response = await postAuction(request);
    const value = { request, response };

    cache.set(key, {
      value,
      expiresAt: currentTime + ACCESSORY_SEARCH_LIMITS.rawPageTtlMs
    });

    return { ...value, cached: false };
  }

  async function searchAccessoryCandidates({ type, forceRefresh = false } = {}) {
    const category = ACCESSORY_AUCTION_CATEGORIES.find((item) => item.type === type);

    if (!category) {
      return { type, items: [], pagesFetched: 0, updatedAt: new Date(now()).toISOString() };
    }

    const items = [];
    let pagesFetched = 0;

    for (let pageNo = 1; pageNo <= ACCESSORY_SEARCH_LIMITS.maxPagesPerType; pageNo += 1) {
      const page = await getPage({ type, categoryCode: category.categoryCode, pageNo, forceRefresh });
      pagesFetched += page.cached ? 0 : 1;
      const rawItems = Array.isArray(page.response?.Items) ? page.response.Items : [];
      const normalized = rawItems
        .map((item) => normalizeAuctionAccessoryItem(item, type))
        .filter((item) => isEligibleAccessoryCandidate(item).eligible);

      items.push(...normalized);

      const totalCount = Number(page.response?.TotalCount || 0);
      const reachedLastPage = rawItems.length === 0 || items.length >= totalCount;
      const reachedCandidateLimit = items.length >= ACCESSORY_SEARCH_LIMITS.maxCandidatesPerType;
      const passedMinimumPages = pageNo >= ACCESSORY_SEARCH_LIMITS.minPagesPerType;

      if ((passedMinimumPages && reachedLastPage) || reachedCandidateLimit) {
        break;
      }
    }

    return {
      type,
      items: items.slice(0, ACCESSORY_SEARCH_LIMITS.maxCandidatesPerType),
      pagesFetched,
      updatedAt: new Date(now()).toISOString()
    };
  }

  return { searchAccessoryCandidates };
}
```

- [ ] **Step 4: Run auction API tests**

Run:

```bash
npm test -- tests/accessoryAuctionApi.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit auction page search**

Run:

```bash
git add lib/lostark/accessoryAuctionApi.js tests/accessoryAuctionApi.test.js
git commit -m "feat: search accessory auction pages"
```

Expected: one commit with auction page search and tests.

---

### Task 5: Character Efficiency Context

**Files:**
- Create: `tests/characterEfficiencyContext.test.js`
- Create: `lib/lostark/characterEfficiencyContext.js`

- [ ] **Step 1: Write failing context tests**

Create `tests/characterEfficiencyContext.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARACTER_EFFICIENCY_ERROR_CODES,
  CharacterEfficiencyError,
  getLostarkAuthorizationHeader,
  loadCharacterEfficiencyContext
} from "../lib/lostark/characterEfficiencyContext.js";

test("normalizes Lostark authorization header from env token", () => {
  assert.equal(getLostarkAuthorizationHeader({ LOSTARK_API_KEY: "abc" }), "bearer abc");
  assert.equal(getLostarkAuthorizationHeader({ LOSTARK_OPEN_API_KEY: "Bearer def" }), "Bearer def");
  assert.equal(getLostarkAuthorizationHeader({}), null);
});

test("throws character not found when profile endpoint returns null", async () => {
  await assert.rejects(
    () => loadCharacterEfficiencyContext({
      characterName: "없는캐릭",
      authorization: "bearer token",
      fetchLostark: async (path) => (path.includes("/profiles") ? null : [])
    }),
    (error) => {
      assert.ok(error instanceof CharacterEfficiencyError);
      assert.equal(error.code, CHARACTER_EFFICIENCY_ERROR_CODES.CHARACTER_NOT_FOUND);
      return true;
    }
  );
});

test("loads normalized context required for simulation", async () => {
  const context = await loadCharacterEfficiencyContext({
    characterName: "테스트",
    authorization: "bearer token",
    fetchLostark: async (path) => {
      if (path.includes("/profiles")) {
        return { CharacterName: "테스트", CombatPower: "1000000", Stats: [] };
      }

      if (path.includes("/equipment")) {
        return [];
      }

      if (path.includes("/engravings")) {
        return { Engravings: [] };
      }

      if (path.includes("/cards")) {
        return { Cards: [] };
      }

      if (path.includes("/gems")) {
        return { Gems: [] };
      }

      return {};
    }
  });

  assert.equal(context.profile.CharacterName, "테스트");
  assert.deepEqual(context.equipment, []);
  assert.deepEqual(context.combatContext.engravings, []);
  assert.equal(Array.isArray(context.criticalStats.GlobalSources), true);
});
```

- [ ] **Step 2: Run context tests and verify failure**

Run:

```bash
npm test -- tests/characterEfficiencyContext.test.js
```

Expected: FAIL with module-not-found for `lib/lostark/characterEfficiencyContext.js`.

- [ ] **Step 3: Implement character context loading**

Create `lib/lostark/characterEfficiencyContext.js` by extracting the same normalizers used in `app/api/characters/[name]/route.js`:

```js
import { normalizeCards } from "./cards.js";
import { normalizeEngravings } from "./engravings.js";
import { EXCLUDED_EQUIPMENT_TYPES, extractParadiseOrbInfo, normalizeEquipmentItem } from "./equipment.js";
import { normalizeGems } from "./gems.js";
import { buildClassIdentityEffects } from "../spec/classIdentityEffects.js";
import { buildCriticalStats } from "../spec/criticalStats.js";

export const CHARACTER_EFFICIENCY_ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  CHARACTER_NOT_FOUND: "CHARACTER_NOT_FOUND",
  LOSTARK_API_ERROR: "LOSTARK_API_ERROR"
};

export class CharacterEfficiencyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CharacterEfficiencyError";
    this.code = code;
  }
}

export function getLostarkAuthorizationHeader(env = process.env) {
  const token = env.LOSTARK_API_KEY || env.LOSTARK_OPEN_API_KEY;

  if (!token || !token.trim()) {
    return null;
  }

  const normalizedToken = token.trim();
  return normalizedToken.toLowerCase().startsWith("bearer ") ? normalizedToken : `bearer ${normalizedToken}`;
}

export async function defaultFetchLostark(path, authorization) {
  const response = await fetch(`https://developer-lostark.game.onstove.com${path}`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization
    }
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new CharacterEfficiencyError(CHARACTER_EFFICIENCY_ERROR_CODES.LOSTARK_API_ERROR, "Lostark API error");
  }

  return response.json();
}

export async function loadCharacterEfficiencyContext({ characterName, authorization, fetchLostark = defaultFetchLostark } = {}) {
  if (!authorization) {
    throw new CharacterEfficiencyError(CHARACTER_EFFICIENCY_ERROR_CODES.MISSING_API_KEY, "공식 Lostark Open API 키가 필요해.");
  }

  const encodedName = encodeURIComponent(characterName);
  const [profile, equipment, arkPassive, arkGrid, cards, skills, engravings, gems] = await Promise.all([
    fetchLostark(`/armories/characters/${encodedName}/profiles`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/equipment`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/arkpassive`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/arkgrid`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/cards`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/combat-skills`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/engravings`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/gems`, authorization)
  ]);

  if (!profile) {
    throw new CharacterEfficiencyError(CHARACTER_EFFICIENCY_ERROR_CODES.CHARACTER_NOT_FOUND, "해당 캐릭터를 찾지 못했어.");
  }

  const paradiseOrb = extractParadiseOrbInfo(equipment);
  const normalizedEquipment = Array.isArray(equipment)
    ? equipment.filter((item) => !EXCLUDED_EQUIPMENT_TYPES.has(item?.Type)).map(normalizeEquipmentItem)
    : [];
  const normalizedCards = normalizeCards(cards);
  const normalizedEngravings = normalizeEngravings(engravings);
  const normalizedGems = normalizeGems(gems);
  const normalizedSkills = Array.isArray(skills) ? skills : [];
  const classIdentityEffects = buildClassIdentityEffects(profile, {
    arkPassive: arkPassive || {},
    engravings: normalizedEngravings
  });
  const criticalStats = buildCriticalStats({
    profile,
    equipment: normalizedEquipment,
    engravings: normalizedEngravings,
    skills: normalizedSkills,
    arkPassive: arkPassive || {},
    arkGrid: arkGrid || {},
    cards: normalizedCards,
    classIdentityEffects
  });

  return {
    profile,
    equipment: normalizedEquipment,
    paradiseOrb,
    criticalStats,
    combatContext: {
      arkPassive: arkPassive || {},
      arkGrid: arkGrid || {},
      cards: normalizedCards,
      engravings: normalizedEngravings,
      gems: normalizedGems,
      paradiseOrb
    }
  };
}
```

- [ ] **Step 4: Run context tests**

Run:

```bash
npm test -- tests/characterEfficiencyContext.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit character context module**

Run:

```bash
git add lib/lostark/characterEfficiencyContext.js tests/characterEfficiencyContext.test.js
git commit -m "feat: load efficiency character context"
```

Expected: one commit with the context loader and tests.

---

### Task 6: Fast Recommendation API

**Files:**
- Create: `app/api/efficiency/accessories/[name]/route.js`
- Create: `tests/accessoryEfficiencyApi.test.js`

- [ ] **Step 1: Write API route tests**

Create `tests/accessoryEfficiencyApi.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { GET as getRecommendation } from "../app/api/efficiency/accessories/[name]/route.js";

test("fast recommendation route rejects empty character name", async () => {
  const response = await getRecommendation(new Request("http://localhost/api/efficiency/accessories/%20"), {
    params: Promise.resolve({ name: "%20" })
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, "INVALID_CHARACTER_NAME");
});

test("fast recommendation route returns missing key error", async () => {
  const previous = process.env.LOSTARK_API_KEY;
  const previousOpen = process.env.LOSTARK_OPEN_API_KEY;
  delete process.env.LOSTARK_API_KEY;
  delete process.env.LOSTARK_OPEN_API_KEY;

  try {
    const response = await getRecommendation(new Request("http://localhost/api/efficiency/accessories/test"), {
      params: Promise.resolve({ name: "test" })
    });
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.code, "MISSING_API_KEY");
  } finally {
    if (previous !== undefined) {
      process.env.LOSTARK_API_KEY = previous;
    }

    if (previousOpen !== undefined) {
      process.env.LOSTARK_OPEN_API_KEY = previousOpen;
    }
  }
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run:

```bash
npm test -- tests/accessoryEfficiencyApi.test.js
```

Expected: FAIL with module-not-found for the API route.

- [ ] **Step 3: Implement fast recommendation route**

Create `app/api/efficiency/accessories/[name]/route.js`:

```js
import { NextResponse } from "next/server";
import { createAccessoryAuctionSearch } from "../../../../../lib/lostark/accessoryAuctionApi.js";
import {
  CHARACTER_EFFICIENCY_ERROR_CODES,
  CharacterEfficiencyError,
  defaultFetchLostark,
  getLostarkAuthorizationHeader,
  loadCharacterEfficiencyContext
} from "../../../../../lib/lostark/characterEfficiencyContext.js";
import { buildAccessoryEfficiencyRecommendation } from "../../../../../lib/spec/accessoryEfficiencySimulation.js";

export const runtime = "nodejs";

const ERROR_CODES = {
  INVALID_CHARACTER_NAME: "INVALID_CHARACTER_NAME",
  MISSING_API_KEY: "MISSING_API_KEY",
  CHARACTER_NOT_FOUND: "CHARACTER_NOT_FOUND",
  LOSTARK_API_ERROR: "LOSTARK_API_ERROR"
};

async function postAuction(body, authorization) {
  const response = await fetch("https://developer-lostark.game.onstove.com/auctions/items", {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Lostark auction API ${response.status}`);
  }

  return response.json();
}

export async function GET(request, context) {
  const { name } = await context.params;
  const characterName = decodeURIComponent(name || "").trim();
  const authorization = getLostarkAuthorizationHeader();
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";

  if (!characterName) {
    return NextResponse.json({ code: ERROR_CODES.INVALID_CHARACTER_NAME, message: "조회할 캐릭터명을 입력해줘." }, { status: 400 });
  }

  if (!authorization) {
    return NextResponse.json({ code: ERROR_CODES.MISSING_API_KEY, message: "공식 Lostark Open API 키가 필요해." }, { status: 500 });
  }

  try {
    const characterContext = await loadCharacterEfficiencyContext({
      characterName,
      authorization,
      fetchLostark: defaultFetchLostark
    });
    const search = createAccessoryAuctionSearch({
      postAuction: (body) => postAuction(body, authorization)
    });
    const candidateGroups = await Promise.all(["목걸이", "귀걸이", "반지"].map((type) => search.searchAccessoryCandidates({ type, forceRefresh })));
    const candidates = candidateGroups.flatMap((group) => group.items);
    const recommendation = buildAccessoryEfficiencyRecommendation({
      profile: characterContext.profile,
      equipment: characterContext.equipment,
      candidates,
      combatContext: characterContext.combatContext,
      criticalStats: characterContext.criticalStats
    });

    return NextResponse.json({
      CharacterName: characterName,
      UpdatedAt: new Date().toISOString(),
      MarketUpdatedAt: candidateGroups.map((group) => group.updatedAt).sort().at(-1) || "",
      SearchSummary: candidateGroups.map((group) => ({
        Type: group.type,
        CandidateCount: group.items.length,
        PagesFetched: group.pagesFetched
      })),
      Recommendation: recommendation
    });
  } catch (error) {
    if (error instanceof CharacterEfficiencyError && error.code === CHARACTER_EFFICIENCY_ERROR_CODES.CHARACTER_NOT_FOUND) {
      return NextResponse.json({ code: ERROR_CODES.CHARACTER_NOT_FOUND, message: "해당 캐릭터를 찾지 못했어." }, { status: 404 });
    }

    console.error(error);
    return NextResponse.json({ code: ERROR_CODES.LOSTARK_API_ERROR, message: "전투력 효율 계산에 필요한 정보를 불러오지 못했어." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run API route tests**

Run:

```bash
npm test -- tests/accessoryEfficiencyApi.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit fast recommendation API**

Run:

```bash
git add app/api/efficiency/accessories/[name]/route.js tests/accessoryEfficiencyApi.test.js
git commit -m "feat: add accessory efficiency API"
```

Expected: one commit with fast recommendation API and tests.

---

### Task 7: Recovery Estimate API

**Files:**
- Create: `app/api/efficiency/accessories/recovery/route.js`
- Modify: `tests/accessoryEfficiencyApi.test.js`

- [ ] **Step 1: Add recovery route tests**

Add this import near the top of `tests/accessoryEfficiencyApi.test.js`:

```js
import { POST as postRecovery } from "../app/api/efficiency/accessories/recovery/route.js";
```

Then append this test to `tests/accessoryEfficiencyApi.test.js`:

```js
test("recovery route validates request body", async () => {
  const response = await postRecovery(new Request("http://localhost/api/efficiency/accessories/recovery", {
    method: "POST",
    body: JSON.stringify({})
  }));
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, "INVALID_RECOVERY_REQUEST");
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run:

```bash
npm test -- tests/accessoryEfficiencyApi.test.js
```

Expected: FAIL with module-not-found for recovery route.

- [ ] **Step 3: Implement recovery route**

Create `app/api/efficiency/accessories/recovery/route.js`:

```js
import { NextResponse } from "next/server";
import { createAccessoryAuctionSearch } from "../../../../../lib/lostark/accessoryAuctionApi.js";
import { getLostarkAuthorizationHeader } from "../../../../../lib/lostark/characterEfficiencyContext.js";
import { buildRecoveryEstimate } from "../../../../../lib/spec/accessoryRecoveryEstimate.js";

export const runtime = "nodejs";

async function postAuction(body, authorization) {
  const response = await fetch("https://developer-lostark.game.onstove.com/auctions/items", {
    method: "POST",
    cache: "no-store",
    headers: {
      accept: "application/json",
      authorization,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Lostark auction API ${response.status}`);
  }

  return response.json();
}

export async function POST(request) {
  const authorization = getLostarkAuthorizationHeader();
  const body = await request.json().catch(() => null);

  if (!body?.CurrentAccessory?.Type || !body?.Recommendation?.BuyPrice || !body?.Recommendation?.CombatPowerGainPercent) {
    return NextResponse.json({ code: "INVALID_RECOVERY_REQUEST", message: "회수가 추정에 필요한 추천 결과가 없어." }, { status: 400 });
  }

  if (!authorization) {
    return NextResponse.json({ code: "MISSING_API_KEY", message: "공식 Lostark Open API 키가 필요해." }, { status: 500 });
  }

  try {
    const search = createAccessoryAuctionSearch({ postAuction: (payload) => postAuction(payload, authorization) });
    const group = await search.searchAccessoryCandidates({
      type: body.CurrentAccessory.Type,
      forceRefresh: Boolean(body.ForceRefresh)
    });
    const estimate = buildRecoveryEstimate({
      currentAccessory: body.CurrentAccessory,
      auctionCandidates: group.items,
      recommendation: body.Recommendation
    });

    return NextResponse.json({
      UpdatedAt: new Date().toISOString(),
      SearchSummary: {
        Type: group.type,
        CandidateCount: group.items.length,
        PagesFetched: group.pagesFetched
      },
      RecoveryEstimate: estimate
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ code: "LOSTARK_API_ERROR", message: "현재 악세 예상 회수가를 계산하지 못했어." }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run API tests**

Run:

```bash
npm test -- tests/accessoryEfficiencyApi.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit recovery API**

Run:

```bash
git add app/api/efficiency/accessories/recovery/route.js tests/accessoryEfficiencyApi.test.js
git commit -m "feat: add accessory recovery API"
```

Expected: one commit with recovery API and tests.

---

### Task 8: Simulator Page Shell And Navigation

**Files:**
- Create: `components/AppNavigation.jsx`
- Create: `components/CombatPowerEfficiencyPage.jsx`
- Create: `components/AccessoryRecommendationPanel.jsx`
- Create: `app/efficiency/page.jsx`
- Modify: `app/page.jsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Create top-level navigation component**

Create `components/AppNavigation.jsx`:

```jsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "캐릭터 분석" },
  { href: "/efficiency", label: "전투력 효율 시뮬레이터" }
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="app-nav" aria-label="주요 기능">
      {LINKS.map((link) => (
        <Link className={pathname === link.href ? "active" : ""} href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create recommendation panel component**

Create `components/AccessoryRecommendationPanel.jsx`:

```jsx
import { formatNumber, valueOf } from "./armoryUtils.js";

function formatGold(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number)}G` : "-";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(4)}%` : "-";
}

function AccessorySummary({ title, accessory }) {
  const sections = Array.isArray(accessory?.DetailSections) ? accessory.DetailSections : [];
  const lines = sections.flatMap((section) => section.lines || section.Lines || []).slice(0, 4);

  return (
    <div className="accessory-summary">
      <span>{title}</span>
      <strong>{valueOf(accessory, ["Name", "name"], "악세사리")}</strong>
      <div className="simulator-meta">
        <span>품질 {valueOf(accessory, ["Quality", "quality"], "-")}</span>
        <span>깨달음 {valueOf(accessory, ["EnlightenmentPoint", "enlightenmentPoint"], "-")}</span>
      </div>
      <ul>
        {lines.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AccessoryRecommendationPanel({ recommendation, recovery, isRecoveryLoading }) {
  const status = valueOf(recommendation, ["Status", "status"], "unavailable");
  const top = valueOf(recommendation, ["TopRecommendation", "topRecommendation"], null);
  const comparisons = Array.isArray(recommendation?.Comparisons) ? recommendation.Comparisons : [];

  if (status === "noRecommendation") {
    return <section className="info-panel simulator-panel"><p className="empty-state">현재 조건에서 추천할 만한 악세가 없습니다</p></section>;
  }

  if (!top) {
    return <section className="info-panel simulator-panel"><p className="empty-state">전투력 효율 추천 결과가 아직 없어.</p></section>;
  }

  return (
    <section className="info-panel simulator-panel" aria-labelledby="accessory-recommendation-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Combat Power Efficiency</p>
          <h2 id="accessory-recommendation-title">악세사리 교체 추천</h2>
        </div>
        <span className="status-pill enabled">1위 추천</span>
      </div>

      <div className="simulator-scoreboard">
        <div>
          <span>예상 전투력</span>
          <strong>{formatNumber(top.CurrentOfficialCombatPower)} -> {formatNumber(top.ExpectedCombatPower)}</strong>
        </div>
        <div>
          <span>전투력 상승률</span>
          <strong>{formatPercent(top.CombatPowerGainPercent)}</strong>
        </div>
        <div>
          <span>+1%당 골드</span>
          <strong>{formatGold(top.GoldPerOnePercentCombatPower)}</strong>
        </div>
        <div>
          <span>즉시구매가</span>
          <strong>{formatGold(top.BuyPrice)}</strong>
        </div>
      </div>

      <div className="accessory-compare-grid">
        <AccessorySummary title="현재 교체 대상" accessory={top.ReplacedAccessory} />
        <AccessorySummary title="추천 후보" accessory={top.Candidate} />
      </div>

      <div className="recovery-box">
        {isRecoveryLoading ? (
          <span>현재 악세 예상 회수가 계산 중</span>
        ) : recovery?.RecoveryEstimate?.Status === "ready" ? (
          <span>예상 회수가 {formatGold(recovery.RecoveryEstimate.EstimatedRecoveryGold)} · 순비용 기준 +1%당 {formatGold(recovery.RecoveryEstimate.NetGoldPerOnePercentCombatPower)}</span>
        ) : recovery ? (
          <span>근거 부족으로 순비용 효율을 표시하지 않습니다</span>
        ) : (
          <span>즉시구매가 기준 효율을 먼저 표시합니다</span>
        )}
      </div>

      {comparisons.length > 1 ? (
        <details className="comparison-details">
          <summary>상위 3개 비교</summary>
          <div className="comparison-list">
            {comparisons.map((item, index) => (
              <article className="comparison-row" key={`${item.Candidate?.Name}-${index}`}>
                <strong>{index + 1}. {item.Candidate?.Name}</strong>
                <span>{item.Candidate?.Type} · {formatGold(item.BuyPrice)} · +1%당 {formatGold(item.GoldPerOnePercentCombatPower)}</span>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 3: Create simulator page shell**

Create `components/CombatPowerEfficiencyPage.jsx`:

```jsx
"use client";

import { useEffect, useState } from "react";
import AccessoryRecommendationPanel from "./AccessoryRecommendationPanel.jsx";

export default function CombatPowerEfficiencyPage() {
  const [characterName, setCharacterName] = useState("");
  const [result, setResult] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const recent = window.localStorage.getItem("sggu:lastCharacterName") || "";
    setCharacterName(recent);
  }, []);

  async function loadRecommendation(event) {
    event.preventDefault();
    const name = characterName.trim();

    if (!name || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    setRecovery(null);

    try {
      const response = await fetch(`/api/efficiency/accessories/${encodeURIComponent(name)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "전투력 효율을 계산하지 못했어.");
      }

      setResult(data);
      window.localStorage.setItem("sggu:lastCharacterName", name);

      const top = data?.Recommendation?.TopRecommendation;
      if (top) {
        loadRecovery(top);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "전투력 효율을 계산하지 못했어.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRecovery(top) {
    setIsRecoveryLoading(true);

    try {
      const response = await fetch("/api/efficiency/accessories/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          CurrentAccessory: top.ReplacedAccessory,
          Recommendation: {
            BuyPrice: top.BuyPrice,
            CombatPowerGainPercent: top.CombatPowerGainPercent
          }
        })
      });
      const data = await response.json();

      if (response.ok) {
        setRecovery(data);
      }
    } finally {
      setIsRecoveryLoading(false);
    }
  }

  return (
    <section className="efficiency-shell" aria-labelledby="efficiency-title">
      <div className="efficiency-header">
        <p className="eyebrow">Simulator</p>
        <h1 id="efficiency-title">전투력 효율 시뮬레이터</h1>
      </div>

      <form className="efficiency-search" onSubmit={loadRecommendation}>
        <label className="sr-only" htmlFor="efficiency-character-name">캐릭터명</label>
        <input
          id="efficiency-character-name"
          value={characterName}
          onChange={(event) => setCharacterName(event.target.value)}
          placeholder="캐릭터명을 입력해줘"
          autoComplete="off"
        />
        <button type="submit" disabled={isLoading}>{isLoading ? "계산 중" : "시뮬레이션"}</button>
      </form>

      {error ? <p className="error-state">{error}</p> : null}
      {isLoading ? <p className="empty-state">경매장 후보를 탐색하고 전투력 효율을 계산하는 중이야.</p> : null}
      {result ? (
        <AccessoryRecommendationPanel
          recommendation={result.Recommendation}
          recovery={recovery}
          isRecoveryLoading={isRecoveryLoading}
        />
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Create dedicated `/efficiency` route**

Create `app/efficiency/page.jsx`:

```jsx
import AppNavigation from "../../components/AppNavigation.jsx";
import CombatPowerEfficiencyPage from "../../components/CombatPowerEfficiencyPage.jsx";

export default function EfficiencyPage() {
  return (
    <main className="home armory-home">
      <AppNavigation />
      <CombatPowerEfficiencyPage />
    </main>
  );
}
```

- [ ] **Step 5: Save last character name from character analysis page**

Modify `app/page.jsx`:

```jsx
import AppNavigation from "../components/AppNavigation.jsx";
```

In `loadCharacter`, after `setArmory(data);`, add:

```jsx
window.localStorage.setItem("sggu:lastCharacterName", characterName);
```

In the returned `<main>` for the non-welcome state, render:

```jsx
<AppNavigation />
```

as the first child of `<main>`.

- [ ] **Step 6: Add simulator CSS**

Append to `app/globals.css`:

```css
.app-nav {
  width: min(1120px, calc(100% - 32px));
  margin: 24px auto 0;
  display: flex;
  gap: 8px;
  align-items: center;
}

.app-nav a {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-secondary);
  text-decoration: none;
  background: var(--color-surface);
  font-weight: 700;
}

.app-nav a.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.efficiency-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 32px auto 80px;
}

.efficiency-header h1 {
  margin: 4px 0 20px;
  font-size: 32px;
  line-height: 1.25;
}

.efficiency-search {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.efficiency-search input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.efficiency-search button {
  border: 0;
  border-radius: var(--radius-sm);
  padding: 12px 16px;
  color: #fff;
  background: var(--color-tertiary);
  font-weight: 700;
}

.simulator-panel {
  margin-top: 20px;
}

.simulator-scoreboard,
.accessory-compare-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.simulator-scoreboard > div,
.accessory-summary,
.recovery-box,
.comparison-row {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 14px;
  background: var(--color-neutral);
}

.simulator-scoreboard span,
.accessory-summary span,
.comparison-row span {
  display: block;
  color: var(--color-secondary);
  font-size: 13px;
}

.simulator-scoreboard strong,
.accessory-summary strong {
  display: block;
  margin-top: 4px;
}

.accessory-compare-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.accessory-summary ul {
  margin: 10px 0 0;
  padding-left: 18px;
  color: var(--color-secondary);
}

.simulator-meta {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.recovery-box,
.comparison-details {
  margin-top: 14px;
}

.comparison-details summary {
  cursor: pointer;
  font-weight: 700;
}

.comparison-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.error-state {
  color: var(--color-danger);
  font-weight: 700;
}

@media (max-width: 760px) {
  .app-nav,
  .efficiency-search {
    flex-direction: column;
    align-items: stretch;
  }

  .simulator-scoreboard,
  .accessory-compare-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 7: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 8: Commit simulator page shell**

Run:

```bash
git add app/page.jsx app/efficiency/page.jsx components/AppNavigation.jsx components/CombatPowerEfficiencyPage.jsx components/AccessoryRecommendationPanel.jsx app/globals.css
git commit -m "feat: add combat power efficiency page"
```

Expected: one commit with UI page shell and styles.

---

### Task 9: Full Verification

**Files:**
- Modify only if verification exposes a defect in files changed by earlier tasks.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Start local dev server**

Run:

```bash
npm run dev
```

Expected: Next.js dev server starts and prints a local URL.

- [ ] **Step 5: Manually verify simulator route**

Open the dev server URL and navigate to `/efficiency`.

Expected:

- The page title is `전투력 효율 시뮬레이터`.
- The top navigation shows `캐릭터 분석` and `전투력 효율 시뮬레이터`.
- The character input is visible.
- Submitting without an API key shows a missing-key error.
- With a valid `LOSTARK_API_KEY`, a successful character can show either a recommendation card or `현재 조건에서 추천할 만한 악세가 없습니다`.

- [ ] **Step 6: Commit verification fixes**

If no fixes were needed, mark this step complete without creating a commit.

If fixes were needed, stage the files from this plan that changed during verification and run:

```bash
git add lib/lostark/accessoryAuction.js lib/lostark/accessoryAuctionApi.js lib/lostark/characterEfficiencyContext.js lib/spec/accessoryEfficiencySimulation.js lib/spec/accessoryRecoveryEstimate.js app/api/efficiency/accessories/[name]/route.js app/api/efficiency/accessories/recovery/route.js app/page.jsx app/efficiency/page.jsx components/AppNavigation.jsx components/CombatPowerEfficiencyPage.jsx components/AccessoryRecommendationPanel.jsx app/globals.css tests/accessoryAuction.test.js tests/accessoryAuctionApi.test.js tests/characterEfficiencyContext.test.js tests/accessoryEfficiencySimulation.test.js tests/accessoryRecoveryEstimate.test.js tests/accessoryEfficiencyApi.test.js
git commit -m "fix: stabilize combat power efficiency simulator"
```

Expected: any verification fix is isolated in one final commit.

---

## Self-Review Checklist

- Spec coverage: This plan covers top-level simulator navigation, direct character input, previous character reuse through `localStorage`, T4 ancient necklace/earring/ring search, max-enlightenment filtering, virtual replacement, `전투력 +1%당 골드`, top recommendation plus top-three comparison, split recovery API, low-confidence hiding, no-recommendation state, and fixture-based tests.
- Scope control: Bracelets, gems, avatars, honing, Spring Boot migration, and skill-damage-share modeling stay out of the first implementation.
- Type consistency: Public DTO names use PascalCase to match existing API DTO style. UI reads PascalCase first through direct fields or existing `valueOf` helper.
- Verification: The required commands are `npm test`, `npm run lint`, and `npm run build`.
