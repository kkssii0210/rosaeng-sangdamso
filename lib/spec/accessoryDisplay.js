const numberFormatter = new Intl.NumberFormat("ko-KR");

const MAIN_STAT_CLASS_MAP = new Map([
  ["데빌헌터", "민첩"],
  ["블래스터", "민첩"],
  ["호크아이", "민첩"],
  ["스카우터", "민첩"],
  ["건슬링어", "민첩"],
  ["블레이드", "민첩"],
  ["데모닉", "민첩"],
  ["리퍼", "민첩"],
  ["소울이터", "민첩"],
  ["바드", "지능"],
  ["서머너", "지능"],
  ["아르카나", "지능"],
  ["소서리스", "지능"],
  ["도화가", "지능"],
  ["기상술사", "지능"],
  ["환수사", "지능"]
]);

const MAIN_STAT_NAMES = new Set(["힘", "민첩", "지능"]);

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

function parseNumber(value) {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());

  return Number.isFinite(number) ? number : null;
}

function detailSections(accessory) {
  return listOf(accessory, ["DetailSections", "detailSections"]);
}

function sectionLines(accessory, titlePattern) {
  return detailSections(accessory)
    .filter((section) => titlePattern.test(String(valueOf(section, ["title", "Title"], ""))))
    .flatMap((section) => listOf(section, ["lines", "Lines"]));
}

function parseMainStatLine(line) {
  const match = String(line || "").match(/^(?<name>힘|민첩|지능)\s*\+?\s*(?<value>[\d,]+)/);
  const value = parseNumber(match?.groups?.value);

  if (!match || !Number.isFinite(value)) {
    return null;
  }

  return {
    name: match.groups.name,
    value
  };
}

function mainStatValueOf(accessory, mainStatName) {
  const basicLines = sectionLines(accessory, /기본 효과/);
  const exactLine = basicLines
    .map(parseMainStatLine)
    .find((line) => line?.name === mainStatName);

  if (exactLine) {
    return exactLine.value;
  }

  const directValue = parseNumber(valueOf(accessory, ["MainStatValue", "mainStatValue"], null));

  if (Number.isFinite(directValue)) {
    return directValue;
  }

  return basicLines.map(parseMainStatLine).find(Boolean)?.value ?? null;
}

export function getMainStatNameForClass(className) {
  return MAIN_STAT_CLASS_MAP.get(String(className || "").trim()) || "힘";
}

export function buildAccessoryDisplay({ accessory, mainStatName = "힘" } = {}) {
  const normalizedMainStatName = MAIN_STAT_NAMES.has(mainStatName) ? mainStatName : "힘";
  const mainStatValue = mainStatValueOf(accessory, normalizedMainStatName);
  const refinementLines = sectionLines(accessory, /연마/);

  return {
    MainStatLine: Number.isFinite(mainStatValue)
      ? `${normalizedMainStatName} +${numberFormatter.format(mainStatValue)}`
      : "",
    RefinementLines: refinementLines
  };
}
