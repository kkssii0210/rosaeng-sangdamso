package com.rosaeng.sangdamso.character.gems;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.extractDetailSections;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.integer;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.isArray;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseDouble;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseTooltip;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.stripMarkup;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

public class GemsNormalizer {

    private static final Pattern SKILL_EFFECT_PATTERN = Pattern.compile(
        "^\\[(?<className>[^\\]]+)]\\s*(?<skillName>.+?)\\s*(?<effectType>피해|재사용 대기시간)\\s*(?<value>\\d+(?:\\.\\d+)?)%\\s*(?<direction>증가|감소)"
    );
    private static final Pattern ADDITIONAL_EFFECT_PATTERN = Pattern.compile(
        "^(?<name>기본 공격력|공격력|무기 공격력)\\s*(?<value>\\d+(?:\\.\\d+)?)%\\s*(?<direction>증가)"
    );

    public JsonNode normalize(JsonNode gems) {
        JsonNode listNode = isArray(child(gems, "Gems")) ? child(gems, "Gems") : gems;
        List<Map<String, Object>> normalized = arrayItems(listNode).stream()
            .map(this::normalizeGem)
            .filter(gem -> !String.valueOf(gem.get("Name")).isBlank())
            .sorted(Comparator.comparingInt(this::sortSlot))
            .toList();

        return toJsonNode(normalized);
    }

    private Map<String, Object> normalizeGem(JsonNode gem) {
        JsonNode tooltip = parseTooltip(text(gem, "Tooltip"));
        List<String> lines = extractGemEffectLines(tooltip);
        Map<String, Object> skillEffect = lines.stream()
            .map(this::parseGemSkillEffect)
            .filter(effect -> effect != null)
            .findFirst()
            .orElse(null);
        List<Map<String, Object>> additionalEffects = lines.stream()
            .map(this::parseGemAdditionalEffect)
            .filter(effect -> effect != null)
            .toList();
        Integer level = integer(gem, "Level");
        String name = stripMarkup(text(gem, "Name"));

        if (name.isBlank()) {
            name = "Lv." + (level == null ? "-" : level) + " 보석";
        }

        Double effectValue = skillEffect == null ? null : (Double) skillEffect.get("Value");
        String effectTypeText = skillEffect == null ? "" : String.valueOf(skillEffect.get("EffectTypeText"));
        String skillName = skillEffect == null ? "" : String.valueOf(skillEffect.get("SkillName"));

        return orderedMap(
            "Slot", integer(gem, "Slot"),
            "Name", name,
            "Icon", text(gem, "Icon"),
            "Level", level,
            "Grade", text(gem, "Grade"),
            "SkillName", skillName,
            "EffectType", skillEffect == null ? "" : skillEffect.get("EffectType"),
            "EffectTypeText", effectTypeText,
            "EffectValue", effectValue,
            "Direction", skillEffect == null ? "" : skillEffect.get("Direction"),
            "AdditionalEffects", additionalEffects,
            "SummaryText", skillEffect == null ? "" : String.format(Locale.US, "%s %s %.2f%%", skillName, effectTypeText, effectValue)
        );
    }

    private List<String> extractGemEffectLines(JsonNode tooltip) {
        List<String> lines = new ArrayList<>();

        for (Map<String, Object> section : extractDetailSections(tooltip)) {
            @SuppressWarnings("unchecked")
            List<String> sectionLines = (List<String>) section.get("lines");
            lines.addAll(sectionLines);
        }

        return lines;
    }

    private Map<String, Object> parseGemSkillEffect(String line) {
        Matcher match = SKILL_EFFECT_PATTERN.matcher(line);

        if (!match.find()) {
            return null;
        }

        String effectType = "피해".equals(match.group("effectType")) ? "damage" : "cooldown";

        return orderedMap(
            "ClassName", match.group("className"),
            "SkillName", match.group("skillName").trim(),
            "EffectType", effectType,
            "EffectTypeText", "damage".equals(effectType) ? "피해" : "쿨감",
            "Value", parseDouble(match.group("value")),
            "Direction", match.group("direction")
        );
    }

    private Map<String, Object> parseGemAdditionalEffect(String line) {
        Matcher match = ADDITIONAL_EFFECT_PATTERN.matcher(line);

        if (!match.find()) {
            return null;
        }

        return orderedMap(
            "Name", match.group("name"),
            "Value", parseDouble(match.group("value")),
            "Unit", "%",
            "Direction", match.group("direction")
        );
    }

    private int sortSlot(Map<String, Object> gem) {
        Integer slot = (Integer) gem.get("Slot");

        return slot == null ? 999 : slot;
    }
}
