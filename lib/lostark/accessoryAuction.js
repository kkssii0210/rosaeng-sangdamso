export const ACCESSORY_AUCTION_CATEGORIES = [
  {
    type: "목걸이",
    categoryCode: 200010,
    maxEnlightenmentPoint: 13,
    minQualityForMaxEnlightenment: 90
  },
  {
    type: "귀걸이",
    categoryCode: 200020,
    maxEnlightenmentPoint: 9,
    minQualityForMaxEnlightenment: 90
  },
  {
    type: "반지",
    categoryCode: 200030,
    maxEnlightenmentPoint: 9,
    minQualityForMaxEnlightenment: 90
  }
];

const numberFormatter = new Intl.NumberFormat("ko-KR");
const MAIN_STAT_NAMES = new Set(["힘", "민첩", "지능"]);
const COMBAT_STAT_NAMES = new Set(["치명", "특화", "신속"]);
const REFINEMENT_FIRST_OPTION = 7;
const REFINEMENT_SEARCH_RULES = [
  {
    type: "목걸이",
    secondOption: 42,
    name: "적에게 주는 피해",
    isPercentage: true,
    values: [24, 30, 37, 54, 55, 69, 84, 90, 115, 120, 140, 200],
    pattern: /^적에게 주는 피해(?:\s*증가)?\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/
  },
  {
    type: "목걸이",
    secondOption: 41,
    name: "추가 피해",
    isPercentage: true,
    values: [31, 39, 48, 70, 90, 109, 117, 150, 160, 182, 260],
    pattern: /^추가 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/
  },
  {
    type: "귀걸이",
    secondOption: 45,
    name: "공격력",
    isPercentage: true,
    values: [19, 24, 29, 40, 42, 54, 66, 70, 89, 95, 109, 155],
    pattern: /^공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/
  },
  {
    type: "귀걸이",
    secondOption: 46,
    name: "무기 공격력",
    isPercentage: true,
    values: [36, 46, 56, 80, 82, 104, 126, 136, 172, 180, 210, 300],
    pattern: /^무기 공격력\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/
  },
  {
    type: "반지",
    secondOption: 49,
    name: "치명타 적중률",
    isPercentage: true,
    values: [19, 24, 29, 40, 42, 54, 66, 70, 89, 95, 109, 155],
    pattern: /^치명타 적중률\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/
  },
  {
    type: "반지",
    secondOption: 50,
    name: "치명타 피해",
    isPercentage: true,
    values: [48, 61, 74, 109, 110, 138, 170, 179, 230, 240, 282, 400],
    pattern: /^치명타 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/
  },
  {
    secondOption: 53,
    name: "공격력",
    isPercentage: false,
    values: [9, 14, 19, 24, 33, 40, 61, 68, 80, 118, 195, 390],
    pattern: /^공격력\s*\+?\s*(?<value>\d+)$/
  },
  {
    secondOption: 54,
    name: "무기 공격력",
    isPercentage: false,
    values: [23, 32, 50, 57, 75, 105, 147, 155, 195, 285, 480, 960],
    pattern: /^무기 공격력\s*\+?\s*(?<value>\d+)$/
  }
];

function getCategory(type) {
  return ACCESSORY_AUCTION_CATEGORIES.find((category) => category.type === type);
}

function formatNumber(value) {
  return numberFormatter.format(value ?? 0);
}

function formatStatLine(option) {
  return `${option.OptionName} +${formatNumber(option.Value)}`;
}

function formatOptionValue(option) {
  if (option.IsValuePercentage) {
    return `${Number(option.Value ?? 0).toFixed(2)}%`;
  }

  return formatNumber(option.Value);
}

function normalizeRefinementOptionName(optionName) {
  const name = String(optionName || "").replace(/\s+/g, " ").trim();

  if (name === "적에게 주는 피해 증가") {
    return "적에게 주는 피해";
  }

  return name;
}

