import { parseTooltip, splitTooltipLines, stripMarkup } from "../lostark/equipment.js";

const SOURCE_BASE_COEFFICIENT = 0.0288;
const IN_GAME_DISPLAY_SCALE = 0.01;
const FLAT_ATTACK_REFERENCE = 142857;
const ASSUMED_PET_RANCH_ADDITIONAL_DAMAGE_PERCENT = 1;
const ARK_GRID_BURNING_STRIKE_BOSS_DAMAGE_REFERENCE = 1.82;
const PARADISE_POWER_REFERENCE = 100000000;
const EVOLUTION_POINT_COMBAT_POWER_PERCENT = 0.75;
const ENLIGHTENMENT_POINT_COMBAT_POWER_CAP = 100;
const ENLIGHTENMENT_POINT_COMBAT_POWER_PERCENT = 0.7;
const ENLIGHTENMENT_SIDE_NODE_POINT_COST = 2;
const ENLIGHTENMENT_ASSUMED_FULL_SIDE_NODE_POINTS = 4;
const ENLIGHTENMENT_TIER_ONE_MAIN_NODE_POINT_COST = 24;
const ENLIGHTENMENT_MAIN_NODE_POINT_COST = 8;
const ENLIGHTENMENT_POINT_FORMULA_BASIS = "붐버 실측 재검증: 깨달음 전투력은 100P cap, 포인트당 0.7%. 100P와 101P 모두 +70%. 선택 노드/사이드/4T 파싱값은 진단용으로만 유지.";
const KNOWN_ENLIGHTENMENT_SIDE_NODE_NAMES = new Set(["신속 포격"]);

const GEM_PURE_COMBAT_POWER_FACTORS = new Map([
  [1, 1.28],
  [2, 1.92],
  [3, 2.56],
  [4, 3.2],
  [5, 3.84],
  [6, 4.48],
  [7, 5.12],
  [8, 5.76],
  [9, 6.4],
  [10, 7.04]
]);

const PARADISE_ORB_COMBAT_POWER_RULES = {
  attack: {
    baseBasisPoints: 20,
    paradiseBasisPoints: 800,
    label: "공격형 보주"
  },
  support: {
    baseBasisPoints: 14,
    paradiseBasisPoints: 544,
    label: "보조형 보주"
  }
};

const COMBAT_LEVEL_FACTORS = [
  { min: 70, percent: 29.45, label: "전투 Lv.70" },
  { min: 65, percent: 23.97, label: "전투 Lv.65-69" },
  { min: 60, percent: 18.56, label: "전투 Lv.60-64" },
  { min: 55, percent: 8.95, label: "전투 Lv.55-59" }
];

const RING_CRIT_RATE_FACTORS = new Map([
  [0.4, 0.30968],
  [0.95, 0.73549],
  [1.55, 1.20001]
]);

const RING_CRIT_DAMAGE_FACTORS = new Map([
  [1.1, 0.33],
  [2.4, 0.72],
  [4, 1.2]
]);

const BRACELET_GRADE_LABELS = ["상", "중", "하"];
const BRACELET_VALUE_TOLERANCE = 0.06;
const BRACELET_OPTION_TABLES = {
  criticalRateCombo: {
    label: "팔찌 치적+치명 적주피",
    values: [5, 4.2, 3.4],
    percents: [4.5, 4, 3.5]
  },
  criticalDamageCombo: {
    label: "팔찌 치피+치명 적주피",
    values: [10, 8.4, 6.8],
    percents: [4.5, 4, 3.5]
  },
  additionalDemonCombo: {
    label: "팔찌 추피+대악마",
    values: [3.5, 3, 2.5],
    percents: [4.5, 4, 3.5]
  },
  cooldownOutgoingCombo: {
    label: "팔찌 쿨증 적주피",
    values: [5.5, 5, 4.5],
    percents: [4.5, 4, 3.5]
  },
  outgoingStaggerCombo: {
    label: "팔찌 적주피+무력화 적주피",
    values: [3, 2.5, 2],
    percents: [4, 3.4, 2.8]
  },
  hitWeaponPowerBuff: {
    label: "팔찌 적중 무공 버프",
    values: [1480, 1320, 1160],
    percents: [2.4, 2.14, 1.88]
  },
  healthWeaponPowerBuff: {
    label: "팔찌 체력 조건 무공 버프",
    values: [2400, 2200, 2000],
    percents: [0.65, 0.59, 0.54]
  },
  stackWeaponPowerBuff: {
    label: "팔찌 누적 무공 버프",
    values: [150, 140, 130],
    percents: [1.21, 1.13, 1.05]
  },
  outgoingDamage: {
    label: "팔찌 적주피",
    values: [3, 2.5, 2],
    percents: [3, 2.5, 2]
  },
  additionalDamage: {
    label: "팔찌 추가 피해",
    values: [4, 3.5, 3],
    percents: [3.0768, 2.6922, 2.3076]
  },
  backAttackOutgoing: {
    label: "팔찌 백어택 스킬 적주피",
    values: [3.5, 3, 2.5],
    percents: [2.45, 2.1, 1.75]
  },
  headAttackOutgoing: {
    label: "팔찌 헤드어택 스킬 적주피",
    values: [3.5, 3, 2.5],
    percents: [2.45, 2.1, 1.75]
  },
  nonDirectionalOutgoing: {
    label: "팔찌 타대 스킬 적주피",
    values: [3.5, 3, 2.5],
    percents: [3.5, 3, 2.5]
  },
  criticalRate: {
    label: "팔찌 치명타 적중률",
    values: [5, 4.2, 3.4],
    percents: [3.5, 2.94, 2.38]
  },
  criticalDamage: {
    label: "팔찌 치명타 피해",
    values: [10, 8.4, 6.8],
    percents: [3.333, 2.79972, 2.26644]
  }
};

const ARK_GRID_ORDER_FACTORS = {
  relic: {
    sunMoon: { 10: 1.5, 14: 4, 17: 7.5, 18: 7.67, 19: 7.83, 20: 8 },
    star: { 10: 1, 14: 2.5, 17: 4.5, 18: 4.67, 19: 4.83, 20: 5 }
  },
  ancient: {
    sunMoon: { 10: 1.5, 14: 4, 17: 8.5, 18: 8.67, 19: 8.83, 20: 9 },
    star: { 10: 1, 14: 2.5, 17: 5.5, 18: 5.67, 19: 5.83, 20: 6 }
  }
};

const ARK_GRID_CHAOS_FACTORS = {
  해: {
    "현란한 공격": { 10: 0.5, 14: 1, 17: 2.5, 18: 2.67, 19: 2.83, 20: 3 },
    "안정적인 공격": { 10: 0, 14: 0.5, 17: 1.5, 18: 1.67, 19: 1.83, 20: 2 },
    "재빠른 공격": { 10: 0, 14: 0.5, 17: 1.5, 18: 1.67, 19: 1.83, 20: 2 }
  },
  달: {
    "불타는 일격": { 10: 0.5, 14: 1, 17: 2.5, 18: 2.67, 19: 2.83, 20: 3 },
    "흡수의 일격": { 10: 0, 14: 0.5, 17: 1.5, 18: 1.67, 19: 1.83, 20: 2 },
    "부수는 일격": { 10: 0, 14: 0.5, 17: 1.5, 18: 1.67, 19: 1.83, 20: 2 }
  },
  별: {
    공격: { 10: 0.5, 14: 1, 17: 2.5, 18: 2.67, 19: 2.83, 20: 3 },
    무기: { 10: 0.35, 14: 0.7, 17: 2.2, 18: 2.3, 19: 2.41, 20: 2.53 }
  }
};

const ARK_GRID_POINT_THRESHOLDS = [10, 14, 17, 18, 19, 20];

const ENGRAVING_BOOK_COUNTS = [0, 5, 10, 15, 20];
const ENGRAVING_BOOK_COUNT_BY_LEVEL = new Map([
  [0, 0],
  [1, 5],
  [2, 10],
  [3, 15],
  [4, 20]
]);

