const MAX_MESSAGE_CHARS = 800;
const MAX_CONVERSATION_TURNS = 8;
const SUPPORTED_CONVERSATION_ROLES = new Set(["user", "assistant", "sggu"]);

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

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function stripMarkup(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeConsultMessage(message) {
  return String(message || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

export function normalizeConsultConversation(conversation, limit = MAX_CONVERSATION_TURNS) {
  return listOf({ conversation }, ["conversation"])
    .map((item) => {
      const rawRole = valueOf(item, ["role", "Role"], "");
      const role = rawRole === "sggu" ? "assistant" : rawRole;
      const content = sanitizeConsultMessage(valueOf(item, ["content", "text", "Text"], ""));

      if (!SUPPORTED_CONVERSATION_ROLES.has(rawRole) || !content) {
        return null;
      }

      return { role, content };
    })
    .filter(Boolean)
    .slice(-limit);
}

function summarizeEquipmentItem(item) {
  return {
    slot: valueOf(item, ["Type", "type"], ""),
    name: valueOf(item, ["Name", "name"], ""),
    mainStat: toNumber(valueOf(item, ["MainStatValue", "mainStatValue"], null), null),
    specialOptions: listOf(item, ["SpecialOptionSummary", "specialOptionSummary"]).slice(0, 4)
  };
}

function summarizeSpecUp(candidate) {
  return {
    type: valueOf(candidate, ["Type", "type"], ""),
    label: valueOf(candidate, ["Label", "label"], ""),
    target: valueOf(candidate, ["Target", "target"], ""),
    costGold: toNumber(valueOf(candidate, ["NetCostGold", "netCostGold", "CostGold", "costGold"], null), null),
    gainPercent: toNumber(valueOf(candidate, ["GainPercent", "gainPercent"], null), null),
    efficiencyScore: toNumber(valueOf(candidate, ["EfficiencyScore", "efficiencyScore"], null), null),
    caveat: valueOf(candidate, ["Caveat", "caveat"], "")
  };
}

function summarizeGem(gem) {
  const label = valueOf(gem, ["SkillName", "skillName", "Name", "name"], "");
  const level = valueOf(gem, ["Level", "level"], "");

  if (!label) {
    return null;
  }

  if (level === "") {
    return label;
  }

  return `${label} ${level}레벨`;
}

function summarizeArkPassivePoint(point) {
  const name = valueOf(point, ["Name", "name", "Type", "type"], "");
  const value = valueOf(point, ["Value", "value", "Point", "point"], "");

  return `${name} ${value}`.trim();
}

function summarizeArkPassiveEffect(effect) {
  const name = valueOf(effect, ["Name", "name"], "");
  const description = stripMarkup(valueOf(effect, ["Description", "description"], ""));

  return `${name} ${description}`.trim();
}

function summarizeSkill(skill) {
  const name = valueOf(skill, ["Name", "name"], "");

  if (!name) {
    return null;
  }

  const level = valueOf(skill, ["Level", "level"], "");
  const type = valueOf(skill, ["Type", "type", "SkillType", "skillType"], "");
  const rune = valueOf(valueOf(skill, ["Rune", "rune"], null), ["Name", "name"], "");
  const tripods = listOf(skill, ["Tripods", "tripods"])
    .filter((tripod) => valueOf(tripod, ["IsSelected", "isSelected"], true) !== false)
    .map((tripod) => valueOf(tripod, ["Name", "name"], ""))
    .filter(Boolean)
    .slice(0, 3);

  return [
    name,
    level === "" ? "" : `Lv.${level}`,
    type,
    rune,
    tripods.length ? tripods.join("/") : ""
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildSgguConsultantContext(input = {}) {
  const { armory = null, specUpRecommendation = null } = input || {};
  const profile = valueOf(armory, ["profile"], {});
  const equipment = listOf(armory, ["equipment"]);
  const arkPassive = valueOf(armory, ["arkPassive"], {});
  const skills = listOf(armory, ["skills"]);
  const engravings = listOf(armory, ["engravings"]);
  const gems = listOf(armory, ["gems"]);
  const avatars = listOf(armory, ["avatars"]);
  const recommendation = valueOf(specUpRecommendation, ["Recommendation", "recommendation"], specUpRecommendation || {});
  const topCandidates = listOf(recommendation, ["TopCandidates", "topCandidates"]);

  return {
    profile: {
      characterName: valueOf(profile, ["CharacterName", "characterName"], ""),
      serverName: valueOf(profile, ["ServerName", "serverName"], ""),
      className: valueOf(profile, ["CharacterClassName", "characterClassName"], ""),
      itemLevel: valueOf(profile, ["ItemAvgLevel", "itemAvgLevel"], ""),
      combatLevel: valueOf(profile, ["CharacterLevel", "characterLevel"], ""),
      combatPower: toNumber(valueOf(profile, ["CombatPower", "combatPower"], null), null)
    },
    accessories: equipment
      .filter((item) => ["목걸이", "귀걸이", "반지", "팔찌"].includes(valueOf(item, ["Type", "type"], "")))
      .map(summarizeEquipmentItem),
    keyEquipment: equipment
      .filter((item) => ["무기", "투구", "어깨", "상의", "하의", "장갑"].includes(valueOf(item, ["Type", "type"], "")))
      .map(summarizeEquipmentItem),
    arkPassiveSummary: {
      points: listOf(arkPassive, ["Points", "points"])
        .map(summarizeArkPassivePoint)
        .filter(Boolean)
        .slice(0, 6),
      effects: listOf(arkPassive, ["Effects", "effects"])
        .map(summarizeArkPassiveEffect)
        .filter(Boolean)
        .slice(0, 10)
    },
    skillSummary: skills
      .map(summarizeSkill)
      .filter(Boolean)
      .slice(0, 12),
    engravingSummary: engravings
      .map((engraving) => `${valueOf(engraving, ["Name", "name"], "")} ${valueOf(engraving, ["Level", "level"], "")}`.trim())
      .filter(Boolean)
      .join(", "),
    gemSummary: gems
      .map(summarizeGem)
      .filter(Boolean)
      .slice(0, 12),
    avatarSummary: avatars
      .map((avatar) => `${valueOf(avatar, ["Type", "type"], "")} ${valueOf(avatar, ["Grade", "grade"], "")}`.trim())
      .filter(Boolean)
      .slice(0, 8),
    topSpecUps: topCandidates.map(summarizeSpecUp).slice(0, 5)
  };
}
