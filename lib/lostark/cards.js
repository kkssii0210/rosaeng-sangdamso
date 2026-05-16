import { stripMarkup } from "./equipment.js";

function cleanText(value) {
  return stripMarkup(value)
    .replace(/\|\|/g, " ")
    .replace(/\\r|\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(String(value ?? "").replace(/,/g, ""));

  return Number.isFinite(number) ? number : fallback;
}

function parseCardEffectName(name) {
  const text = cleanText(name);
  const match = text.match(/^(?<setName>.+?)\s+(?<setCount>\d+)세트(?:\s*\((?<awakeTotal>\d+)각성합계\))?$/);

  if (!match?.groups) {
    return {
      SetName: text,
      SetCount: null,
      AwakeTotal: null
    };
  }

  return {
    SetName: match.groups.setName,
    SetCount: toNumber(match.groups.setCount),
    AwakeTotal: toNumber(match.groups.awakeTotal)
  };
}

function parseCardEffectDescription(description) {
  const text = cleanText(description);
  const damageReductionMatch = text.match(/^(?<damageType>.+?)\s*피해\s*감소\s*\+?(?<value>\d+(?:\.\d+)?)\s*%$/);
  const elementConversionMatch = text.match(/^공격\s*속성을\s*(?<element>.+?)속성으로\s*변환$/);
  const elementDamageMatch = text.match(/^(?<element>.+?)속성\s*피해\s*\+?(?<value>\d+(?:\.\d+)?)\s*%$/);
  const outgoingDamageMatch = text.match(/^적에게\s*주는\s*피해\s*\+?(?<value>\d+(?:\.\d+)?)\s*%$/);
  const additionalDamageMatch = text.match(/^추가\s*피해\s*\+?(?<value>\d+(?:\.\d+)?)\s*%$/);
  const critRateMatch = text.match(/^치명타\s*적중률\s*\+?(?<value>\d+(?:\.\d+)?)\s*%$/);
  const critDamageMatch = text.match(/^치명타\s*피해(?:량)?\s*\+?(?<value>\d+(?:\.\d+)?)\s*%$/);

  if (damageReductionMatch?.groups) {
    return {
      Kind: "damageReduction",
      DamageType: damageReductionMatch.groups.damageType,
      Value: toNumber(damageReductionMatch.groups.value),
      Unit: "%"
    };
  }

  if (elementConversionMatch?.groups) {
    return {
      Kind: "elementConversion",
      Element: elementConversionMatch.groups.element
    };
  }

  if (elementDamageMatch?.groups) {
    return {
      Kind: "elementDamage",
      Element: elementDamageMatch.groups.element,
      Value: toNumber(elementDamageMatch.groups.value),
      Unit: "%"
    };
  }

  if (outgoingDamageMatch?.groups) {
    return {
      Kind: "outgoingDamage",
      Value: toNumber(outgoingDamageMatch.groups.value),
      Unit: "%"
    };
  }

  if (additionalDamageMatch?.groups) {
    return {
      Kind: "additionalDamage",
      Value: toNumber(additionalDamageMatch.groups.value),
      Unit: "%"
    };
  }

  if (critRateMatch?.groups) {
    return {
      Kind: "critRate",
      Value: toNumber(critRateMatch.groups.value),
      Unit: "%"
    };
  }

  if (critDamageMatch?.groups) {
    return {
      Kind: "critDamage",
      Value: toNumber(critDamageMatch.groups.value),
      Unit: "%"
    };
  }

  return {
    Kind: "unknown"
  };
}

function normalizeCard(card) {
  return {
    Slot: card?.Slot ?? null,
    Name: card?.Name || "",
    Icon: card?.Icon || "",
    Grade: card?.Grade || "",
    AwakeCount: card?.AwakeCount ?? null,
    AwakeTotal: card?.AwakeTotal ?? null
  };
}

function normalizeCardEffectItem(item) {
  const name = cleanText(item?.Name || "");
  const description = cleanText(item?.Description || "");
  const nameInfo = parseCardEffectName(name);
  const descriptionInfo = parseCardEffectDescription(description);

  return {
    Name: name,
    Description: description,
    ...nameInfo,
    ...descriptionInfo
  };
}

function normalizeCardEffect(effect) {
  const items = Array.isArray(effect?.Items) ? effect.Items.map(normalizeCardEffectItem) : [];
  const setName = items.find((item) => item.SetName)?.SetName || "";

  return {
    Index: effect?.Index ?? null,
    CardSlots: Array.isArray(effect?.CardSlots) ? effect.CardSlots : [],
    SetName: setName,
    Items: items
  };
}

export function normalizeCards(cards) {
  const equippedCards = Array.isArray(cards?.Cards) ? cards.Cards.map(normalizeCard) : [];
  const effects = Array.isArray(cards?.Effects) ? cards.Effects.map(normalizeCardEffect) : [];
  const activeEffects = effects.flatMap((effect) => effect.Items.map((item) => ({
    ...item,
    EffectIndex: effect.Index,
    CardSlots: effect.CardSlots
  })));

  return {
    Cards: equippedCards,
    Effects: effects,
    ActiveEffects: activeEffects,
    AwakeTotal: equippedCards.reduce((total, card) => total + (toNumber(card.AwakeCount, 0) || 0), 0)
  };
}