const ENGRAVING_COMBAT_POWER_TABLES = new Map([
  ...engravingTableEntries(["원한"], [
    [18, 21, 21.75, 23.25, 24],
    [18.75, 21.75, 22.5, 24, 24.75],
    [19.5, 22.5, 23.25, 24.75, 25.5],
    [20.25, 23.25, 24, 25.5, 26.25],
    [21, 24, 24.75, 26.25, 27]
  ]),
  ...engravingTableEntries(["아드레날린"], [
    [15.2, 18.08, 18.8, 20.18, 20.9],
    [16.25, 19.13, 19.85, 21.23, 21.95],
    [17.3, 20.18, 20.9, 22.28, 23],
    [18.35, 21.23, 21.95, 23.33, 24.05],
    [19.4, 22.28, 23, 24.38, 25.1]
  ]),
  ...engravingTableEntries(["돌격대장"], [
    [16, 19, 19.76, 21.28, 22],
    [16.8, 19.8, 20.56, 22.08, 22.8],
    [17.6, 20.6, 21.36, 22.88, 23.6],
    [18.4, 21.4, 22.16, 23.68, 24.4],
    [19.2, 22.2, 22.96, 24.48, 25.2]
  ]),
  ...engravingTableEntries(["질량증가"], [
    [16, 19, 19.75, 21.25, 22],
    [16.75, 19.75, 20.5, 22, 22.75],
    [17.5, 20.5, 21.25, 22.75, 23.5],
    [18.25, 21.25, 22, 23.5, 24.25],
    [19, 22, 22.75, 24.25, 25]
  ]),
  ...engravingTableEntries(["결투의대가", "기습의대가"], [
    [15.3, 18, 18.7, 20, 20.7],
    [16, 18.7, 19.4, 20.7, 21.4],
    [16.7, 19.4, 20.1, 21.4, 22.1],
    [17.4, 20.1, 20.8, 22.1, 22.8],
    [18.1, 20.8, 21.5, 22.8, 23.5]
  ]),
  ...engravingTableEntries(["예리한둔기"], [
    [14.39, 17.18, 17.89, 19.31, 19.98],
    [15.13, 17.92, 18.63, 20.05, 20.72],
    [15.88, 18.67, 19.38, 20.8, 21.47],
    [16.62, 19.41, 20.12, 21.54, 22.21],
    [17.36, 20.15, 20.86, 22.28, 22.95]
  ]),
  ...engravingTableEntries(["달인의저력", "바리케이드", "안정된상태", "저주받은인형", "타격의대가"], [
    [14, 17, 17.75, 19.25, 20],
    [14.75, 17.75, 18.5, 20, 20.75],
    [15.5, 18.5, 19.25, 20.75, 21.5],
    [16.25, 19.25, 20, 21.5, 22.25],
    [17, 20, 20.75, 22.25, 23]
  ]),
  ...engravingTableEntries(["속전속결", "슈퍼차지"], [
    [14.4, 16.8, 17.4, 18.6, 19.2],
    [15, 17.4, 18, 19.2, 19.8],
    [15.6, 18, 18.6, 19.8, 20.4],
    [16.2, 18.6, 19.2, 20.4, 21],
    [16.8, 19.2, 19.8, 21, 21.6]
  ]),
  ...engravingTableEntries(["에테르포식자"], [
    [12.6, 15.6, 16.5, 18, 18.6],
    [13.5, 16.5, 17.4, 18.9, 19.5],
    [14.4, 17.4, 18.3, 19.8, 20.4],
    [15.3, 18.3, 19.2, 20.7, 21.3],
    [16.2, 19.2, 20.1, 21.6, 22.2]
  ]),
  ...engravingTableEntries(["마나효율증가"], [
    [13, 16, 16.75, 18.25, 19],
    [13.75, 16.75, 17.5, 19, 19.75],
    [14.5, 17.5, 18.25, 19.75, 20.5],
    [15.25, 18.25, 19, 20.5, 21.25],
    [16, 19, 19.75, 21.25, 22]
  ]),
  ...engravingTableEntries(["약자무시"], [
    [9.9, 12.3, 12.9, 14.1, 14.7],
    [10.73, 13.13, 13.73, 14.93, 15.53],
    [11.55, 13.95, 14.55, 15.75, 16.35],
    [12.38, 14.78, 15.38, 16.58, 17.18],
    [13.2, 15.6, 16.2, 17.4, 18]
  ]),
  ...engravingTableEntries(["정밀단도"], [
    [10.6, 12.7, 13.23, 14.28, 14.8],
    [11.13, 13.23, 13.76, 14.81, 15.33],
    [11.65, 13.75, 14.28, 15.33, 15.85],
    [12.18, 14.28, 14.81, 15.86, 16.38],
    [12.7, 14.8, 15.33, 16.38, 16.9]
  ]),
  ...engravingTableEntries(["추진력"], [
    [9.8, 11.9, 12.43, 13.48, 14],
    [10.33, 12.43, 12.96, 14.01, 14.53],
    [10.85, 12.95, 13.48, 14.53, 15.05],
    [11.38, 13.48, 14.01, 15.06, 15.58],
    [11.9, 14, 14.53, 15.58, 16.1]
  ]),
  ...engravingTableEntries(["마나의흐름"], [
    [7.53, 7.53, 7.53, 7.53, 7.53],
    [8.4, 8.4, 8.4, 8.4, 8.4],
    [9.29, 9.29, 9.29, 9.29, 9.29],
    [10.2, 10.2, 10.2, 10.2, 10.2],
    [11.11, 11.11, 11.11, 11.11, 11.11]
  ]),
  ...engravingTableEntries(["시선집중"], [
    [7.5, 8.7, 9, 9.6, 9.9],
    [7.88, 9.08, 9.38, 9.98, 10.28],
    [8.25, 9.45, 9.75, 10.35, 10.65],
    [8.63, 9.83, 10.13, 10.73, 11.03],
    [9, 10.2, 10.5, 11.1, 11.4]
  ]),
  ...engravingTableEntries(["부러진뼈"], [
    [7.4, 8.2, 8.4, 8.8, 9],
    [7.65, 8.45, 8.65, 9.05, 9.25],
    [7.9, 8.7, 8.9, 9.3, 9.5],
    [8.15, 8.95, 9.15, 9.55, 9.75],
    [8.4, 9.2, 9.4, 9.8, 10]
  ]),
  ...engravingTableEntries(["실드관통"], [
    [4.6, 5.4, 5.6, 6, 6.2],
    [4.8, 5.6, 5.8, 6.2, 6.4],
    [5, 5.8, 6, 6.4, 6.6],
    [5.2, 6, 6.2, 6.6, 6.8],
    [5.4, 6.2, 6.4, 6.8, 7]
  ]),
  ...engravingTableEntries(["구슬동자"], [
    [4, 4.48, 4.6, 4.84, 4.96],
    [4.16, 4.64, 4.76, 5, 5.12],
    [4.32, 4.8, 4.92, 5.16, 5.28],
    [4.48, 4.96, 5.08, 5.32, 5.44],
    [4.64, 5.12, 5.24, 5.48, 5.6]
  ]),
  ...engravingTableEntries(["승부사"], [
    [1.68, 1.98, 2.06, 2.21, 2.28],
    [1.68, 1.98, 2.06, 2.21, 2.28],
    [1.89, 2.19, 2.27, 2.42, 2.49],
    [1.89, 2.19, 2.27, 2.42, 2.49],
    [2.1, 2.4, 2.48, 2.63, 2.7]
  ]),
  ...engravingTableEntries(["분쇄의주먹"], [
    [1.3, 1.45, 1.49, 1.56, 1.6],
    [1.38, 1.53, 1.57, 1.64, 1.68],
    [1.45, 1.6, 1.64, 1.71, 1.75],
    [1.53, 1.68, 1.72, 1.79, 1.83],
    [1.6, 1.75, 1.79, 1.86, 1.9]
  ])
]);

function valueOf(source, keys, fallback = "") {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }

  return fallback;
}

function listOf(source, keys) {
  const value = valueOf(source, keys, []);

  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace(/,/g, ""));

  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const unit = 10 ** digits;
  return Math.round((value + Number.EPSILON) * unit) / unit;
}

function floorDisplay(value) {
  return Number.isFinite(value) ? Math.floor(value) : null;
}

function cleanText(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean).join(" ");
  }

  return stripMarkup(value)
    .replace(/\|\|/g, " ")
    .replace(/\\r|\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectText(value, output = []) {
  if (!value) {
    return output;
  }

  if (typeof value === "string") {
    const tooltip = parseTooltip(value);

    if (tooltip) {
      return collectText(tooltip, output);
    }

    splitTooltipLines(value).map(cleanText).filter(Boolean).forEach((line) => output.push(line));
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output));
    return output;
  }

  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectText(item, output));
  }

  return output;
}

function statEntry(profile, type) {
  return listOf(profile, ["Stats", "stats"]).find((stat) => valueOf(stat, ["Type", "type"], "") === type) || null;
}

function profileStatNumber(profile, type) {
  return toNumber(valueOf(statEntry(profile, type), ["Value", "value"], 0));
}

function parseOfficialCombatPower(profile) {
  const value = toNumber(valueOf(profile, ["CombatPower", "combatPower"], 0));

  return value > 0 ? value : null;
}

function parseParadisePower(paradiseOrb) {
  const source = valueOf(paradiseOrb, ["MaxParadisePower", "maxParadisePower"], null);
  const value = toNumber(valueOf(source, ["Value", "value"], 0));

  if (value <= 0) {
    return null;
  }

  return {
    Value: value,
    Text: valueOf(source, ["Text", "text"], ""),
    EffectName: valueOf(paradiseOrb, ["EffectName", "effectName"], ""),
    EffectRole: valueOf(paradiseOrb, ["EffectRole", "effectRole"], "unknown"),
    SourceName: valueOf(paradiseOrb, ["Name", "name"], "보주")
  };
}

function paradiseOrbFactor(paradisePower) {
  if (!paradisePower) {
    return null;
  }

  const role = valueOf(paradisePower, ["EffectRole", "effectRole"], "unknown");
  const rule = PARADISE_ORB_COMBAT_POWER_RULES[role];

  if (!rule) {
    return null;
  }

  const value = toNumber(valueOf(paradisePower, ["Value", "value"], 0));
  const basisPoints = rule.baseBasisPoints + rule.paradiseBasisPoints * value / PARADISE_POWER_REFERENCE;

  return {
    Id: "paradise-orb",
    Category: "paradiseOrb",
    Label: rule.label,
    Percent: basisPoints / 100,
    ParadisePower: value,
    EffectName: valueOf(paradisePower, ["EffectName", "effectName"], ""),
    BasisPoints: round(basisPoints, 5),
    Confidence: "low"
  };
}

function parseAttackBreakdown(profile) {
  const attack = statEntry(profile, "공격력");
  const tooltip = cleanText(valueOf(attack, ["Tooltip", "tooltip"], ""));
  const basicAttackMatch = tooltip.match(/기본 공격력(?:은)?\s*(?<value>[\d,]+)/);
  const attackIncreaseMatch = tooltip.match(/공격력 증감 효과로 공격력이\s*(?<value>[\d,]+)\s*증가/);
  const profileAttackPower = toNumber(valueOf(attack, ["Value", "value"], 0));
  const basicAttackPower = toNumber(basicAttackMatch?.groups?.value, 0);
  const attackIncreasePower = toNumber(attackIncreaseMatch?.groups?.value, 0);

  return {
    ProfileAttackPower: profileAttackPower || null,
    BasicAttackPower: basicAttackPower || null,
    AttackIncreasePower: attackIncreasePower || null,
    TooltipText: tooltip
  };
}

