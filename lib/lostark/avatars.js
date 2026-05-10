import { extractDetailSections, parseTooltip } from "./equipment.js";

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

function parseAvatarStatEffect(line) {
  const match = String(line || "").match(/^(?<stat>힘|민첩|지능)\s*\+?\s*(?<value>\d+(?:\.\d+)?)\s*%/);
  const value = Number(match?.groups?.value);

  if (!match || !Number.isFinite(value)) {
    return null;
  }

  return {
    Stat: match.groups.stat,
    Value: value,
    Text: String(line).trim()
  };
}

export function normalizeAvatarItem(item) {
  const tooltip = parseTooltip(item?.Tooltip);
  const detailSections = extractDetailSections(tooltip);
  const avatarAttribute = tooltip?.AvatarAttribute || {};
  const statEffects = detailSections.flatMap((section) => section.lines.map(parseAvatarStatEffect).filter(Boolean));

  const isInner = Boolean(valueOf(item, ["IsInner", "isInner"], avatarAttribute.IsInner));

  return {
    Type: item?.Type || "",
    Name: item?.Name || "",
    Icon: item?.Icon || "",
    Grade: item?.Grade || "",
    IsSet: Boolean(valueOf(item, ["IsSet", "isSet"], avatarAttribute.IsSet)),
    IsInner: isInner,
    IsStatApplied: isInner,
    DetailSections: detailSections,
    StatEffects: statEffects
  };
}

export function normalizeAvatars(payload) {
  return Array.isArray(payload) ? payload.map(normalizeAvatarItem) : [];
}
