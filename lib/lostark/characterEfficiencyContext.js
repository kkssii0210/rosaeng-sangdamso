import { normalizeCards } from "./cards.js";
import { normalizeEngravings } from "./engravings.js";
import { EXCLUDED_EQUIPMENT_TYPES, extractParadiseOrbInfo, normalizeEquipmentItem } from "./equipment.js";
import { normalizeGems } from "./gems.js";
import { normalizeAvatars } from "./avatars.js";
import { buildClassIdentityEffects } from "../spec/classIdentityEffects.js";
import { buildCriticalStats } from "../spec/criticalStats.js";

const LOSTARK_API_BASE_URL = "https://developer-lostark.game.onstove.com";

export const CHARACTER_EFFICIENCY_ERROR_CODES = {
  INVALID_CHARACTER_NAME: "INVALID_CHARACTER_NAME",
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

  if (!token) {
    return null;
  }

  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return null;
  }

  if (normalizedToken.toLowerCase().startsWith("bearer ")) {
    return normalizedToken;
  }

  return `bearer ${normalizedToken}`;
}

export async function defaultFetchLostark(path, authorization) {
  const response = await fetch(`${LOSTARK_API_BASE_URL}${path}`, {
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
    throw new CharacterEfficiencyError(
      CHARACTER_EFFICIENCY_ERROR_CODES.LOSTARK_API_ERROR,
      "Lostark API error"
    );
  }

  return response.json();
}

export async function loadCharacterEfficiencyContext({
  characterName,
  authorization,
  fetchLostark = defaultFetchLostark,
  includeAvatars = false
} = {}) {
  if (!authorization) {
    throw new CharacterEfficiencyError(
      CHARACTER_EFFICIENCY_ERROR_CODES.MISSING_API_KEY,
      "공식 Lostark Open API 키가 필요해. .env.local에 LOSTARK_API_KEY를 설정해줘."
    );
  }

  const normalizedCharacterName = String(characterName || "").trim();

  if (!normalizedCharacterName) {
    throw new CharacterEfficiencyError(
      CHARACTER_EFFICIENCY_ERROR_CODES.INVALID_CHARACTER_NAME,
      "조회할 캐릭터명을 입력해줘."
    );
  }

  const encodedName = encodeURIComponent(normalizedCharacterName);
  const [profile, equipment, avatars, arkPassive, arkGrid, cards, skills, engravings, gems] = await Promise.all([
    fetchLostark(`/armories/characters/${encodedName}/profiles`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/equipment`, authorization),
    includeAvatars ? fetchLostark(`/armories/characters/${encodedName}/avatars`, authorization) : Promise.resolve([]),
    fetchLostark(`/armories/characters/${encodedName}/arkpassive`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/arkgrid`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/cards`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/combat-skills`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/engravings`, authorization),
    fetchLostark(`/armories/characters/${encodedName}/gems`, authorization)
  ]);

  if (!profile) {
    throw new CharacterEfficiencyError(
      CHARACTER_EFFICIENCY_ERROR_CODES.CHARACTER_NOT_FOUND,
      "해당 캐릭터를 찾지 못했어."
    );
  }

  const paradiseOrb = extractParadiseOrbInfo(equipment);
  const normalizedEquipment = Array.isArray(equipment)
    ? equipment.filter((item) => !EXCLUDED_EQUIPMENT_TYPES.has(item?.Type)).map(normalizeEquipmentItem)
    : [];
  const normalizedCards = normalizeCards(cards);
  const normalizedEngravings = normalizeEngravings(engravings);
  const normalizedGems = normalizeGems(gems);
  const normalizedAvatars = normalizeAvatars(avatars);
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
    avatars: normalizedAvatars,
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