function collectBasicAttackPercentSources({ equipment, gems }) {
  const sources = [];

  listOf({ gems }, ["gems"]).forEach((gem) => {
    listOf(gem, ["AdditionalEffects", "additionalEffects"]).forEach((effect) => {
      const name = valueOf(effect, ["Name", "name"], "");
      const value = toNumber(valueOf(effect, ["Value", "value"], 0));

      if (name === "기본 공격력" && value > 0) {
        sources.push({
          SourceType: "gem",
          SourceName: valueOf(gem, ["Name", "name"], "보석"),
          Percent: value
        });
      }
    });
  });

  listOf({ equipment }, ["equipment"]).forEach((item) => {
    const abilityStone = valueOf(item, ["AbilityStone", "abilityStone"], null);

    listOf(abilityStone, ["Effects", "effects"]).forEach((section) => {
      listOf(section, ["Lines", "lines"]).forEach((line) => {
        const match = cleanText(line).match(/^기본 공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
        const value = toNumber(match?.groups?.value, 0);

        if (value > 0) {
          sources.push({
            SourceType: "abilityStone",
            SourceName: valueOf(item, ["Name", "name"], "어빌리티 스톤"),
            Percent: value
          });
        }
      });
    });
  });

  return sources;
}

function collectWeaponPowerPercentSources({ equipment, arkPassive }) {
  const sources = [];
  const enlightenmentProgress = parseRankLevel(valueOf(pointByName(arkPassive, "깨달음"), ["Description", "description"], ""));

  if (enlightenmentProgress.level > 0) {
    sources.push({
      SourceType: "arkPassiveKarma",
      SourceName: "깨달음 카르마 레벨",
      Percent: enlightenmentProgress.level * 0.1,
      Level: enlightenmentProgress.level
    });
  }

  listOf({ equipment }, ["equipment"]).forEach((item) => {
    const itemType = valueOf(item, ["Type", "type"], "");
    const itemName = valueOf(item, ["Name", "name"], itemType || "장비");

    listOf(item, ["DetailSections", "detailSections"]).forEach((section) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/연마|팔찌 효과/.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line) => {
        const text = cleanText(line).replace(/^(상|중|하)\s+/, "");
        const match = text.match(/^무기 공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
        const percent = toNumber(match?.groups?.value, 0);

        if (percent > 0) {
          sources.push({
            SourceType: "equipment",
            SourceName: itemName,
            ItemType: itemType,
            Percent: percent,
            Text: text
          });
        }
      });
    });
  });

  return sources;
}

function collectFlatWeaponPowerSources({ equipment }) {
  const sources = [];

  listOf({ equipment }, ["equipment"]).forEach((item) => {
    const itemType = valueOf(item, ["Type", "type"], "");
    const itemName = valueOf(item, ["Name", "name"], itemType || "장비");

    if (itemType !== "팔찌") {
      return;
    }

    listOf(item, ["DetailSections", "detailSections"]).forEach((section) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/팔찌 효과/.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line) => {
        const text = cleanText(line).replace(/^(상|중|하)\s+/, "");
        const match = text.match(/^무기\s*공격력\s*\+?\s*(?<value>\d[\d,]*)\b(?!\s*(?:\.\d+)?\s*%)/);
        const value = toNumber(match?.groups?.value, 0);

        if (value > 0) {
          sources.push({
            SourceType: "equipment",
            SourceName: itemName,
            ItemType: itemType,
            Value: value,
            Text: text
          });
        }
      });
    });
  });

  return sources;
}

function equipmentAttackFormula(equipment, weaponPowerPercent = 0, flatWeaponPower = 0) {
  const mainStat = listOf({ equipment }, ["equipment"]).reduce((total, item) => {
    return total + toNumber(valueOf(item, ["MainStatValue", "mainStatValue"], 0));
  }, 0);
  const weapon = listOf({ equipment }, ["equipment"]).find((item) => valueOf(item, ["Type", "type"], "") === "무기");
  const weaponStats = valueOf(weapon, ["WeaponStats", "weaponStats"], null);
  const weaponPowerSource = valueOf(weaponStats, ["WeaponPower", "weaponPower"], null);
  const weaponPower = toNumber(valueOf(weaponPowerSource, ["Value", "value"], 0));
  const weaponPowerBeforePercent = weaponPower > 0
    ? weaponPower + flatWeaponPower
    : 0;
  const effectiveWeaponPower = weaponPowerBeforePercent > 0
    ? weaponPowerBeforePercent * (1 + weaponPowerPercent / 100)
    : 0;
  const formulaBaseAttackPower = mainStat > 0 && weaponPowerBeforePercent > 0
    ? Math.sqrt((mainStat * effectiveWeaponPower) / 6)
    : null;

  return {
    MainStatTotal: mainStat || null,
    WeaponPower: weaponPower || null,
    FlatWeaponPower: flatWeaponPower || null,
    WeaponPowerBeforePercent: weaponPowerBeforePercent || null,
    EffectiveWeaponPower: effectiveWeaponPower || null,
    WeaponName: valueOf(weapon, ["Name", "name"], ""),
    FormulaBaseAttackPower: formulaBaseAttackPower
  };
}

function buildAttackPowerModel({
  attackBreakdown,
  equipment,
  basicAttackPercent,
  basicAttackSources,
  flatWeaponPower,
  flatWeaponPowerSources,
  weaponPowerPercent,
  weaponPowerPercentSources
}) {
  const basicAttackMultiplier = 1 + basicAttackPercent / 100;
  const equipmentFormula = equipmentAttackFormula(equipment, weaponPowerPercent, flatWeaponPower);
  const profileBasicAttackPower = attackBreakdown.BasicAttackPower || null;
  const profileBaseAttackBeforeBasicPercent = profileBasicAttackPower
    ? profileBasicAttackPower / basicAttackMultiplier
    : null;
  const equipmentFormulaBaseAttackPower = equipmentFormula.FormulaBaseAttackPower;
  const selectedBaseAttackPower = profileBaseAttackBeforeBasicPercent || equipmentFormulaBaseAttackPower || null;
  const selectedBaseAttackSource = profileBaseAttackBeforeBasicPercent
    ? "profileBasicAttackReverse"
    : equipmentFormulaBaseAttackPower
      ? "equipmentFormula"
      : "missing";
  const selectedBasicAttackPower = profileBasicAttackPower || (
    selectedBaseAttackPower
      ? selectedBaseAttackPower * basicAttackMultiplier
      : null
  );
  const equipmentFormulaGap = profileBaseAttackBeforeBasicPercent && equipmentFormulaBaseAttackPower
    ? profileBaseAttackBeforeBasicPercent - equipmentFormulaBaseAttackPower
    : null;
  const equipmentFormulaGapPercent = equipmentFormulaGap && equipmentFormulaBaseAttackPower
    ? (equipmentFormulaGap / equipmentFormulaBaseAttackPower) * 100
    : null;
  const attackIncreasePercent = attackBreakdown.AttackIncreasePower && selectedBasicAttackPower
    ? (attackBreakdown.AttackIncreasePower / selectedBasicAttackPower) * 100
    : null;

  return {
    SelectedBaseAttackPower: selectedBaseAttackPower,
    SelectedBaseAttackSource: selectedBaseAttackSource,
    AttackBreakdown: {
      BasicAttackPercent: round(basicAttackPercent, 2),
      BasicAttackMultiplier: round(basicAttackMultiplier, 8),
      BasicAttackPercentSources: basicAttackSources,
      BaseAttackBeforeBasicPercent: selectedBaseAttackPower ? round(selectedBaseAttackPower, 2) : null,
      BaseAttackSource: selectedBaseAttackSource,
      ProfileBaseAttackBeforeBasicPercent: profileBaseAttackBeforeBasicPercent
        ? round(profileBaseAttackBeforeBasicPercent, 2)
        : null,
      SelectedBasicAttackPower: selectedBasicAttackPower ? round(selectedBasicAttackPower, 2) : null,
      EquipmentMainStatTotal: equipmentFormula.MainStatTotal,
      EquipmentWeaponPower: equipmentFormula.WeaponPower,
      EquipmentFlatWeaponPower: equipmentFormula.FlatWeaponPower,
      EquipmentFlatWeaponPowerSources: flatWeaponPowerSources,
      EquipmentWeaponPowerBeforePercent: equipmentFormula.WeaponPowerBeforePercent,
      EquipmentWeaponPowerPercent: round(weaponPowerPercent, 2),
      EquipmentWeaponPowerPercentSources: weaponPowerPercentSources,
      EquipmentEffectiveWeaponPower: equipmentFormula.EffectiveWeaponPower
        ? round(equipmentFormula.EffectiveWeaponPower, 2)
        : null,
      EquipmentEffectiveWeaponPowerDisplay: equipmentFormula.EffectiveWeaponPower
        ? floorDisplay(equipmentFormula.EffectiveWeaponPower)
        : null,
      EquipmentWeaponName: equipmentFormula.WeaponName,
      EquipmentFormulaBaseAttackPower: equipmentFormulaBaseAttackPower
        ? round(equipmentFormulaBaseAttackPower, 2)
        : null,
      EquipmentFormulaGap: equipmentFormulaGap ? round(equipmentFormulaGap, 2) : null,
      EquipmentFormulaGapPercent: equipmentFormulaGapPercent ? round(equipmentFormulaGapPercent, 2) : null,
      AttackIncreasePercent: attackIncreasePercent ? round(attackIncreasePercent, 2) : null
    }
  };
}

function gemPureCombatPowerFactors(gems) {
  return listOf({ gems }, ["gems"]).map((gem, index) => {
    const level = toNumber(valueOf(gem, ["Level", "level"], 0));
    const percent = GEM_PURE_COMBAT_POWER_FACTORS.get(level);

    if (!Number.isFinite(percent) || percent <= 0) {
      return null;
    }

    return {
      Id: `gem-pure-combat-power-${index}`,
      Category: "gems",
      Label: `${level}레벨 보석 순수 전투력`,
      Percent: percent,
      Level: level,
      SourceName: valueOf(gem, ["Name", "name"], "보석"),
      Confidence: "medium"
    };
  }).filter(Boolean);
}