function formatRefinementLine(option) {
  return `${normalizeRefinementOptionName(option.OptionName)} +${formatOptionValue(option)}`;
}

function optionList(accessory) {
  return Array.isArray(accessory.Options) ? accessory.Options : [];
}

function optionValue(accessory, type) {
  return optionList(accessory).find((option) => option.Type === type);
}

function arkPassiveOption(accessory) {
  return optionList(accessory).find((option) => (
    (option.Type === "ARK_PASSIVE" || option.Type === "ARK_PASSIVE_POINT") &&
    option.OptionName === "깨달음"
  ));
}

function mainStatOption(accessory) {
  return optionList(accessory).find((option) => option.Type === "STAT" && MAIN_STAT_NAMES.has(option.OptionName));
}

function combatStatOptions(accessory) {
  return optionList(accessory).filter((option) => option.Type === "STAT" && COMBAT_STAT_NAMES.has(option.OptionName));
}

function optionsByType(accessory, type) {
  return optionList(accessory).filter((option) => option.Type === type);
}

function normalizeRefinementLine(line) {
  return String(line || "").trim().replace(/^(상|중|하)\s+/, "");
}

function refinementLineText(line) {
  return normalizeRefinementLine(line).replace(/\s+/g, " ").trim();
}

function searchValueFromLineValue(value, isPercentage) {
  if (isPercentage) {
    return Math.round(value * 100);
  }

  return Math.round(value);
}

function formatSearchValue(value, isPercentage) {
  if (isPercentage) {
    return `${(value / 100).toFixed(2)}%`;
  }

  return formatNumber(value);
}

function refinementSearchRuleForLine(type, line) {
  const text = refinementLineText(line);

  for (const rule of REFINEMENT_SEARCH_RULES) {
    if (rule.type && rule.type !== type) {
      continue;
    }

    const match = text.match(rule.pattern);
    const value = Number(match?.groups?.value);

    if (match && Number.isFinite(value)) {
      return {
        rule,
        value: searchValueFromLineValue(value, rule.isPercentage)
      };
    }
  }

  return null;
}

function refinementLinesOf(accessory) {
  return (Array.isArray(accessory?.DetailSections) ? accessory.DetailSections : [])
    .filter((section) => /연마/.test(String(section?.title ?? section?.Title ?? "")))
    .flatMap((section) => Array.isArray(section?.lines) ? section.lines : section?.Lines ?? []);
}

function parseBasicStatLine(line) {
  const match = String(line || "").match(/^(?<name>힘|민첩|지능|치명|특화|신속)\s*\+?\s*(?<value>[\d,]+)/);

  if (!match?.groups) {
    return null;
  }

  return {
    name: match.groups.name,
    value: match.groups.value
  };
}

export function getAccessoryEnlightenmentThreshold(type) {
  return getCategory(type)?.minQualityForMaxEnlightenment;
}

export function buildAccessoryRefinementSearchOptions(accessory) {
  const type = accessory?.Type;
  const seen = new Set();
  const searchOptions = [];

  for (const line of refinementLinesOf(accessory)) {
    const matched = refinementSearchRuleForLine(type, line);

    if (!matched || seen.has(matched.rule.secondOption)) {
      continue;
    }

    seen.add(matched.rule.secondOption);
    searchOptions.push({
      FirstOption: REFINEMENT_FIRST_OPTION,
      SecondOption: matched.rule.secondOption,
      MinValue: matched.value,
      MaxValue: Math.max(...matched.rule.values),
      Label: `${matched.rule.name} ${formatSearchValue(matched.value, matched.rule.isPercentage)} 이상`
    });
  }

  return searchOptions;
}

