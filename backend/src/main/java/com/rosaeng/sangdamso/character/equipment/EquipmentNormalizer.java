package com.rosaeng.sangdamso.character.equipment;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

public class EquipmentNormalizer {

    private static final Set<String> EXCLUDED_EQUIPMENT_TYPES = Set.of("나침반", "부적", "보주");
    private static final Set<String> QUALITY_EQUIPMENT_TYPES = Set.of(
        "무기",
        "투구",
        "상의",
        "하의",
        "장갑",
        "어깨",
        "목걸이",
        "귀걸이",
        "반지"
    );
    private static final Set<String> DETAILED_EQUIPMENT_TYPES = Set.of("목걸이", "귀걸이", "반지", "팔찌");
    private static final String ABILITY_STONE_TYPE = "어빌리티 스톤";
    private static final String WEAPON_TYPE = "무기";
    private static final String PARADISE_ORB_TYPE = "보주";

    private static final Pattern BR_TAG_PATTERN = Pattern.compile("<br\\s*/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern IMG_TAG_PATTERN = Pattern.compile("<img[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]*>");
    private static final Pattern WHITESPACE_PATTERN = Pattern.compile("\\s+");
    private static final Pattern MAIN_STAT_PATTERN = Pattern.compile("^(?<stat>힘|민첩|지능)\\s*\\+?\\s*(?<value>[\\d,]+)");
    private static final Pattern ABILITY_STONE_LEVEL_PATTERN = Pattern.compile(
        "^(?:\\[(?<bracketName>[^\\]]+)]\\s*)?(?<name>.+?)?\\s*Lv\\.(?<level>\\d+)",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern ABILITY_STONE_ACTIVE_PATTERN = Pattern.compile(
        "^(?:\\[(?<bracketName>[^\\]]+)]\\s*)?(?<name>.+?)?\\s*활성도\\s*(?<points>[+-]?\\d+)"
    );
    private static final Pattern ABILITY_STONE_BONUS_PATTERN = Pattern.compile("^\\[(?<title>[^\\]]+)]\\s*(?<line>.+)$");
    private static final Pattern WEAPON_POWER_PATTERN = Pattern.compile("^무기 공격력\\s*\\+?\\s*(?<value>[\\d,]+)");
    private static final Pattern ADDITIONAL_DAMAGE_PATTERN = Pattern.compile("^추가 피해\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern PARADISE_EFFECT_NAME_PATTERN = Pattern.compile("^\\[(?<name>[^\\]]+)]");
    private static final Pattern PARADISE_POWER_PATTERN = Pattern.compile(
        "(?:시즌\\s*2\\s*)?달성\\s*최대\\s*낙원력\\s*[:：]\\s*(?<value>[\\d,]+)"
    );
    private static final Pattern SUPPORT_PARADISE_PATTERN = Pattern.compile("투영|힐|회복|생명력|보호막|치유");
    private static final Pattern ATTACK_PARADISE_PATTERN = Pattern.compile("영험|신성|피해|공격|몬스터|대상");

    private final ObjectMapper objectMapper = new ObjectMapper();

    public JsonNode normalize(JsonNode equipment) {
        List<Map<String, Object>> normalized = new ArrayList<>();

        if (!isArray(equipment)) {
            return objectMapper.convertValue(normalized, JsonNode.class);
        }

        for (JsonNode item : equipment) {
            if (!EXCLUDED_EQUIPMENT_TYPES.contains(text(item, "Type"))) {
                normalized.add(normalizeItem(item));
            }
        }

        return objectMapper.convertValue(normalized, JsonNode.class);
    }

    public JsonNode extractParadiseOrb(JsonNode equipment) {
        if (!isArray(equipment)) {
            return null;
        }

        for (JsonNode item : equipment) {
            if (PARADISE_ORB_TYPE.equals(text(item, "Type"))) {
                return objectMapper.convertValue(paradiseOrbInfo(item), JsonNode.class);
            }
        }

        return null;
    }

    private Map<String, Object> normalizeItem(JsonNode item) {
        JsonNode tooltip = parseTooltip(text(item, "Tooltip"));
        JsonNode titleValue = child(child(tooltip, "Element_001"), "value");
        String type = text(item, "Type");
        Integer quality = extractQuality(titleValue, type);
        Map<String, Object> normalized = orderedMap();
        List<Map<String, Object>> detailSections = DETAILED_EQUIPMENT_TYPES.contains(type)
            ? extractDetailSections(tooltip)
            : List.of();
        Map<String, Object> mainStats = extractMainStats(tooltip, type);
        Map<String, Object> weaponStats = WEAPON_TYPE.equals(type) ? extractWeaponStats(tooltip) : null;
        Map<String, Object> abilityStone = ABILITY_STONE_TYPE.equals(type) ? extractAbilityStoneInfo(tooltip) : null;

        normalized.put("Type", type);
        normalized.put("Name", text(item, "Name"));
        normalized.put("Icon", text(item, "Icon"));
        normalized.put("Grade", text(item, "Grade"));
        normalized.put("Quality", quality);
        normalized.put("ItemLevelText", stripMarkup(text(titleValue, "leftStr2")));
        normalized.put("DetailSections", detailSections);

        if (mainStats != null) {
            normalized.put("MainStats", mainStats.get("Stats"));
            normalized.put("MainStatValue", mainStats.get("Value"));
            normalized.put("MainStatText", mainStats.get("Text"));
        }

        if (weaponStats != null) {
            normalized.put("WeaponStats", weaponStats);
        }

        if (abilityStone != null) {
            normalized.put("AbilityStone", abilityStone);
        }

        return normalized;
    }

    private Map<String, Object> paradiseOrbInfo(JsonNode orb) {
        JsonNode tooltip = parseTooltip(text(orb, "Tooltip"));
        List<Map<String, Object>> detailSections = extractDetailSections(tooltip);
        List<String> specialEffectLines = detailSections.stream()
            .filter(section -> String.valueOf(section.get("title")).contains("특수 효과"))
            .findFirst()
            .map(section -> lines(section.get("lines")))
            .orElse(List.of());
        String effectName = extractParadiseOrbEffectName(specialEffectLines);
        String paradisePowerLine = detailSections.stream()
            .flatMap(section -> lines(section.get("lines")).stream())
            .filter(line -> line.matches(".*달성\\s*최대\\s*낙원력.*"))
            .findFirst()
            .orElse("");
        Matcher paradisePowerMatch = PARADISE_POWER_PATTERN.matcher(paradisePowerLine);
        Integer paradisePower = paradisePowerMatch.find() ? parseInteger(paradisePowerMatch.group("value")) : null;
        Map<String, Object> result = orderedMap();

        result.put("Type", text(orb, "Type"));
        result.put("Name", text(orb, "Name"));
        result.put("Icon", text(orb, "Icon"));
        result.put("Grade", text(orb, "Grade"));
        result.put("EffectName", effectName);
        result.put("EffectRole", classifyParadiseOrbRole(orb, effectName, specialEffectLines));
        result.put("DetailSections", detailSections);
        result.put("MaxParadisePower", paradisePower == null ? null : orderedMap(
            "Value", paradisePower,
            "Text", paradisePowerLine
        ));

        return result;
    }

    private JsonNode parseTooltip(String tooltip) {
        if (tooltip == null || tooltip.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readTree(tooltip);
        } catch (JacksonException exception) {
            return null;
        }
    }

    private String stripMarkup(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }

        String withoutMarkup = BR_TAG_PATTERN.matcher(value).replaceAll("\n");
        withoutMarkup = IMG_TAG_PATTERN.matcher(withoutMarkup).replaceAll("");
        withoutMarkup = HTML_TAG_PATTERN.matcher(withoutMarkup).replaceAll("");
        withoutMarkup = withoutMarkup
            .replace("&nbsp;", " ")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&amp;", "&");
        List<String> lines = new ArrayList<>();

        for (String line : withoutMarkup.split("\\n")) {
            String normalizedLine = WHITESPACE_PATTERN.matcher(line).replaceAll(" ").trim();

            if (!normalizedLine.isEmpty()) {
                lines.add(normalizedLine);
            }
        }

        return String.join("\n", lines);
    }

    private List<String> splitTooltipLines(String value) {
        String stripped = stripMarkup(value);

        if (stripped.isEmpty()) {
            return List.of();
        }

        return List.of(stripped.split("\\n"));
    }

    private List<Map<String, Object>> extractDetailSections(JsonNode tooltip) {
        if (!isObject(tooltip)) {
            return List.of();
        }

        List<Map<String, Object>> sections = new ArrayList<>();

        for (JsonNode element : objectValues(tooltip)) {
            if (!"ItemPartBox".equals(text(element, "type"))) {
                continue;
            }

            JsonNode value = child(element, "value");
            String title = stripMarkup(text(value, "Element_000"));
            List<String> lines = splitTooltipLines(text(value, "Element_001"));

            if (!title.isEmpty() && !lines.isEmpty()) {
                sections.add(detailSection(title, lines));
            }
        }

        return sections;
    }

    private List<Map<String, Object>> extractIndentStringSections(JsonNode tooltip) {
        if (!isObject(tooltip)) {
            return List.of();
        }

        List<Map<String, Object>> sections = new ArrayList<>();

        for (JsonNode element : objectValues(tooltip)) {
            if (!"IndentStringGroup".equals(text(element, "type"))) {
                continue;
            }

            for (JsonNode group : objectValues(child(element, "value"))) {
                String title = stripMarkup(text(group, "topStr"));
                List<String> lines = new ArrayList<>();

                for (JsonNode item : objectValues(child(group, "contentStr"))) {
                    lines.addAll(splitTooltipLines(text(item, "contentStr")));
                }

                if (!title.isEmpty() && !lines.isEmpty()) {
                    sections.add(detailSection(title, lines));
                }
            }
        }

        return sections;
    }

    private Map<String, Object> extractWeaponStats(JsonNode tooltip) {
        List<String> lines = extractDetailSections(tooltip).stream()
            .flatMap(section -> lines(section.get("lines")).stream())
            .toList();
        String weaponPowerLine = lines.stream()
            .filter(line -> line.startsWith("무기 공격력"))
            .findFirst()
            .orElse("");
        String additionalDamageLine = lines.stream()
            .filter(line -> line.startsWith("추가 피해"))
            .findFirst()
            .orElse("");
        Matcher weaponPowerMatch = WEAPON_POWER_PATTERN.matcher(weaponPowerLine);
        Matcher additionalDamageMatch = ADDITIONAL_DAMAGE_PATTERN.matcher(additionalDamageLine);
        Integer weaponPower = weaponPowerMatch.find() ? parseInteger(weaponPowerMatch.group("value")) : null;
        Double additionalDamage = additionalDamageMatch.find() ? parseDouble(additionalDamageMatch.group("value")) : null;
        Map<String, Object> stats = orderedMap();

        if (weaponPower != null) {
            stats.put("WeaponPower", orderedMap("Value", weaponPower, "Text", weaponPowerLine));
        }

        if (additionalDamage != null) {
            stats.put("AdditionalDamage", orderedMap("Value", additionalDamage, "Text", additionalDamageLine));
        }

        return stats.isEmpty() ? null : stats;
    }

    private Map<String, Object> extractMainStats(JsonNode tooltip, String type) {
        if (WEAPON_TYPE.equals(type)) {
            return null;
        }

        List<Map<String, Object>> mainStats = extractDetailSections(tooltip).stream()
            .flatMap(section -> lines(section.get("lines")).stream())
            .map(this::parseMainStatLine)
            .filter(stat -> stat != null)
            .toList();

        if (mainStats.isEmpty()) {
            return null;
        }

        Map<String, Integer> totalsByStat = new LinkedHashMap<>();

        for (Map<String, Object> stat : mainStats) {
            String statName = String.valueOf(stat.get("Stat"));
            Integer value = (Integer) stat.get("Value");
            totalsByStat.put(statName, totalsByStat.getOrDefault(statName, 0) + value);
        }

        int mainStatValue = totalsByStat.values().stream().mapToInt(Integer::intValue).max().orElse(0);

        return orderedMap(
            "Stats", mainStats,
            "Value", mainStatValue,
            "Text", "주스탯 +" + NumberFormat.getIntegerInstance(Locale.KOREA).format(mainStatValue)
        );
    }

    private Map<String, Object> parseMainStatLine(String line) {
        Matcher match = MAIN_STAT_PATTERN.matcher(line == null ? "" : line);

        if (!match.find()) {
            return null;
        }

        Integer value = parseInteger(match.group("value"));

        if (value == null) {
            return null;
        }

        return orderedMap(
            "Stat", match.group("stat"),
            "Value", value,
            "Text", line.trim()
        );
    }

    private Map<String, Object> extractAbilityStoneInfo(JsonNode tooltip) {
        List<Map<String, Object>> sections = new ArrayList<>();
        sections.addAll(extractDetailSections(tooltip));
        sections.addAll(extractIndentStringSections(tooltip));

        List<Map<String, Object>> engravings = new ArrayList<>();
        List<Map<String, Object>> effects = new ArrayList<>();

        for (Map<String, Object> section : sections) {
            String title = String.valueOf(section.get("title"));

            for (String line : lines(section.get("lines"))) {
                Map<String, Object> engraving = parseAbilityStoneEngravingLine(line, title);

                if (engraving != null) {
                    engravings.add(engraving);
                } else {
                    AbilityStoneEffect effect = splitAbilityStoneEffectLine(line, title);
                    appendAbilityStoneEffectSection(effects, effect.title(), effect.line());
                }
            }
        }

        if (engravings.isEmpty() && effects.isEmpty()) {
            return null;
        }

        return orderedMap("Engravings", engravings, "Effects", effects);
    }

    private Map<String, Object> parseAbilityStoneEngravingLine(String line, String title) {
        Matcher levelMatch = ABILITY_STONE_LEVEL_PATTERN.matcher(line);

        if (levelMatch.find()) {
            String fallbackName = isGenericAbilityStoneTitle(title) ? "" : title;
            String name = normalizeAbilityStoneName(firstNonBlank(
                levelMatch.group("bracketName"),
                levelMatch.group("name"),
                fallbackName
            ));
            Integer level = parseInteger(levelMatch.group("level"));

            if (name.isEmpty() || name.contains("레벨 보너스") || level == null) {
                return null;
            }

            return orderedMap(
                "Name", name,
                "Level", level,
                "ValueText", "Lv." + level,
                "IsPenalty", name.contains("감소")
            );
        }

        Matcher activeMatch = ABILITY_STONE_ACTIVE_PATTERN.matcher(line);

        if (!activeMatch.find()) {
            return null;
        }

        String fallbackName = isGenericAbilityStoneTitle(title) ? "" : title;
        String name = normalizeAbilityStoneName(firstNonBlank(
            activeMatch.group("bracketName"),
            activeMatch.group("name"),
            fallbackName
        ));
        Integer points = parseInteger(activeMatch.group("points"));

        if (name.isEmpty() || points == null) {
            return null;
        }

        return orderedMap(
            "Name", name,
            "Points", points,
            "ValueText", points > 0 ? "+" + points : String.valueOf(points),
            "IsPenalty", name.contains("감소")
        );
    }

    private AbilityStoneEffect splitAbilityStoneEffectLine(String line, String title) {
        Matcher bonusMatch = ABILITY_STONE_BONUS_PATTERN.matcher(line);

        if (bonusMatch.find() && bonusMatch.group("title").contains("보너스")) {
            return new AbilityStoneEffect(
                normalizeAbilityStoneName(bonusMatch.group("title")),
                bonusMatch.group("line").trim()
            );
        }

        return new AbilityStoneEffect(title, line);
    }

    private void appendAbilityStoneEffectSection(List<Map<String, Object>> sections, String title, String line) {
        if (!sections.isEmpty()) {
            Map<String, Object> previousSection = sections.get(sections.size() - 1);

            if (title.equals(previousSection.get("Title"))) {
                lines(previousSection.get("Lines")).add(line);
                return;
            }
        }

        sections.add(orderedMap("Title", title, "Lines", new ArrayList<>(List.of(line))));
    }

    private boolean isGenericAbilityStoneTitle(String title) {
        return title != null && title.matches(".*(각인|효과|기본|추가|세공|보너스|어빌리티|스톤).*");
    }

    private String normalizeAbilityStoneName(String name) {
        return WHITESPACE_PATTERN.matcher(String.valueOf(name == null ? "" : name)
            .replaceAll("^\\[|]$", ""))
            .replaceAll(" ")
            .trim();
    }

    private String extractParadiseOrbEffectName(List<String> lines) {
        for (String line : lines) {
            Matcher match = PARADISE_EFFECT_NAME_PATTERN.matcher(line);

            if (match.find()) {
                return match.group("name");
            }
        }

        return "";
    }

    private String classifyParadiseOrbRole(JsonNode orb, String effectName, List<String> lines) {
        String text = String.join(" ", combine(List.of(text(orb, "Name"), effectName), lines));

        if (SUPPORT_PARADISE_PATTERN.matcher(text).find()) {
            return "support";
        }

        if (ATTACK_PARADISE_PATTERN.matcher(text).find()) {
            return "attack";
        }

        return "unknown";
    }

    private Integer extractQuality(JsonNode titleValue, String type) {
        JsonNode qualityValue = child(titleValue, "qualityValue");

        if (qualityValue == null || !qualityValue.isNumber() || qualityValue.asInt() < 0 || !QUALITY_EQUIPMENT_TYPES.contains(type)) {
            return null;
        }

        return qualityValue.asInt();
    }

    private Map<String, Object> detailSection(String title, List<String> lines) {
        return orderedMap("title", title, "lines", new ArrayList<>(lines));
    }

    private JsonNode child(JsonNode node, String fieldName) {
        if (node == null || node.isNull()) {
            return null;
        }

        return node.get(fieldName);
    }

    private String text(JsonNode node, String fieldName) {
        JsonNode value = child(node, fieldName);

        if (value == null || value.isNull()) {
            return "";
        }

        return value.asString();
    }

    private boolean isArray(JsonNode node) {
        return node != null && node.isArray();
    }

    private boolean isObject(JsonNode node) {
        return node != null && node.isObject();
    }

    private List<JsonNode> objectValues(JsonNode node) {
        if (!isObject(node)) {
            return List.of();
        }

        List<JsonNode> values = new ArrayList<>();

        for (String propertyName : node.propertyNames()) {
            values.add(node.get(propertyName));
        }

        return values;
    }

    @SuppressWarnings("unchecked")
    private List<String> lines(Object value) {
        return (List<String>) value;
    }

    private Integer parseInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Integer.parseInt(value.replace(",", ""));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Double parseDouble(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return Double.parseDouble(value.replace(",", ""));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }

        return "";
    }

    private List<String> combine(List<String> first, List<String> second) {
        List<String> combined = new ArrayList<>();

        for (String value : first) {
            if (value != null && !value.isBlank()) {
                combined.add(value);
            }
        }

        for (String value : second) {
            if (value != null && !value.isBlank()) {
                combined.add(value);
            }
        }

        return combined;
    }

    private Map<String, Object> orderedMap(Object... keyValues) {
        Map<String, Object> map = orderedMap();

        for (int index = 0; index < keyValues.length; index += 2) {
            map.put(String.valueOf(keyValues[index]), keyValues[index + 1]);
        }

        return map;
    }

    private Map<String, Object> orderedMap() {
        return new LinkedHashMap<>();
    }

    private record AbilityStoneEffect(String title, String line) {
    }
}