function combatLevelFactor(profile) {
  const level = toNumber(valueOf(profile, ["CharacterLevel", "characterLevel"], 0));
  const rule = COMBAT_LEVEL_FACTORS.find((item) => level >= item.min);

  if (!rule) {
    return null;
  }

  return {
    Id: "combat-level",
    Category: "level",
    Label: rule.label,
    Percent: rule.percent,
    Confidence: "high"
  };
}

function weaponQualityAdditionalDamageSource(equipment) {
  const weapon = listOf({ equipment }, ["equipment"]).find((item) => valueOf(item, ["Type", "type"], "") === "무기");
  const weaponStats = valueOf(weapon, ["WeaponStats", "weaponStats"], null);
  const additionalDamage = valueOf(weaponStats, ["AdditionalDamage", "additionalDamage"], null);
  const percent = toNumber(valueOf(additionalDamage, ["Value", "value"], 0));

  if (percent <= 0) {
    return null;
  }

  return {
    SourceType: "weapon",
    SourceName: valueOf(weapon, ["Name", "name"], "무기"),
    Percent: percent,
    Text: valueOf(additionalDamage, ["Text", "text"], "무기 품질 추가 피해")
  };
}

function pointByName(arkPassive, name) {
  return listOf(arkPassive, ["Points", "points"]).find((point) => valueOf(point, ["Name", "name"], "") === name) || null;
}

function parseTierLevel(description) {
  const text = cleanText(description);
  const match = text.match(/(?<tier>\d+)\s*티어.*?Lv\.(?<level>\d+)/);
  const tier = toNumber(match?.groups?.tier, 0);
  const level = toNumber(match?.groups?.level, 0);

  return tier > 0 && level > 0 ? { tier, level } : null;
}

function parseArkPassiveEffect(description) {
  const text = cleanText(description);
  const match = text.match(/^(?<name>진화|깨달음|도약)\s*(?<tier>\d+)\s*티어\s*(?<nodeName>.+?)\s*Lv\.(?<level>\d+)/);

  if (!match?.groups) {
    return null;
  }

  return {
    Name: match.groups.name,
    Tier: toNumber(match.groups.tier, 0),
    NodeName: match.groups.nodeName.trim(),
    Level: toNumber(match.groups.level, 0)
  };
}

function inferredEvolutionScoredPoints(arkPassive) {
  const total = toNumber(valueOf(pointByName(arkPassive, "진화"), ["Value", "value"], 0));
  const tierOneLevels = listOf(arkPassive, ["Effects", "effects"])
    .filter((effect) => valueOf(effect, ["Name", "name"], "") === "진화")
    .map((effect) => parseTierLevel(valueOf(effect, ["Description", "description"], "")))
    .filter((entry) => entry?.tier === 1)
    .reduce((sum, entry) => sum + entry.level, 0);

  return Math.max(0, total - tierOneLevels);
}

function enlightenmentNodePointCost(effect) {
  if (KNOWN_ENLIGHTENMENT_SIDE_NODE_NAMES.has(effect.NodeName)) {
    return ENLIGHTENMENT_SIDE_NODE_POINT_COST;
  }

  if (effect.Tier === 1) {
    return ENLIGHTENMENT_TIER_ONE_MAIN_NODE_POINT_COST;
  }

  return effect.Tier >= 2 ? ENLIGHTENMENT_MAIN_NODE_POINT_COST : 0;
}

function inferredEnlightenmentPointEntry(arkPassive, rawPoints) {
  const effects = listOf(arkPassive, ["Effects", "effects"])
    .filter((effect) => valueOf(effect, ["Name", "name"], "") === "깨달음")
    .map((effect) => parseArkPassiveEffect(valueOf(effect, ["Description", "description"], "")))
    .filter((effect) => effect?.Name === "깨달음" && effect.Tier > 0 && effect.Level > 0);

  if (!effects.length) {
    const cappedPoints = Math.min(rawPoints, ENLIGHTENMENT_POINT_COMBAT_POWER_CAP);

    if (cappedPoints <= 0) {
      return null;
    }

    return {
      Id: "ark-enlightenment-points",
      Label: "깨달음 포인트",
      Percent: cappedPoints * ENLIGHTENMENT_POINT_COMBAT_POWER_PERCENT,
      Points: cappedPoints,
      RawPoints: rawPoints,
      Cap: ENLIGHTENMENT_POINT_COMBAT_POWER_CAP,
      PercentPerPoint: ENLIGHTENMENT_POINT_COMBAT_POWER_PERCENT,
      Basis: ENLIGHTENMENT_POINT_FORMULA_BASIS,
      Method: "rawPointsFallback",
      Confidence: "medium"
    };
  }

  const nodeEntries = effects.map((effect) => {
    const isSideNode = KNOWN_ENLIGHTENMENT_SIDE_NODE_NAMES.has(effect.NodeName);
    const pointCost = enlightenmentNodePointCost(effect);
    const points = effect.Level * pointCost;

    return {
      NodeName: effect.NodeName,
      Tier: effect.Tier,
      Level: effect.Level,
      NodeKind: isSideNode ? "side" : "main",
      PointCost: pointCost,
      Points: points
    };
  }).filter((entry) => entry.Points > 0);

  const preFourTierPoints = nodeEntries
    .filter((entry) => entry.NodeKind !== "side" && entry.Tier < 4)
    .reduce((total, entry) => total + entry.Points, 0);
  const fourTierPoints = nodeEntries
    .filter((entry) => entry.NodeKind !== "side" && entry.Tier >= 4)
    .reduce((total, entry) => total + entry.Points, 0);
  const detectedSidePoints = nodeEntries
    .filter((entry) => entry.NodeKind === "side")
    .reduce((total, entry) => total + entry.Points, 0);
  const fourTierActive = fourTierPoints > 0;
  const shouldAssumeFullSideNodes = detectedSidePoints === 0 && (fourTierActive || rawPoints >= ENLIGHTENMENT_POINT_COMBAT_POWER_CAP);
  const sidePoints = shouldAssumeFullSideNodes
    ? ENLIGHTENMENT_ASSUMED_FULL_SIDE_NODE_POINTS
    : detectedSidePoints;
  const parsedPoints = preFourTierPoints + fourTierPoints + sidePoints;
  const sourcePoints = rawPoints > 0
    ? rawPoints
    : parsedPoints;
  const effectivePoints = Math.min(sourcePoints, ENLIGHTENMENT_POINT_COMBAT_POWER_CAP);
  const effectivePreFourTierPoints = Math.max(0, Math.min(preFourTierPoints, effectivePoints - fourTierPoints - sidePoints));
  const percent = effectivePoints * ENLIGHTENMENT_POINT_COMBAT_POWER_PERCENT;

  return {
    Id: "ark-enlightenment-points",
    Label: "깨달음 노드 포인트",
    Percent: percent,
    Points: effectivePoints,
    RawPoints: rawPoints,
    ParsedPoints: parsedPoints,
    ParsedPreFourTierPoints: preFourTierPoints,
    PreFourTierPoints: effectivePreFourTierPoints,
    FourTierPoints: fourTierPoints,
    SidePoints: sidePoints,
    DetectedSidePoints: detectedSidePoints,
    AssumedFullSideNodes: shouldAssumeFullSideNodes,
    FourTierActive: fourTierActive,
    PercentPerPoint: ENLIGHTENMENT_POINT_COMBAT_POWER_PERCENT,
    Cap: ENLIGHTENMENT_POINT_COMBAT_POWER_CAP,
    FourTierActivationPercent: 0,
    Entries: nodeEntries,
    Basis: ENLIGHTENMENT_POINT_FORMULA_BASIS,
    Confidence: "medium"
  };
}

function parseRankLevel(description) {
  const text = cleanText(description);
  const match = text.match(/(?<rank>\d+)\s*랭크\s*(?<level>\d+)\s*레벨/);

  return {
    rank: toNumber(match?.groups?.rank, 0),
    level: toNumber(match?.groups?.level, 0)
  };
}

function arkPassiveFactors(arkPassive) {
  const factors = [];
  const selectedEffects = listOf(arkPassive, ["Effects", "effects"]);
  const hasSelectedEffects = selectedEffects.length > 0;
  const evolutionScoredPoints = inferredEvolutionScoredPoints(arkPassive);
  const enlightenmentRawPoints = toNumber(valueOf(pointByName(arkPassive, "깨달음"), ["Value", "value"], 0));
  const enlightenmentPointEntry = hasSelectedEffects
    ? inferredEnlightenmentPointEntry(arkPassive, enlightenmentRawPoints)
    : null;
  const leapPoints = toNumber(valueOf(pointByName(arkPassive, "도약"), ["Value", "value"], 0));
  const evolutionRankLevel = parseRankLevel(valueOf(pointByName(arkPassive, "진화"), ["Description", "description"], ""));
  const leapRankLevel = parseRankLevel(valueOf(pointByName(arkPassive, "도약"), ["Description", "description"], ""));

  if (hasSelectedEffects && evolutionScoredPoints > 0) {
    factors.push({
      Id: "ark-evolution-points",
      Category: "arkPassive",
      Label: "진화 2T+ 추정 사용 포인트",
      Percent: evolutionScoredPoints * EVOLUTION_POINT_COMBAT_POWER_PERCENT,
      Points: evolutionScoredPoints,
      Confidence: "low"
    });
  }

  if (enlightenmentPointEntry) {
    factors.push({
      ...enlightenmentPointEntry,
      Category: "arkPassive"
    });
  }

  if (hasSelectedEffects && leapPoints > 0) {
    factors.push({
      Id: "ark-leap-points",
      Category: "arkPassive",
      Label: "도약 포인트",
      Percent: leapPoints * 0.2,
      Points: leapPoints,
      Confidence: "medium"
    });
  }

  if (evolutionRankLevel.rank > 0) {
    factors.push({
      Id: "karma-evolution-rank",
      Category: "karma",
      Label: "진화 카르마 랭크",
      Percent: evolutionRankLevel.rank * 0.6,
      Rank: evolutionRankLevel.rank,
      Confidence: "medium"
    });
  }

  if (leapRankLevel.level > 0) {
    factors.push({
      Id: "karma-leap-level",
      Category: "karma",
      Label: "도약 카르마 레벨",
      Percent: leapRankLevel.level * 0.02,
      Level: leapRankLevel.level,
      Confidence: "medium"
    });
  }

  return factors;
}

