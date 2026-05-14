export const EXCLUDED_EQUIPMENT_TYPES = new Set(["나침반", "부적", "보주"]);

const QUALITY_EQUIPMENT_TYPES = new Set(["무기", "투구", "상의", "하의", "장갑", "어깨", "목걸이", "귀걸이", "반지"]);
const DETAILED_EQUIPMENT_TYPES = new Set(["목걸이", "귀걸이", "반지", "팔찌"]);
const ABILITY_STONE_TYPE = "어빌리티 스톤";
const WEAPON_TYPE = "무기";
const PARADISE_ORB_TYPE = "보주";
const MAIN_STAT_PATTERN = /^(?<stat>힘|민첩|지능)\s*\+?\s*(?<value>[\d,]+)/;

export function parseTooltip(tooltip) {
  if (!tooltip) {
    return null;
  }

  try {
    return JSON.parse(tooltip);
  } catch {
    return null;
  }
}

export function stripMarkup(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function splitTooltipLines(value) {
  return stripMarkup(value).split("\n").filter(Boolean);
}

export function extractDetailSections(tooltip) {
  if (!tooltip) {
    return [];
  }

  return Object.values(tooltip)
    .filter((element) => element?.type === "ItemPartBox")
    .map((element) => {
      const title = stripMarkup(element.value?.Element_000 || "");
      const lines = splitTooltipLines(element.value?.Element_001 || "");

      return { title, lines };
    })
    .filter((section) => section.title && section.lines.length);
}

function extractIndentStringSections(tooltip) {
  if (!tooltip) {
    return [];
  }

  return Object.values(tooltip)
    .filter((element) => element?.type === "IndentStringGroup")
    .flatMap((element) => Object.values(element.value || {}))
    .map((group) => {
      const title = stripMarkup(group?.topStr || "");
      const content = group?.contentStr || {};
      const lines = Object.values(content)
        .flatMap((item) => splitTooltipLines(item?.contentStr || ""))
        .filter(Boolean);

      return { title, lines };
    })
    .filter((section) => section.title && section.lines.length);
}

function isGenericAbilityStoneTitle(title) {
  return /각인|효과|기본|추가|세공|보너스|어빌리티|스톤/.test(title);
}

function normalizeAbilityStoneName(name) {
  return String(name || "")
    .replace(/^\[|\]$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAbilityStoneEngravingLine(line, title) {
  const levelMatch = line.match(/^(?:\[(?<bracketName>[^\]]+)\]\s*)?(?<name>.+?)?\s*Lv\.(?<level>\d+)/i);

  if (levelMatch) {
    const fallbackName = isGenericAbilityStoneTitle(title) ? "" : title;
    const name = normalizeAbilityStoneName(levelMatch.groups?.bracketName || levelMatch.groups?.name || fallbackName);
    const level = Number(levelMatch.groups?.level);

    if (!name || name.includes("레벨 보너스") || !Number.isFinite(level)) {
      return null;
    }

    return {
      Name: name,
      Level: level,
      ValueText: `Lv.${level}`,
      IsPenalty: name.includes("감소")
    };
  }

  const activeMatch = line.match(/^(?:\[(?<bracketName>[^\]]+)\]\s*)?(?<name>.+?)?\s*활성도\s*(?<points>[+-]?\d+)/);

  if (!activeMatch) {
    return null;
  }

  const fallbackName = isGenericAbilityStoneTitle(title) ? "" : title;
  const name = normalizeAbilityStoneName(activeMatch.groups?.bracketName || activeMatch.groups?.name || fallbackName);
  const points = Number(activeMatch.groups?.points);

  if (!name || !Number.isFinite(points)) {
    return null;
  }

  return {
    Name: name,
    Points: points,
    ValueText: points > 0 ? `+${points}` : String(points),
    IsPenalty: name.includes("감소")
  };
}

function splitAbilityStoneEffectLine(line, title) {
  const bonusMatch = line.match(/^\[(?<title>[^\]]+)\]\s*(?<line>.+)$/);

  if (bonusMatch?.groups?.title?.includes("보너스")) {
    return {
      title: normalizeAbilityStoneName(bonusMatch.groups.title),
      line: bonusMatch.groups.line.trim()
    };
  }

  return { title, line };
}

function appendAbilityStoneEffectSection(sections, title, line) {
  const previousSection = sections[sections.length - 1];

  if (previousSection?.Title === title) {
    previousSection.Lines.push(line);
    return;
  }

  sections.push({
    Title: title,
    Lines: [line]
  });
}

function parseNumber(value) {
  const number = Number(String(value || "").replace(/,/g, ""));

  return Number.isFinite(number) ? number : null;
}

function parsePercent(value) {
  const number = Number(String(value || "").replace(/,/g, ""));

  return Number.isFinite(number) ? number : null;
}

function extractParadiseOrbEffectName(lines) {
  const effectLine = lines.find((line) => /^\[[^\]]+\]/.test(line));
  const match = effectLine?.match(/^\[(?<name>[^\]]+)\]/);

  return match?.groups?.name || "";
}

function classifyParadiseOrbRole(orb, effectName, lines) {
  const text = [orb?.Name, effectName, ...lines].filter(Boolean).join(" ");

  if (/투영|힐|회복|생명력|보호막|치유/.test(text)) {
    return "support";
  }

  if (/영험|신성|피해|공격|몬스터|대상/.test(text)) {
    return "attack";
  }

  return "unknown";
}

