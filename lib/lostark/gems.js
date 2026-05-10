import { parseTooltip, splitTooltipLines, stripMarkup } from "./equipment.js";

function extractGemEffectLines(tooltip) {
  if (!tooltip) {
    return [];
  }

  return Object.values(tooltip)
    .filter((element) => element?.type === "ItemPartBox")
    .flatMap((element) => splitTooltipLines(element.value?.Element_001 || ""))
    .filter(Boolean);
}

function parseGemSkillEffect(line) {
  const match = line.match(/^\[(?<className>[^\]]+)\]\s*(?<skillName>.+?)\s*(?<effectType>피해|재사용 대기시간)\s*(?<value>\d+(?:\.\d+)?)%\s*(?<direction>증가|감소)/);

  if (!match?.groups) {
    return null;
  }

  return {
    ClassName: match.groups.className,
    SkillName: match.groups.skillName.trim(),
    EffectType: match.groups.effectType === "피해" ? "damage" : "cooldown",
    EffectTypeText: match.groups.effectType === "피해" ? "피해" : "쿨감",
    Value: Number(match.groups.value),
    Direction: match.groups.direction
  };
}

function parseGemAdditionalEffect(line) {
  const match = line.match(/^(?<name>기본 공격력|공격력|무기 공격력)\s*(?<value>\d+(?:\.\d+)?)%\s*(?<direction>증가)/);

  if (!match?.groups) {
    return null;
  }

  return {
    Name: match.groups.name,
    Value: Number(match.groups.value),
    Unit: "%",
    Direction: match.groups.direction
  };
}

export function normalizeGem(gem) {
  const tooltip = parseTooltip(gem?.Tooltip);
  const lines = extractGemEffectLines(tooltip);
  const skillEffect = lines.map(parseGemSkillEffect).find(Boolean);
  const additionalEffects = lines.map(parseGemAdditionalEffect).filter(Boolean);
  const name = stripMarkup(gem?.Name || "");

  return {
    Slot: Number.isFinite(Number(gem?.Slot)) ? Number(gem.Slot) : null,
    Name: name || `Lv.${gem?.Level || "-"} 보석`,
    Icon: gem?.Icon || "",
    Level: gem?.Level ?? null,
    Grade: gem?.Grade || "",
    SkillName: skillEffect?.SkillName || "",
    EffectType: skillEffect?.EffectType || "",
    EffectTypeText: skillEffect?.EffectTypeText || "",
    EffectValue: skillEffect?.Value ?? null,
    Direction: skillEffect?.Direction || "",
    AdditionalEffects: additionalEffects,
    SummaryText: skillEffect ? `${skillEffect.SkillName} ${skillEffect.EffectTypeText} ${skillEffect.Value.toFixed(2)}%` : ""
  };
}

export function normalizeGems(gems) {
  const list = Array.isArray(gems?.Gems) ? gems.Gems : Array.isArray(gems) ? gems : [];

  return list
    .map(normalizeGem)
    .filter((gem) => gem.Name)
    .sort((left, right) => {
      const leftSlot = left.Slot ?? 999;
      const rightSlot = right.Slot ?? 999;

      return leftSlot - rightSlot;
    });
}