function combatStatsFactor(profile) {
  const crit = profileStatNumber(profile, "치명");
  const specialization = profileStatNumber(profile, "특화");
  const swiftness = profileStatNumber(profile, "신속");
  const total = crit + specialization + swiftness;

  if (total <= 0) {
    return null;
  }

  return {
    Id: "combat-stats",
    Category: "combatStats",
    Label: "치명+특화+신속",
    Percent: total * 0.03,
    StatTotal: total,
    Confidence: "high"
  };
}

function engravingKey(name) {
  return cleanText(name).replace(/\s+/g, "");
}

function engravingTableEntries(keys, table) {
  return keys.map((key) => [key, table]);
}

function clampedInteger(value, min, max) {
  const number = Math.trunc(toNumber(value, min));

  return Math.min(max, Math.max(min, number));
}

function engravingBookCount(engraving) {
  const grade = cleanText(valueOf(engraving, ["Grade", "grade"], ""));
  const level = clampedInteger(valueOf(engraving, ["Level", "level"], 0), 0, 4);

  if (grade.includes("유물")) {
    return ENGRAVING_BOOK_COUNT_BY_LEVEL.get(level) ?? 0;
  }

  if (grade.includes("전설")) {
    return 0;
  }

  return ENGRAVING_BOOK_COUNT_BY_LEVEL.get(level) ?? 0;
}

function abilityStoneLevel(engraving) {
  return clampedInteger(valueOf(engraving, ["AbilityStoneLevel", "abilityStoneLevel"], 0), 0, 4);
}

function engravingCombatPower(engraving) {
  const key = engravingKey(valueOf(engraving, ["Name", "name"], ""));
  const table = ENGRAVING_COMBAT_POWER_TABLES.get(key);

  if (!table) {
    return null;
  }

  const bookCount = engravingBookCount(engraving);
  const bookRowIndex = ENGRAVING_BOOK_COUNTS.indexOf(bookCount);
  const stoneLevel = abilityStoneLevel(engraving);
  const percent = table[bookRowIndex]?.[stoneLevel];

  if (!Number.isFinite(percent)) {
    return null;
  }

  return {
    Percent: percent,
    BookCount: bookCount,
    AbilityStoneLevel: stoneLevel
  };
}

function engravingFactors(engravings) {
  return listOf({ engravings }, ["engravings"]).map((engraving, index) => {
    const name = cleanText(valueOf(engraving, ["Name", "name"], ""));
    const combatPower = engravingCombatPower(engraving);
    const percent = combatPower?.Percent;

    if (!name || !Number.isFinite(percent) || percent <= 0) {
      return null;
    }

    const grade = cleanText(valueOf(engraving, ["Grade", "grade"], ""));

    return {
      Id: `engraving-${index}-${engravingKey(name)}`,
      Category: "engraving",
      Label: `${name} 각인`,
      Percent: percent,
      Grade: grade,
      Level: valueOf(engraving, ["Level", "level"], null),
      EngravingBookCount: combatPower.BookCount,
      AbilityStoneLevel: combatPower.AbilityStoneLevel,
      Confidence: "medium"
    };
  }).filter(Boolean);
}

function factorFromPercentMap(map, value, fallback = null) {
  const roundedValue = round(value, 2);

  if (map.has(roundedValue)) {
    return map.get(roundedValue);
  }

  return fallback;
}

function accessoryFactorFromLine(itemType, line, key) {
  const text = cleanText(line).replace(/^(상|중|하)\s+/, "");
  const outgoingMatch = text.match(/^적에게 주는 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const additionalMatch = text.match(/^추가 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const attackPercentMatch = text.match(/^공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const attackFlatMatch = text.match(/^공격력\s*\+?\s*(?<value>\d+)$/);
  const critRateMatch = text.match(/^치명타 적중률\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const critDamageMatch = text.match(/^치명타 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);

  if (outgoingMatch) {
    const value = toNumber(outgoingMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: `${itemType} 적에게 주는 피해`,
      Percent: value,
      Confidence: "high",
      Text: text
    };
  }

  if (additionalMatch && itemType === "목걸이") {
    return null;
  }

  if (attackPercentMatch) {
    return null;
  }

  if (attackFlatMatch) {
    return null;
  }

  if (critRateMatch && itemType === "반지") {
    const value = toNumber(critRateMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: "반지 치명타 적중률",
      Percent: factorFromPercentMap(RING_CRIT_RATE_FACTORS, value, value * 0.7742),
      Confidence: "high",
      Text: text
    };
  }

  if (critDamageMatch && itemType === "반지") {
    const value = toNumber(critDamageMatch.groups.value, 0);

    return {
      Id: `accessory-${key}`,
      Category: "accessories",
      Label: "반지 치명타 피해",
      Percent: factorFromPercentMap(RING_CRIT_DAMAGE_FACTORS, value, value * 0.3),
      Confidence: "high",
      Text: text
    };
  }

  return null;
}

function accessoryFactors(equipment) {
  const factors = [];

  listOf({ equipment }, ["equipment"]).forEach((item, itemIndex) => {
    const itemType = valueOf(item, ["Type", "type"], "");

    if (!["목걸이", "귀걸이", "반지"].includes(itemType)) {
      return;
    }

    listOf(item, ["DetailSections", "detailSections"]).forEach((section, sectionIndex) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/연마/.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line, lineIndex) => {
        const factor = accessoryFactorFromLine(itemType, line, `${itemIndex}-${sectionIndex}-${lineIndex}`);

        if (factor) {
          factors.push(factor);
        }
      });
    });
  });

  return factors;
}

function collectAccessoryAttackPowerSources(equipment) {
  const sources = [];

  listOf({ equipment }, ["equipment"]).forEach((item) => {
    const itemType = valueOf(item, ["Type", "type"], "");
    const itemName = valueOf(item, ["Name", "name"], itemType || "장신구");

    if (!["목걸이", "귀걸이", "반지"].includes(itemType)) {
      return;
    }

    listOf(item, ["DetailSections", "detailSections"]).forEach((section) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/연마/.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line) => {
        const text = cleanText(line).replace(/^(상|중|하)\s+/, "");
        const percentMatch = text.match(/^공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
        const flatMatch = text.match(/^공격력\s*\+?\s*(?<value>\d+)$/);
        const percent = toNumber(percentMatch?.groups?.value, 0);
        const flatValue = toNumber(flatMatch?.groups?.value, 0);

        if (percent > 0) {
          sources.push({
            SourceType: "equipment",
            SourceName: itemName,
            ItemType: itemType,
            Percent: percent,
            Text: text
          });
        } else if (flatValue > 0) {
          sources.push({
            SourceType: "equipment",
            SourceName: itemName,
            ItemType: itemType,
            Percent: (flatValue / FLAT_ATTACK_REFERENCE) * 100,
            RawValue: flatValue,
            Text: text
          });
        }
      });
    });
  });

  return sources;
}

function collectAccessoryAdditionalDamageSources(equipment) {
  const sources = [];

  listOf({ equipment }, ["equipment"]).forEach((item) => {
    const itemType = valueOf(item, ["Type", "type"], "");
    const itemName = valueOf(item, ["Name", "name"], itemType || "장신구");

    if (!["목걸이", "귀걸이", "반지"].includes(itemType)) {
      return;
    }

    listOf(item, ["DetailSections", "detailSections"]).forEach((section) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/연마/.test(title)) {
        return;
      }

      listOf(section, ["Lines", "lines"]).forEach((line) => {
        const text = cleanText(line).replace(/^(상|중|하)\s+/, "");
        const match = text.match(/^추가 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
        const percent = toNumber(match?.groups?.value, 0);

        if (percent > 0) {
          sources.push({
            SourceType: "equipment",
            SourceName: itemName,
            ItemType: itemType,
            Percent: percent,
            Text: text
          });
        }
      });
    });
  });

  return sources;
}

function attackPowerFactor(equipment, arkGridGemEntries) {
  const sources = [
    ...collectAccessoryAttackPowerSources(equipment),
    ...arkGridGemEntries
      .filter((entry) => entry.Kind === "attackPower")
      .map((entry) => ({
        SourceType: "arkGridGem",
        SourceName: entry.SourceName,
        Percent: entry.RawPercent,
        Text: entry.Text
      }))
  ];
  const percent = sources.reduce((total, source) => total + source.Percent, 0);

  if (percent <= 0) {
    return null;
  }

  return {
    Id: "attack-power-bucket",
    Category: "attackPower",
    Label: "공격력 %",
    Percent: percent,
    Sources: sources,
    Confidence: "medium"
  };
}

function additionalDamageFactor(equipment, arkGridGemEntries) {
  const sources = [
    weaponQualityAdditionalDamageSource(equipment),
    ...collectAccessoryAdditionalDamageSources(equipment),
    ...arkGridGemEntries
      .filter((entry) => entry.Kind === "additionalDamage")
      .map((entry) => ({
        SourceType: "arkGridGem",
        SourceName: entry.SourceName,
        Percent: entry.RawPercent,
        Text: entry.Text
      }))
  ].filter(Boolean);

  if (sources.length) {
    sources.push({
      SourceType: "assumption",
      SourceName: "펫 목장",
      Percent: ASSUMED_PET_RANCH_ADDITIONAL_DAMAGE_PERCENT,
      Text: "펫 목장 추가 피해 +1.00%"
    });
  }

  const percent = sources.reduce((total, source) => total + source.Percent, 0);

  if (percent <= 0) {
    return null;
  }

  return {
    Id: "additional-damage-bucket",
    Category: "additionalDamage",
    Label: "추가 피해",
    Percent: percent,
    Sources: sources,
    Confidence: "medium"
  };
}

