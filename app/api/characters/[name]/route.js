import { NextResponse } from "next/server";
import { normalizeAvatars } from "../../../../lib/lostark/avatars.js";
import { normalizeCards } from "../../../../lib/lostark/cards.js";
import { normalizeEngravings } from "../../../../lib/lostark/engravings.js";
import { EXCLUDED_EQUIPMENT_TYPES, extractParadiseOrbInfo, normalizeEquipmentItem } from "../../../../lib/lostark/equipment.js";
import { normalizeGems } from "../../../../lib/lostark/gems.js";
import { getMarketSnapshot } from "../../../../lib/lostark/marketApi.js";
import { buildClassIdentityEffects } from "../../../../lib/spec/classIdentityEffects.js";
import { buildCombatPowerAnalysis } from "../../../../lib/spec/combatPowerModel.js";
import { buildCriticalStats } from "../../../../lib/spec/criticalStats.js";
import { buildUpgradeEfficiency } from "../../../../lib/spec/upgradeEfficiency.js";

export const runtime = "nodejs";

const LOSTARK_API_BASE_URL = "https://developer-lostark.game.onstove.com";

const ERROR_CODES = {
  INVALID_CHARACTER_NAME: "INVALID_CHARACTER_NAME",
  MISSING_API_KEY: "MISSING_API_KEY",
  CHARACTER_NOT_FOUND: "CHARACTER_NOT_FOUND",
  LOSTARK_API_ERROR: "LOSTARK_API_ERROR"
};

function getAuthorizationHeader() {
  const token = process.env.LOSTARK_API_KEY || process.env.LOSTARK_OPEN_API_KEY;

  if (!token) {
    return null;
  }

  const normalizedToken = token.trim();

  if (normalizedToken.toLowerCase().startsWith("bearer ")) {
    return normalizedToken;
  }

  return `bearer ${normalizedToken}`;
}

async function fetchLostark(path, authorization) {
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
    const errorText = await response.text();
    throw new Error(`Lostark Open API ${response.status}: ${errorText.slice(0, 180)}`);
  }

  return response.json();
}

export async function GET(_request, context) {
  const { name } = await context.params;
  const characterName = decodeURIComponent(name || "").trim();
  const authorization = getAuthorizationHeader();

  if (!characterName) {
    return NextResponse.json(
      {
        code: ERROR_CODES.INVALID_CHARACTER_NAME,
        message: "조회할 캐릭터명을 입력해줘."
      },
      { status: 400 }
    );
  }

  if (!authorization) {
    return NextResponse.json(
      {
        code: ERROR_CODES.MISSING_API_KEY,
        message: "공식 Lostark Open API 키가 필요해. .env.local에 LOSTARK_API_KEY를 설정해줘."
      },
      { status: 500 }
    );
  }

  try {
    const encodedName = encodeURIComponent(characterName);
    const marketSnapshotPromise = getMarketSnapshot({ authorization }).catch((error) => {
      console.error(error);
      return null;
    });
    const [profile, equipment, avatars, arkPassive, arkGrid, cards, skills, engravings, gems, marketSnapshot] = await Promise.all([
      fetchLostark(`/armories/characters/${encodedName}/profiles`, authorization),
      fetchLostark(`/armories/characters/${encodedName}/equipment`, authorization),
      fetchLostark(`/armories/characters/${encodedName}/avatars`, authorization),
      fetchLostark(`/armories/characters/${encodedName}/arkpassive`, authorization),
      fetchLostark(`/armories/characters/${encodedName}/arkgrid`, authorization),
      fetchLostark(`/armories/characters/${encodedName}/cards`, authorization),
      fetchLostark(`/armories/characters/${encodedName}/combat-skills`, authorization),
      fetchLostark(`/armories/characters/${encodedName}/engravings`, authorization),
      fetchLostark(`/armories/characters/${encodedName}/gems`, authorization),
      marketSnapshotPromise
    ]);

    if (!profile) {
      return NextResponse.json(
        {
          code: ERROR_CODES.CHARACTER_NOT_FOUND,
          message: "해당 캐릭터를 찾지 못했어."
        },
        { status: 404 }
      );
    }

    const paradiseOrb = extractParadiseOrbInfo(equipment);
    const normalizedEquipment = Array.isArray(equipment)
      ? equipment.filter((item) => !EXCLUDED_EQUIPMENT_TYPES.has(item?.Type)).map(normalizeEquipmentItem)
      : [];
    const normalizedAvatars = normalizeAvatars(avatars);
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
    const upgradeEfficiency = buildUpgradeEfficiency({
      profile,
      equipment: normalizedEquipment,
      avatars: normalizedAvatars,
      gems: normalizedGems,
      criticalStats,
      marketSnapshot
    });
    const combatPowerAnalysis = buildCombatPowerAnalysis({
      profile,
      equipment: normalizedEquipment,
      paradiseOrb,
      arkPassive: arkPassive || {},
      arkGrid: arkGrid || {},
      cards: normalizedCards,
      engravings: normalizedEngravings,
      gems: normalizedGems
    });

    return NextResponse.json({
      profile,
      equipment: normalizedEquipment,
      paradiseOrb,
      avatars: normalizedAvatars,
      arkPassive: arkPassive || {},
      arkGrid: arkGrid || {},
      cards: normalizedCards,
      skills: normalizedSkills,
      engravings: normalizedEngravings,
      gems: normalizedGems,
      classIdentityEffects,
      criticalStats,
      combatPowerAnalysis,
      upgradeEfficiency
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        code: ERROR_CODES.LOSTARK_API_ERROR,
        message: "공식 Lostark API 응답이 불안정해. 잠시 후 다시 조회해줘."
      },
      { status: 502 }
    );
  }
}
