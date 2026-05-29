package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.stripMarkup;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

class UpgradeCombatPowerEstimator {

    private static final Pattern BASIC_ATTACK_PATTERN = Pattern.compile("기본 공격력(?:은)?\\s*(?<value>[\\d,]+)");

    Double estimate(JsonNode profile, JsonNode equipment, JsonNode engravings, JsonNode gems) {
        double basicAttackPercent = basicAttackPercent(gems);
        Double baseAttack = baseAttack(profile, equipment, basicAttackPercent);

        if (baseAttack == null || baseAttack <= 0) {
            return null;
        }

        double multiplier = 1;
        multiplier *= 1 + basicAttackPercent / 100;
        multiplier *= 1 + combatLevelPercent(profile) / 100;
        multiplier *= gemMultiplier(gems);
        multiplier *= engravingMultiplier(engravings);

        return baseAttack
            * UpgradeEfficiencyConstants.SOURCE_BASE_COEFFICIENT
            * UpgradeEfficiencyConstants.IN_GAME_DISPLAY_SCALE
            * multiplier;
    }

    Double engravingCombatPowerPercent(JsonNode engraving) {
        String key = cleanKey(textValue(engraving, "Name", "name"));
        double[][] table = UpgradeEfficiencyConstants.ENGRAVING_COMBAT_POWER_TABLES.get(key);

        if (table == null) {
            return null;
        }

        int bookCount = engravingBookCount(engraving);
        int rowIndex = UpgradeEfficiencyConstants.ENGRAVING_BOOK_COUNTS.indexOf(bookCount);
        int stoneLevel = clampInt(numberValue(engraving, "AbilityStoneLevel", "abilityStoneLevel"), 0, 4);

        if (rowIndex < 0 || rowIndex >= table.length || stoneLevel >= table[rowIndex].length) {
            return null;
        }

        return table[rowIndex][stoneLevel];
    }

    private Double baseAttack(JsonNode profile, JsonNode equipment, double basicAttackPercent) {
        Double profileBasicAttack = profileBasicAttack(profile);

        if (profileBasicAttack != null && profileBasicAttack > 0) {
            return profileBasicAttack / (1 + basicAttackPercent / 100);
        }

        return equipmentFormulaBaseAttack(equipment);
    }

    private Double profileBasicAttack(JsonNode profile) {
        for (JsonNode stat : arrayItems(value(profile, "Stats", "stats"))) {
            if (!"공격력".equals(textValue(stat, "Type", "type"))) {
                continue;
            }

            for (String line : tooltipLines(value(stat, "Tooltip", "tooltip"))) {
                Matcher matcher = BASIC_ATTACK_PATTERN.matcher(line);

                if (matcher.find()) {
                    return number(matcher.group("value"));
                }
            }
        }

        return null;
    }

    private Double equipmentFormulaBaseAttack(JsonNode equipment) {
        double mainStatTotal = 0;
        Double weaponPower = null;

        for (JsonNode item : arrayItems(equipment)) {
            mainStatTotal += numberValue(item, "MainStatValue", "mainStatValue");

            if ("무기".equals(textValue(item, "Type", "type"))) {
                weaponPower = numberValue(value(value(item, "WeaponStats", "weaponStats"), "WeaponPower", "weaponPower"), "Value", "value");
            }
        }

        if (mainStatTotal <= 0 || weaponPower == null || weaponPower <= 0) {
            return null;
        }

        return Math.sqrt((mainStatTotal * weaponPower) / 6);
    }

    private double basicAttackPercent(JsonNode gems) {
        double total = 0;

        for (JsonNode gem : arrayItems(gems)) {
            for (JsonNode effect : arrayItems(value(gem, "AdditionalEffects", "additionalEffects"))) {
                if ("기본 공격력".equals(textValue(effect, "Name", "name"))) {
                    total += numberValue(effect, "Value", "value");
                }
            }
        }

        return total;
    }

    private double combatLevelPercent(JsonNode profile) {
        int level = (int) numberValue(profile, "CharacterLevel", "characterLevel");

        if (level >= 70) {
            return 29.45;
        }

        if (level >= 65) {
            return 23.97;
        }

        if (level >= 60) {
            return 18.56;
        }

        if (level >= 55) {
            return 8.95;
        }

        return 0;
    }

    private double gemMultiplier(JsonNode gems) {
        double multiplier = 1;

        for (JsonNode gem : arrayItems(gems)) {
            int level = (int) numberValue(gem, "Level", "level");
            Double percent = UpgradeEfficiencyConstants.GEM_PURE_COMBAT_POWER_FACTORS.get(level);

            if (percent != null && percent > 0) {
                multiplier *= 1 + percent / 100;
            }
        }

        return multiplier;
    }

    private double engravingMultiplier(JsonNode engravings) {
        double multiplier = 1;

        for (JsonNode engraving : arrayItems(engravings)) {
            Double percent = engravingCombatPowerPercent(engraving);

            if (percent != null && percent > 0) {
                multiplier *= 1 + percent / 100;
            }
        }

        return multiplier;
    }

    private int engravingBookCount(JsonNode engraving) {
        String grade = textValue(engraving, "Grade", "grade");
        int level = clampInt(numberValue(engraving, "Level", "level"), 0, 4);

        if (grade.contains("유물")) {
            return UpgradeEfficiencyConstants.ENGRAVING_BOOK_COUNT_BY_LEVEL.getOrDefault(level, 0);
        }

        if (grade.contains("전설")) {
            return 0;
        }

        return UpgradeEfficiencyConstants.ENGRAVING_BOOK_COUNT_BY_LEVEL.getOrDefault(level, 0);
    }

    private List<String> tooltipLines(JsonNode tooltip) {
        List<String> lines = new ArrayList<>();

        if (tooltip == null || tooltip.isNull()) {
            return lines;
        }

        if (tooltip.isArray()) {
            for (JsonNode item : tooltip) {
                addTooltipLines(lines, item.asString());
            }
            return lines;
        }

        addTooltipLines(lines, tooltip.asString());
        return lines;
    }

    private void addTooltipLines(List<String> lines, String text) {
        String stripped = stripMarkup(text == null ? "" : text);

        if (stripped.isBlank()) {
            return;
        }

        lines.addAll(List.of(stripped.split("\\n")));
    }

    private JsonNode value(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);
            if (value != null && !value.isNull()) {
                return value;
            }
        }

        return null;
    }

    private String textValue(JsonNode node, String... keys) {
        JsonNode value = value(node, keys);
        return value == null || value.isNull() ? "" : value.asString();
    }

    private double numberValue(JsonNode node, String... keys) {
        Double value = nullableNumberValue(node, keys);
        return value == null ? 0 : value;
    }

    private Double nullableNumberValue(JsonNode node, String... keys) {
        JsonNode value = value(node, keys);

        if (value == null || value.isNull()) {
            return null;
        }

        if (value.isNumber()) {
            return value.asDouble();
        }

        return number(value.asString());
    }

    private Double number(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Double.parseDouble(value.replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String cleanKey(String value) {
        return stripMarkup(value == null ? "" : value).replaceAll("\\s+", "");
    }

    private int clampInt(double value, int min, int max) {
        int number = (int) Math.floor(value);
        return Math.min(max, Math.max(min, number));
    }
}