function braceletGradeIndex(value, table) {
  return table.values.findIndex((optionValue) => Math.abs(value - optionValue) <= BRACELET_VALUE_TOLERANCE);
}

function braceletFactorFromTable(tableKey, gradeValue, key, texts, extra = {}) {
  const table = BRACELET_OPTION_TABLES[tableKey];
  const gradeIndex = table ? braceletGradeIndex(gradeValue, table) : -1;

  if (gradeIndex < 0) {
    return null;
  }

  return {
    Id: `bracelet-${key}`,
    Category: "bracelet",
    Label: table.label,
    Percent: table.percents[gradeIndex],
    OptionGrade: BRACELET_GRADE_LABELS[gradeIndex],
    OptionValue: gradeValue,
    Confidence: "medium",
    Text: Array.from(new Set(texts)).join(" / "),
    ...extra
  };
}

function firstPercent(text, pattern) {
  const match = cleanText(text).match(pattern);

  return match?.groups?.value !== undefined ? toNumber(match.groups.value, 0) : 0;
}

function firstFlatNumber(text, pattern) {
  const match = cleanText(text).match(pattern);

  return match?.groups?.value !== undefined ? toNumber(match.groups.value, 0) : 0;
}

function braceletCriticalRateValue(text) {
  return firstPercent(text, /(?:치명타\s*적중률|치적)(?:이|을|가|\s*\+)?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
}

function braceletCriticalDamageValue(text) {
  return firstPercent(text, /(?:치명타\s*피해(?:량)?|치피)(?:이|가|\s*\+)?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
}

function braceletCriticalOutgoingValue(text) {
  return firstPercent(text, /치명타.*(?:적에게\s*주는\s*피해|적주피)(?:가|이|\s*\+)?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
}

function braceletAdditionalDamageValue(text) {
  return firstPercent(text, /추가\s*피해(?:가|이|\s*\+)?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
}

function braceletDemonDamageValue(text) {
  return firstPercent(text, /(?:악마|대악마).*피해(?:량)?(?:이|가|\s*\+)?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
}

function braceletAnyOutgoingValue(text) {
  return firstPercent(text, /(?:적에게\s*주는\s*피해(?:량)?|적주피)(?:가|이|\s*\+)?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
}

function braceletCooldownOutgoingValue(text) {
  if (!/재사용\s*대기\s*시간|쿨/.test(text)) {
    return 0;
  }

  return braceletAnyOutgoingValue(text);
}

function braceletStaggerOutgoingValue(text) {
  if (!/무력화/.test(text)) {
    return 0;
  }

  return braceletAnyOutgoingValue(text);
}

function braceletBackAttackOutgoingValue(text) {
  if (!/백어택/.test(text)) {
    return 0;
  }

  return braceletAnyOutgoingValue(text);
}

function braceletHeadAttackOutgoingValue(text) {
  if (!/헤드어택/.test(text)) {
    return 0;
  }

  return braceletAnyOutgoingValue(text);
}

function braceletNonDirectionalOutgoingValue(text) {
  if (!/방향성\s*공격이\s*아닌|타격의\s*대가|타대/.test(text)) {
    return 0;
  }

  return braceletAnyOutgoingValue(text);
}

function braceletGenericOutgoingValue(text) {
  if (/치명타|재사용\s*대기\s*시간|쿨|무력화|백어택|헤드어택|방향성\s*공격이\s*아닌|타격의\s*대가|타대/.test(text)) {
    return 0;
  }

  return braceletAnyOutgoingValue(text);
}

function braceletBaseOutgoingForStaggerValue(text) {
  if (/치명타|재사용\s*대기\s*시간|쿨|백어택|헤드어택|방향성\s*공격이\s*아닌|타격의\s*대가|타대/.test(text)) {
    return 0;
  }

  return braceletAnyOutgoingValue(text);
}

function braceletHitWeaponPowerBuffValue(text) {
  if (!/공격\s*적중|적중\s*시/.test(text) || !/공격\s*및\s*이동\s*속도|공이속/.test(text) || !/중첩/.test(text)) {
    return 0;
  }

  return firstFlatNumber(text, /무기\s*공격력(?:이|을|\s*\+)?\s*(?<value>\d[\d,]*)/);
}

function braceletHealthWeaponPowerBuffValue(text) {
  if (!/체력|생명력/.test(text) || !/50\s*%/.test(text)) {
    return 0;
  }

  const matches = Array.from(cleanText(text).matchAll(/무기\s*공격력(?:이|을|\s*\+)?\s*(?<value>\d[\d,]*)/g))
    .map((match) => toNumber(match.groups.value, 0))
    .filter((value) => value > 0);

  return matches.length > 1 ? matches[matches.length - 1] : 0;
}

function braceletStackWeaponPowerBuffValue(text) {
  if (!/30\s*초|30초/.test(text) || !/중첩/.test(text)) {
    return 0;
  }

  const matches = Array.from(cleanText(text).matchAll(/무기\s*공격력(?:이|을|\s*\+)?\s*(?<value>\d[\d,]*)/g))
    .map((match) => toNumber(match.groups.value, 0))
    .filter((value) => value > 0);

  return matches.length > 1 ? matches[matches.length - 1] : 0;
}

function buildBraceletFactorEntries(lines) {
  return lines.map((line, index) => ({
    index,
    text: cleanText(line)
  })).filter((entry) => entry.text);
}

function findBraceletEntry(entries, consumed, parser) {
  return entries.find((entry) => !consumed.has(entry.index) && parser(entry.text) > 0) || null;
}

function addBraceletComboFactor(factors, entries, consumed, tableKey, firstParser, secondParser, key) {
  const first = findBraceletEntry(entries, consumed, firstParser);

  if (!first) {
    return;
  }

  const second = entries.find((entry) => !consumed.has(entry.index) && secondParser(entry.text) > 0) || (
    secondParser(first.text) > 0 ? first : null
  );

  if (!second) {
    return;
  }

  const value = firstParser(first.text);
  const factor = braceletFactorFromTable(tableKey, value, key, [first.text, second.text]);

  if (!factor) {
    return;
  }

  factors.push(factor);
  consumed.add(first.index);
  consumed.add(second.index);
}

function addBraceletSingleFactors(factors, entries, consumed, tableKey, parser, keyPrefix) {
  entries.forEach((entry) => {
    if (consumed.has(entry.index)) {
      return;
    }

    const value = parser(entry.text);
    const factor = value > 0
      ? braceletFactorFromTable(tableKey, value, `${keyPrefix}-${entry.index}`, [entry.text])
      : null;

    if (!factor) {
      return;
    }

    factors.push(factor);
    consumed.add(entry.index);
  });
}

function braceletFactors(equipment) {
  const factors = [];
  const bracelets = listOf({ equipment }, ["equipment"]).filter((item) => valueOf(item, ["Type", "type"], "") === "팔찌");

  bracelets.forEach((bracelet, braceletIndex) => {
    listOf(bracelet, ["DetailSections", "detailSections"]).forEach((section, sectionIndex) => {
      const title = valueOf(section, ["Title", "title"], "");

      if (!/팔찌 효과/.test(title)) {
        return;
      }

      const entries = buildBraceletFactorEntries(listOf(section, ["Lines", "lines"]));
      const consumed = new Set();
      const keyPrefix = `${braceletIndex}-${sectionIndex}`;

      addBraceletComboFactor(factors, entries, consumed, "criticalRateCombo", braceletCriticalRateValue, braceletCriticalOutgoingValue, `${keyPrefix}-critical-rate-combo`);
      addBraceletComboFactor(factors, entries, consumed, "criticalDamageCombo", braceletCriticalDamageValue, braceletCriticalOutgoingValue, `${keyPrefix}-critical-damage-combo`);
      addBraceletComboFactor(factors, entries, consumed, "additionalDemonCombo", braceletAdditionalDamageValue, braceletDemonDamageValue, `${keyPrefix}-additional-demon-combo`);
      addBraceletComboFactor(factors, entries, consumed, "outgoingStaggerCombo", braceletBaseOutgoingForStaggerValue, braceletStaggerOutgoingValue, `${keyPrefix}-outgoing-stagger-combo`);

      addBraceletSingleFactors(factors, entries, consumed, "cooldownOutgoingCombo", braceletCooldownOutgoingValue, `${keyPrefix}-cooldown-outgoing`);
      addBraceletSingleFactors(factors, entries, consumed, "hitWeaponPowerBuff", braceletHitWeaponPowerBuffValue, `${keyPrefix}-hit-weapon-power`);
      addBraceletSingleFactors(factors, entries, consumed, "healthWeaponPowerBuff", braceletHealthWeaponPowerBuffValue, `${keyPrefix}-health-weapon-power`);
      addBraceletSingleFactors(factors, entries, consumed, "stackWeaponPowerBuff", braceletStackWeaponPowerBuffValue, `${keyPrefix}-stack-weapon-power`);
      addBraceletSingleFactors(factors, entries, consumed, "backAttackOutgoing", braceletBackAttackOutgoingValue, `${keyPrefix}-back-attack`);
      addBraceletSingleFactors(factors, entries, consumed, "headAttackOutgoing", braceletHeadAttackOutgoingValue, `${keyPrefix}-head-attack`);
      addBraceletSingleFactors(factors, entries, consumed, "nonDirectionalOutgoing", braceletNonDirectionalOutgoingValue, `${keyPrefix}-non-directional`);
      addBraceletSingleFactors(factors, entries, consumed, "outgoingDamage", braceletGenericOutgoingValue, `${keyPrefix}-outgoing`);
      addBraceletSingleFactors(factors, entries, consumed, "additionalDamage", braceletAdditionalDamageValue, `${keyPrefix}-additional`);
      addBraceletSingleFactors(factors, entries, consumed, "criticalRate", braceletCriticalRateValue, `${keyPrefix}-critical-rate`);
      addBraceletSingleFactors(factors, entries, consumed, "criticalDamage", braceletCriticalDamageValue, `${keyPrefix}-critical-damage`);
    });
  });

  return factors;
}

function cardEffectItems(cards) {
  const activeEffects = listOf(cards, ["ActiveEffects", "activeEffects"]);

  if (activeEffects.length) {
    return activeEffects;
  }

  return listOf(cards, ["Effects", "effects"]).flatMap((effect) => listOf(effect, ["Items", "items"]));
}

function cardDamageEffect(item) {
  const kind = valueOf(item, ["Kind", "kind"], "");
  const value = toNumber(valueOf(item, ["Value", "value"], 0));
  const description = cleanText(valueOf(item, ["Description", "description"], ""));
  const elementDamageMatch = description.match(/^(?<element>.+?)속성\s*피해\s*\+?(?<value>\d+(?:\.\d+)?)\s*%/);
  const outgoingDamageMatch = description.match(/^적에게\s*주는\s*피해\s*\+?(?<value>\d+(?:\.\d+)?)\s*%/);
  const parsedValue = toNumber(elementDamageMatch?.groups?.value || outgoingDamageMatch?.groups?.value || 0);

  if (["elementDamage", "outgoingDamage"].includes(kind) && value > 0) {
    return {
      Name: valueOf(item, ["Name", "name"], "카드 효과"),
      Kind: kind,
      Element: valueOf(item, ["Element", "element"], ""),
      Percent: value,
      Description: description
    };
  }

  if (parsedValue > 0) {
    return {
      Name: valueOf(item, ["Name", "name"], "카드 효과"),
      Kind: elementDamageMatch ? "elementDamage" : "outgoingDamage",
      Element: elementDamageMatch?.groups?.element || "",
      Percent: parsedValue,
      Description: description
    };
  }

  return null;
}

function cardDamageFactor(cards) {
  const sources = cardEffectItems(cards).map(cardDamageEffect).filter(Boolean);
  const percent = sources.reduce((total, source) => total + source.Percent, 0);

  if (percent <= 0) {
    return null;
  }

  return {
    Id: "card-damage",
    Category: "cards",
    Label: "카드 피해",
    Percent: percent,
    Sources: sources,
    Confidence: "high"
  };
}

function arkGridGradeKey(grade) {
  const text = cleanText(grade);

  if (text.includes("고대")) {
    return "ancient";
  }

  if (text.includes("유물")) {
    return "relic";
  }

  return "";
}

function arkGridCoreInfo(slot) {
  const name = cleanText(valueOf(slot, ["Name", "name"], ""));
  const typeMatch = name.match(/(?<alignment>질서|혼돈)의\s*(?<shape>해|달|별)/);
  const nameParts = name.split(":");
  const optionName = nameParts.length > 1 ? nameParts[nameParts.length - 1].trim() : "";

  if (!typeMatch?.groups) {
    return null;
  }

  return {
    name,
    alignment: typeMatch.groups.alignment,
    shape: typeMatch.groups.shape,
    optionName,
    point: toNumber(valueOf(slot, ["Point", "point"], 0)),
    grade: cleanText(valueOf(slot, ["Grade", "grade"], "")),
    gradeKey: arkGridGradeKey(valueOf(slot, ["Grade", "grade"], ""))
  };
}

function arkGridPointPercent(table, point) {
  const threshold = ARK_GRID_POINT_THRESHOLDS
    .filter((value) => point >= value)
    .at(-1);

  return threshold ? table?.[threshold] ?? null : null;
}

function arkGridOrderPercent(info) {
  const gradeFactors = ARK_GRID_ORDER_FACTORS[info.gradeKey];
  const shapeFactors = info.shape === "별" ? gradeFactors?.star : gradeFactors?.sunMoon;

  return arkGridPointPercent(shapeFactors, info.point);
}

function arkGridChaosPercent(info) {
  const basePercent = arkGridPointPercent(ARK_GRID_CHAOS_FACTORS[info.shape]?.[info.optionName], info.point);
  const ancientDirectBonus = info.gradeKey === "ancient"
    && info.point >= 17
    && (info.shape !== "별" || info.optionName === "공격");

  if (!Number.isFinite(basePercent)) {
    return null;
  }

  return ancientDirectBonus ? basePercent + 1 : basePercent;
}

function arkGridGemEffectKind(name, text) {
  if (name === "공격력" || /^공격력\s*\+/.test(text)) {
    return "attackPower";
  }

  if (name === "추가 피해" || /^추가\s*피해\s*\+/.test(text)) {
    return "additionalDamage";
  }

  if (name === "보스 피해" || /^보스\s*등급\s*이상\s*몬스터에게\s*주는\s*피해\s*\+/.test(text)) {
    return "bossDamage";
  }

  if (/^무기(?:\s*공격력)?$/.test(name) || /^무기\s*공격력\s*\+/.test(text)) {
    return "weaponPower";
  }

  return "";
}

function arkGridGemEffectPercent(kind, value) {
  if (kind === "bossDamage") {
    const base = 1 + ARK_GRID_BURNING_STRIKE_BOSS_DAMAGE_REFERENCE / 100;

    return ((1 + (ARK_GRID_BURNING_STRIKE_BOSS_DAMAGE_REFERENCE + value) / 100) / base - 1) * 100;
  }

  if (kind === "weaponPower") {
    return (Math.sqrt(1 + value / 100) - 1) * 100;
  }

  return value;
}

function arkGridGemEffectLabel(kind) {
  switch (kind) {
    case "attackPower":
      return "아크그리드 젬 공격력";
    case "additionalDamage":
      return "아크그리드 젬 추가 피해";
    case "bossDamage":
      return "아크그리드 젬 보스 피해";
    case "weaponPower":
      return "아크그리드 젬 무기 공격력";
    default:
      return "아크그리드 젬";
  }
}

function arkGridGemEntryFromText(text, key, sourceName = "아크그리드 젬") {
  const normalizedText = cleanText(text);
  const valueMatch = normalizedText.match(/(?<value>\d+(?:\.\d+)?)\s*%/);
  const value = toNumber(valueMatch?.groups?.value, 0);
  const kind = arkGridGemEffectKind("", normalizedText);

  if (!kind || value <= 0) {
    return null;
  }

  return {
    Id: `ark-grid-gem-${key}`,
    Kind: kind,
    SourceName: sourceName,
    RawPercent: value,
    Text: normalizedText,
    Confidence: kind === "weaponPower" ? "low" : "medium"
  };
}

function arkGridGemEntryFromEffect(effect, index) {
  const name = cleanText(valueOf(effect, ["Name", "name"], ""));
  const text = cleanText(valueOf(effect, ["Tooltip", "ToolTip", "tooltip"], ""));
  const valueMatch = text.match(/(?<value>\d+(?:\.\d+)?)\s*%/);
  const value = toNumber(valueMatch?.groups?.value, 0);
  const kind = arkGridGemEffectKind(name, text);

  if (!kind || value <= 0) {
    return null;
  }

  return {
    Id: `ark-grid-gem-effect-${index}`,
    Kind: kind,
    SourceName: name,
    RawPercent: value,
    Text: text,
    Confidence: kind === "weaponPower" ? "low" : "medium"
  };
}

function arkGridGemEntries(arkGrid) {
  const effects = listOf(arkGrid, ["Effects", "effects"]);

  if (effects.length) {
    return effects.map(arkGridGemEntryFromEffect).filter(Boolean);
  }

  return listOf(arkGrid, ["Slots", "slots"]).flatMap((slot, slotIndex) => {
    const slotName = valueOf(slot, ["Name", "name"], "아크그리드");

    return listOf(slot, ["Gems", "gems"])
      .filter((gem) => valueOf(gem, ["IsActive", "isActive"], true))
      .flatMap((gem, gemIndex) => collectText(valueOf(gem, ["Tooltip", "ToolTip", "tooltip"], ""))
        .map((line, lineIndex) => arkGridGemEntryFromText(
          line,
          `${slotIndex}-${gemIndex}-${lineIndex}`,
          `${slotName} 젬`
        ))
        .filter(Boolean));
  });
}

function arkGridGemFactors(arkGridGemEntryList) {
  return arkGridGemEntryList
    .filter((entry) => entry.Kind === "weaponPower" || entry.Kind === "bossDamage")
    .map((entry) => {
      const percent = arkGridGemEffectPercent(entry.Kind, entry.RawPercent);

      if (!Number.isFinite(percent) || percent <= 0) {
        return null;
      }

      return {
        Id: entry.Id,
        Category: "arkGridGem",
        Label: arkGridGemEffectLabel(entry.Kind),
        Percent: round(percent, 5),
        SourceName: entry.SourceName,
        RawPercent: entry.RawPercent,
        Text: entry.Text,
        ...(entry.Kind === "bossDamage" ? { ExistingBossDamageReference: ARK_GRID_BURNING_STRIKE_BOSS_DAMAGE_REFERENCE } : {}),
        Confidence: entry.Confidence
      };
    })
    .filter(Boolean);
}

function arkGridFactors(arkGrid) {
  const coreFactors = listOf(arkGrid, ["Slots", "slots"])
    .map((slot, index) => {
      const info = arkGridCoreInfo(slot);

      if (!info) {
        return null;
      }

      const percent = info.alignment === "질서" ? arkGridOrderPercent(info) : arkGridChaosPercent(info);

      if (!Number.isFinite(percent) || percent <= 0) {
        return null;
      }

      return {
        Id: `ark-grid-core-${index}`,
        Category: "arkGrid",
        Label: `${info.grade} ${info.alignment} ${info.shape}${info.optionName ? ` ${info.optionName}` : ""}`,
        Percent: percent,
        Point: info.point,
        Confidence: info.alignment === "질서" ? "medium" : "low"
      };
    })
    .filter(Boolean);

  return coreFactors;
}

function normalizeFactor(factor) {
  const percent = toNumber(valueOf(factor, ["Percent", "percent"], 0));

  if (!Number.isFinite(percent) || percent === 0) {
    return null;
  }

  const multiplier = round(1 + percent / 100, 8);
  const appliesToEstimate = valueOf(factor, ["AppliesToEstimate", "appliesToEstimate"], true) !== false;

  return {
    ...factor,
    Percent: round(percent, 5),
    AppliesToEstimate: appliesToEstimate,
    Multiplier: multiplier,
    EstimateMultiplier: appliesToEstimate ? multiplier : 1
  };
}

function summarizeFactors(factors) {
  const groups = new Map();

  factors.forEach((factor) => {
    const category = factor.Category;
    const current = groups.get(category) || {
      Category: category,
      Count: 0,
      Multiplier: 1,
      EstimateMultiplier: 1,
      Percent: 0,
      Confidence: factor.Confidence
    };

    current.Count += 1;
    current.Multiplier *= factor.Multiplier;
    current.EstimateMultiplier *= factor.EstimateMultiplier;
    groups.set(category, current);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    Multiplier: round(group.Multiplier, 8),
    EstimateMultiplier: round(group.EstimateMultiplier, 8),
    Percent: round((group.Multiplier - 1) * 100, 2),
    EstimatePercent: round((group.EstimateMultiplier - 1) * 100, 2)
  }));
}

function buildMissingInputs({ baseAttackPower, baseAttackSource, arkPassive, arkGrid, paradisePower, engravings }) {
  const missing = [];

  if (!baseAttackPower) {
    missing.push("프로필 기본 공격력 툴팁/장비식 순수공 모두 없음. 공격력 기반 전투력 계산 불가.");
  } else if (baseAttackSource === "equipmentFormula") {
    missing.push("프로필 기본 공격력 툴팁 없음. 장비식 순수공 fallback 사용. 영구 스탯 전체를 못 담을 수 있음.");
  }

  if (!paradisePower) {
    missing.push("보주 시즌2 달성 최대 낙원력 없음. 원본 장비 보주 툴팁에서 추출 필요.");
  } else if (!PARADISE_ORB_COMBAT_POWER_RULES[valueOf(paradisePower, ["EffectRole", "effectRole"], "unknown")]) {
    missing.push("보주 낙원력 추출 완료. 공격형/보조형 분류 실패로 전투력 계수 미적용.");
  } else {
    missing.push("보주 낙원력 전투력 계수 적용. 공격형/보조형 분류는 보주 특수 효과 툴팁 기반.");
  }

  if (arkPassive) {
    missing.push("아크패시브 포인트는 진화/깨달음/도약을 별도 bucket으로 나눠 서로 곱함. 진화 점수는 1티어 특성 레벨을 뺀 추정치.");
    missing.push("깨달음 전투력 포인트는 100P cap, 포인트당 0.7%로 반영. 100P와 101P 모두 +70%.");
  }

  if (!listOf(arkGrid, ["Slots", "slots"]).length) {
    missing.push("아크그리드 코어 정보를 찾지 못함.");
  } else {
    missing.push("아크그리드 코어는 질서/혼돈 10/14/17/18/19/20P 표 반영. 젬 공격력/추가 피해/보스 피해는 같은 이름 bucket에 합산하고, 젬 무기 공격력은 별도 근사 계수로 반영.");
  }

  if (listOf({ engravings }, ["engravings"]).length) {
    missing.push("각인은 유각 진행도와 어빌리티 스톤 레벨을 함께 반영한 딜러 전투력 계수표 기반. 스톤 기본 공격력%는 baseAttack bucket에 합산.");
    missing.push("전설 각인 또는 유각 미진행 각인은 유각 0장 행으로 반영.");
  } else {
    missing.push("각인 정보 없음. 각인 전투력 계수 미적용.");
  }

  missing.push("진화 첫줄 스탯 포인트는 제외하고 2T-4T 사용 포인트만 포인트당 0.75%로 반영.");
  missing.push("일반 스킬 보석은 기본공%와 별도 4티어 레벨별 순수 전투력 계수를 함께 반영.");
  missing.push("팔찌 특수 옵션은 상/중/하 전투력 계수표 기반으로 반영. 전투특성/도약/기본 무기공격력은 앞선 항목과 중복 계산하지 않음.");

  return missing;
}

export function buildCombatPowerAnalysis({
  profile = {},
  equipment = [],
  paradiseOrb = null,
  arkPassive = {},
  arkGrid = {},
  cards = {},
  engravings = [],
  gems = []
} = {}) {
  const officialCombatPower = parseOfficialCombatPower(profile);
  const paradisePower = parseParadisePower(paradiseOrb);
  const attackBreakdown = parseAttackBreakdown(profile);
  const basicAttackSources = collectBasicAttackPercentSources({ equipment, gems });
  const basicAttackPercent = basicAttackSources.reduce((total, source) => total + source.Percent, 0);
  const flatWeaponPowerSources = collectFlatWeaponPowerSources({ equipment });
  const flatWeaponPower = flatWeaponPowerSources.reduce((total, source) => total + source.Value, 0);
  const weaponPowerPercentSources = collectWeaponPowerPercentSources({ equipment, arkPassive });
  const weaponPowerPercent = weaponPowerPercentSources.reduce((total, source) => total + source.Percent, 0);
  const arkGridGemEntryList = arkGridGemEntries(arkGrid);
  const attackModel = buildAttackPowerModel({
    attackBreakdown,
    equipment,
    basicAttackPercent,
    basicAttackSources,
    flatWeaponPower,
    flatWeaponPowerSources,
    weaponPowerPercent,
    weaponPowerPercentSources
  });
  const baseAttackBeforeBasicPercent = attackModel.SelectedBaseAttackPower;
  const factors = [
    basicAttackPercent > 0
      ? {
          Id: "basic-attack-percent",
          Category: "baseAttack",
          Label: "기본 공격력 %",
          Percent: basicAttackPercent,
          Sources: basicAttackSources,
          Confidence: "medium"
        }
      : null,
    combatLevelFactor(profile),
    attackPowerFactor(equipment, arkGridGemEntryList),
    additionalDamageFactor(equipment, arkGridGemEntryList),
    ...gemPureCombatPowerFactors(gems),
    ...arkPassiveFactors(arkPassive),
    combatStatsFactor(profile),
    ...engravingFactors(engravings),
    cardDamageFactor(cards),
    paradiseOrbFactor(paradisePower),
    ...accessoryFactors(equipment),
    ...braceletFactors(equipment),
    ...arkGridFactors(arkGrid),
    ...arkGridGemFactors(arkGridGemEntryList)
  ].map(normalizeFactor).filter(Boolean);
  const knownFactorMultiplier = factors.reduce((product, factor) => product * factor.EstimateMultiplier, 1);
  const effectiveCoefficient = SOURCE_BASE_COEFFICIENT * IN_GAME_DISPLAY_SCALE;
  const baseScore = baseAttackBeforeBasicPercent ? baseAttackBeforeBasicPercent * effectiveCoefficient : null;
  const formulaEstimate = baseScore ? baseScore * knownFactorMultiplier : null;
  const officialCombatPowerFloor = floorDisplay(officialCombatPower);
  const formulaEstimateFloor = floorDisplay(formulaEstimate);
  const calibrationRatio = officialCombatPower && formulaEstimate ? officialCombatPower / formulaEstimate : null;
  const calibratedEstimate = formulaEstimate && calibrationRatio ? formulaEstimate * calibrationRatio : null;

  return {
    Status: baseAttackBeforeBasicPercent ? "partial" : "unavailable",
    OfficialCombatPower: officialCombatPower,
    OfficialCombatPowerFloor: officialCombatPowerFloor,
    ParadisePower: paradisePower,
    AttackBreakdown: {
      ...attackBreakdown,
      ...attackModel.AttackBreakdown
    },
    Formula: {
      SourceBaseCoefficient: SOURCE_BASE_COEFFICIENT,
      InGameDisplayScale: IN_GAME_DISPLAY_SCALE,
      EffectiveCoefficient: effectiveCoefficient,
      BaseScore: baseScore ? round(baseScore, 2) : null,
      KnownFactorMultiplier: round(knownFactorMultiplier, 8),
      Estimate: formulaEstimate ? round(formulaEstimate, 2) : null,
      EstimateFloor: formulaEstimateFloor,
      DeltaFromOfficial: officialCombatPower && formulaEstimate ? round(formulaEstimate - officialCombatPower, 2) : null,
      DeltaFromOfficialPercent: officialCombatPower && formulaEstimate
        ? round(((formulaEstimate - officialCombatPower) / officialCombatPower) * 100, 2)
        : null,
      DeltaFromOfficialFloor: officialCombatPowerFloor !== null && formulaEstimateFloor !== null
        ? formulaEstimateFloor - officialCombatPowerFloor
        : null,
      CalibrationRatio: calibrationRatio ? round(calibrationRatio, 6) : null,
      CalibratedEstimate: calibratedEstimate ? round(calibratedEstimate, 2) : null
    },
    Factors: factors,
    CategorySummary: summarizeFactors(factors),
    MissingInputs: buildMissingInputs({
      baseAttackPower: baseAttackBeforeBasicPercent,
      baseAttackSource: attackModel.SelectedBaseAttackSource,
      arkPassive,
      arkGrid,
      paradisePower,
      engravings
    })
  };
}