export function extractWeaponStats(tooltip) {
  const sections = extractDetailSections(tooltip);
  const weaponPowerLine = sections.flatMap((section) => section.lines).find((line) => /^무기 공격력/.test(line));
  const additionalDamageLine = sections.flatMap((section) => section.lines).find((line) => /^추가 피해/.test(line));
  const weaponPowerMatch = weaponPowerLine?.match(/^무기 공격력\s*\+?\s*(?<value>[\d,]+)/);
  const additionalDamageMatch = additionalDamageLine?.match(/^추가 피해\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const weaponPower = parseNumber(weaponPowerMatch?.groups?.value);
  const additionalDamage = parsePercent(additionalDamageMatch?.groups?.value);
  const stats = {};

  if (weaponPower !== null) {
    stats.WeaponPower = {
      Value: weaponPower,
      Text: weaponPowerLine
    };
  }

  if (additionalDamage !== null) {
    stats.AdditionalDamage = {
      Value: additionalDamage,
      Text: additionalDamageLine
    };
  }

  return Object.keys(stats).length ? stats : null;
}

function parseMainStatLine(line) {
  const match = String(line || "").match(MAIN_STAT_PATTERN);
  const value = parseNumber(match?.groups?.value);

  if (!match || value === null) {
    return null;
  }

  return {
    Stat: match.groups.stat,
    Value: value,
    Text: String(line).trim()
  };
}

export function extractMainStats(tooltip, type) {
  if (type === WEAPON_TYPE) {
    return null;
  }

  const mainStats = extractDetailSections(tooltip)
    .flatMap((section) => section.lines.map(parseMainStatLine))
    .filter(Boolean);

  if (!mainStats.length) {
    return null;
  }

  const totalsByStat = mainStats.reduce((totals, stat) => {
    totals[stat.Stat] = (totals[stat.Stat] || 0) + stat.Value;
    return totals;
  }, {});
  const mainStatValue = Math.max(...Object.values(totalsByStat));

  return {
    Stats: mainStats,
    Value: mainStatValue,
    Text: `주스탯 +${mainStatValue.toLocaleString("ko-KR")}`
  };
}

export function extractAbilityStoneInfo(tooltip) {
  const sections = [...extractDetailSections(tooltip), ...extractIndentStringSections(tooltip)];
  const engravings = [];
  const effectSections = [];

  for (const section of sections) {
    for (const line of section.lines) {
      const engraving = parseAbilityStoneEngravingLine(line, section.title);

      if (engraving) {
        engravings.push(engraving);
      } else {
        const effect = splitAbilityStoneEffectLine(line, section.title);
        appendAbilityStoneEffectSection(effectSections, effect.title, effect.line);
      }
    }
  }

  if (!engravings.length && !effectSections.length) {
    return null;
  }

  return {
    Engravings: engravings,
    Effects: effectSections
  };
}

export function extractParadiseOrbInfo(equipment = []) {
  const orb = Array.isArray(equipment)
    ? equipment.find((item) => item?.Type === PARADISE_ORB_TYPE)
    : null;

  if (!orb) {
    return null;
  }

  const tooltip = parseTooltip(orb.Tooltip);
  const detailSections = extractDetailSections(tooltip);
  const specialEffectSection = detailSections.find((section) => /특수 효과/.test(section.title));
  const specialEffectLines = specialEffectSection?.lines || [];
  const effectName = extractParadiseOrbEffectName(specialEffectLines);
  const paradisePowerLine = detailSections
    .flatMap((section) => section.lines)
    .find((line) => /달성\s*최대\s*낙원력/.test(line));
  const paradisePowerMatch = paradisePowerLine?.match(/(?:시즌\s*2\s*)?달성\s*최대\s*낙원력\s*[:：]\s*(?<value>[\d,]+)/);
  const paradisePower = parseNumber(paradisePowerMatch?.groups?.value);

  return {
    Type: orb.Type || "",
    Name: orb.Name || "",
    Icon: orb.Icon || "",
    Grade: orb.Grade || "",
    EffectName: effectName,
    EffectRole: classifyParadiseOrbRole(orb, effectName, specialEffectLines),
    DetailSections: detailSections,
    MaxParadisePower: paradisePower !== null
      ? {
          Value: paradisePower,
          Text: paradisePowerLine
        }
      : null
  };
}

export function normalizeEquipmentItem(item) {
  const tooltip = parseTooltip(item?.Tooltip);
  const titleValue = tooltip?.Element_001?.value || {};
  const type = item?.Type || "";
  const quality = typeof titleValue.qualityValue === "number" && titleValue.qualityValue >= 0 && QUALITY_EQUIPMENT_TYPES.has(type)
    ? titleValue.qualityValue
    : null;
  const abilityStone = type === ABILITY_STONE_TYPE ? extractAbilityStoneInfo(tooltip) : null;
  const weaponStats = type === WEAPON_TYPE ? extractWeaponStats(tooltip) : null;
  const mainStats = extractMainStats(tooltip, type);

  return {
    Type: item?.Type || "",
    Name: item?.Name || "",
    Icon: item?.Icon || "",
    Grade: item?.Grade || "",
    Quality: quality,
    ItemLevelText: stripMarkup(titleValue.leftStr2 || ""),
    DetailSections: DETAILED_EQUIPMENT_TYPES.has(type) ? extractDetailSections(tooltip) : [],
    ...(mainStats ? { MainStats: mainStats.Stats, MainStatValue: mainStats.Value, MainStatText: mainStats.Text } : {}),
    ...(weaponStats ? { WeaponStats: weaponStats } : {}),
    ...(abilityStone ? { AbilityStone: abilityStone } : {})
  };
}