export function normalizeAuctionAccessoryItem(item, type) {
  const statOption = mainStatOption(item);
  const combatStats = combatStatOptions(item);
  const refinementOptions = optionsByType(item, "ACCESSORY_UPGRADE");
  const enlightenmentOption = arkPassiveOption(item);

  const detailSections = [];
  const basicEffectLines = [
    statOption ? formatStatLine(statOption) : null,
    ...combatStats.map(formatStatLine)
  ].filter(Boolean);

  if (basicEffectLines.length > 0) {
    detailSections.push({
      title: "기본 효과",
      lines: basicEffectLines
    });
  }

  if (refinementOptions.length > 0) {
    detailSections.push({
      title: "연마 효과",
      lines: refinementOptions.map(formatRefinementLine)
    });
  }

  if (enlightenmentOption) {
    detailSections.push({
      title: "아크 패시브 포인트 효과",
      lines: [formatStatLine(enlightenmentOption)]
    });
  }

  return {
    Type: type,
    Name: item.Name,
    Icon: item.Icon,
    Grade: item.Grade,
    Quality: item.GradeQuality,
    Tier: item.Tier,
    ItemLevel: item.Level,
    BuyPrice: item.AuctionInfo?.BuyPrice,
    UpgradeLevel: item.AuctionInfo?.UpgradeLevel,
    TradeRemainCount: item.AuctionInfo?.TradeAllowCount,
    EndDate: item.AuctionInfo?.EndDate,
    MainStatValue: statOption?.Value,
    EnlightenmentPoint: enlightenmentOption?.Value,
    DetailSections: detailSections
  };
}

export function isEligibleAccessoryCandidate(accessory) {
  const category = getCategory(accessory.Type);

  if (!category || accessory.Grade !== "고대" || accessory.Tier !== 4) {
    return { eligible: false, reason: "UNSUPPORTED_ACCESSORY" };
  }

  if (accessory.UpgradeLevel !== 3) {
    return { eligible: false, reason: "BELOW_REQUIRED_UPGRADE_LEVEL" };
  }

  if (
    !Number.isFinite(accessory.EnlightenmentPoint) ||
    accessory.EnlightenmentPoint < category.maxEnlightenmentPoint
  ) {
    return { eligible: false, reason: "BELOW_MAX_ENLIGHTENMENT" };
  }

  if (!Number.isFinite(accessory.BuyPrice) || accessory.BuyPrice <= 0) {
    return { eligible: false, reason: "MISSING_BUY_PRICE" };
  }

  return { eligible: true, reason: "" };
}

export function buildAccessoryFingerprint(accessory) {
  const basicLine = accessory.DetailSections?.find((section) => section.title === "기본 효과")?.lines?.[0];
  const enlightenmentLine = accessory.DetailSections?.find(
    (section) => section.title === "아크 패시브 포인트 효과"
  )?.lines?.[0];
  const refinementLines =
    accessory.DetailSections?.find((section) => section.title === "연마 효과")?.lines ?? [];
  const parts = [accessory.Type, accessory.Grade, `q${accessory.Quality}`];

  if (basicLine) {
    const [name] = basicLine.split(" +");
    parts.push(`stat:${name}:${formatNumber(accessory.MainStatValue)}`);
  }

  const combatStats = (accessory.DetailSections?.find((section) => section.title === "기본 효과")?.lines ?? [])
    .map(parseBasicStatLine)
    .filter((line) => line && COMBAT_STAT_NAMES.has(line.name))
    .sort((left, right) => left.name.localeCompare(right.name, "ko-KR"));

  for (const stat of combatStats) {
    parts.push(`combat:${stat.name}:${stat.value}`);
  }

  if (enlightenmentLine) {
    const [name] = enlightenmentLine.split(" +");
    parts.push(`ark:${name}:${formatNumber(accessory.EnlightenmentPoint)}`);
  }

  for (const line of refinementLines.map(normalizeRefinementLine).sort()) {
    const [name, valueText] = line.split(" +");
    parts.push(`refine:${name}:${valueText.replace("%", "")}`);
  }

  return parts.join("|");
}
