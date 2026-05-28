package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.objectValues;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseDouble;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.parseTooltip;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.splitTooltipLines;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.stripMarkup;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.text;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

public class CriticalStatsService {

    private static final String CRIT_RATE_KIND = "critRate";
    private static final String CRIT_DAMAGE_KIND = "critDamage";
    private static final String CRITICAL_OUTGOING_DAMAGE_KIND = "criticalOutgoingDamage";
    private static final String ATTACK_POWER_KIND = "attackPower";
    private static final String WEAPON_POWER_KIND = "weaponPower";
    private static final String ADDITIONAL_DAMAGE_KIND = "additionalDamage";
    private static final String EXPECTED_DAMAGE_PENALTY_KIND = "expectedDamagePenalty";
    private static final String EVOLUTION_DAMAGE_KIND = "evolutionDamage";
    private static final String CRITICAL_RATE_LIMIT_KIND = "criticalRateLimit";
    private static final double KEEN_BLUNT_PENALTY_CHANCE_PERCENT = 10;

    private static final Pattern CRIT_RATE_PATTERN = Pattern.compile("치명타\\s*적중률(?:이|가)?(?:\\s*추가로)?\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*(?:증가|상승)?");
    private static final Pattern CRIT_DAMAGE_PATTERN = Pattern.compile("치명타\\s*피해(?:량)?(?:이|가)?(?:\\s*추가로)?\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*(?:증가|상승)?");
    private static final Pattern CRITICAL_OUTGOING_PATTERN = Pattern.compile("(?:공격이\\s*)?치명타(?:로\\s*적중|시)?(?:\\s*적중)?\\s*시\\s*적에게\\s*주는\\s*피해(?:량|가|는)?\\s*(?:추가로\\s*)?(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*(?:추가로\\s*)?증가");
    private static final Pattern DIRECT_CRITICAL_OUTGOING_PATTERN = Pattern.compile("^치명타\\s*시\\s*적에게\\s*주는\\s*피해(?:량|가|는)?\\s*(?:추가로\\s*)?(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*(?:추가로\\s*)?증가");
    private static final Pattern ADDITIONAL_DAMAGE_PATTERN = Pattern.compile("추가\\s*피해(?:가|는)?\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern EVOLUTION_DAMAGE_PATTERN = Pattern.compile("진화형\\s*피해(?:가|는)?\\s*\\+?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*(?:증가|상승)");
    private static final Pattern SKILL_FAMILY_PATTERN = Pattern.compile("(?:^|\\s)(?<name>[가-힣A-Za-z0-9:·]+(?:\\s+[가-힣A-Za-z0-9:·]+)*\\s스킬)(?:의|이|을|를|에|로)");

    public JsonNode parseCriticalEffectText(String text) {
        return toJsonNode(parseCriticalEffects(text));
    }

    public JsonNode build(Map<String, JsonNode> context) {
        SourceCollection collection = new SourceCollection();
        JsonNode profile = context.get("profile");
        JsonNode equipment = context.get("equipment");
        JsonNode engravings = context.get("engravings");
        JsonNode skills = context.get("skills");
        JsonNode arkPassive = context.get("arkPassive");
        JsonNode arkGrid = context.get("arkGrid");
        JsonNode cards = context.get("cards");
        JsonNode classIdentityEffects = context.get("classIdentityEffects");

        extractProfileSources(collection, profile);
        extractEquipmentSources(collection, equipment);
        extractEngravingSources(collection, engravings);
        extractSkillSources(collection, skills);
        extractArkPassiveSources(collection, arkPassive);
        extractArkGridSources(collection, arkGrid);
        extractCardSources(collection, cards);
        extractClassIdentitySources(collection, classIdentityEffects);

        List<Map<String, Object>> sources = collection.sources;
        List<Map<String, Object>> specialSources = collection.specialSources;
        double globalCritRate = roundPercent(sumSources(sources, CRIT_RATE_KIND, "global"));
        double conditionalCritRate = roundPercent(sumSources(sources, CRIT_RATE_KIND, "conditional"));
        double totalCritRate = globalCritRate + conditionalCritRate;
        double globalCritDamageBonus = roundPercent(sumSources(sources, CRIT_DAMAGE_KIND, "global"));
        double damagePenaltyMultiplier = expectedPenaltyMultiplier(specialSources);
        double fixedEvolutionDamage = roundPercent(sumSources(specialSources, EVOLUTION_DAMAGE_KIND, "global"));
        double globalAdditionalDamage = roundPercent(sumSources(specialSources, ADDITIONAL_DAMAGE_KIND, "global"));
        Map<String, Object> criticalRateLimit = criticalRateLimitOf(specialSources);
        double capPercent = ((Number) criticalRateLimit.get("CapPercent")).doubleValue();
        double convertedEvolutionDamage = convertedEvolutionDamagePercent(totalCritRate, criticalRateLimit);

        return toJsonNode(orderedMap(
            "BaseCriticalDamagePercent", 200,
            "GlobalCriticalRatePercent", globalCritRate,
            "ConditionalCriticalRatePercent", conditionalCritRate,
            "EffectiveCriticalRatePercent", Math.min(totalCritRate, capPercent),
            "GlobalAttackPowerPercent", roundPercent(sumSources(specialSources, ATTACK_POWER_KIND, "global")),
            "ConditionalAttackPowerPercent", roundPercent(sumSources(specialSources, ATTACK_POWER_KIND, "conditional")),
            "GlobalWeaponPowerPercent", roundPercent(sumSources(specialSources, WEAPON_POWER_KIND, "global")),
            "ConditionalWeaponPowerPercent", roundPercent(sumSources(specialSources, WEAPON_POWER_KIND, "conditional")),
            "GlobalAdditionalDamagePercent", globalAdditionalDamage,
            "ConditionalAdditionalDamagePercent", roundPercent(sumSources(specialSources, ADDITIONAL_DAMAGE_KIND, "conditional")),
            "FixedEvolutionDamagePercent", fixedEvolutionDamage,
            "ConvertedEvolutionDamagePercent", convertedEvolutionDamage,
            "EvolutionDamagePercent", roundPercent(fixedEvolutionDamage + convertedEvolutionDamage),
            "CriticalRateLimit", criticalRateLimit,
            "GlobalCriticalDamageBonusPercent", globalCritDamageBonus,
            "GlobalCriticalDamagePercent", roundPercent(200 + globalCritDamageBonus),
            "ConditionalCriticalDamageBonusPercent", roundPercent(sumSources(sources, CRIT_DAMAGE_KIND, "conditional")),
            "CriticalOutgoingDamagePercent", roundPercent(sumSources(sources, CRITICAL_OUTGOING_DAMAGE_KIND, "global")),
            "ConditionalCriticalOutgoingDamagePercent", roundPercent(sumSources(sources, CRITICAL_OUTGOING_DAMAGE_KIND, "conditional")),
            "ExpectedDamagePenaltyMultiplier", damagePenaltyMultiplier,
            "ExpectedDamagePenaltyPercent", roundPercent((1 - damagePenaltyMultiplier) * 100),
            "SpecialEngravingSources", specialSources,
            "GlobalSources", filterByScope(sources, "global"),
            "ConditionalSources", filterByScope(sources, "conditional"),
            "SkillSources", filterByScope(sources, "skill"),
            "SkillFamilySources", filterByScope(sources, "skillFamily"),
            "SpecialSources", specialSources
        ));
    }

    private List<Map<String, Object>> parseCriticalEffects(String text) {
        String normalizedText = cleanText(text);
        List<Map<String, Object>> effects = new ArrayList<>();

        if (normalizedText.isBlank()) {
            return effects;
        }

        Matcher criticalOutgoingMatch = CRITICAL_OUTGOING_PATTERN.matcher(normalizedText);
        Matcher directCriticalOutgoingMatch = DIRECT_CRITICAL_OUTGOING_PATTERN.matcher(normalizedText);
        Double criticalOutgoingValue = null;

        if (criticalOutgoingMatch.find()) {
            criticalOutgoingValue = parseDouble(criticalOutgoingMatch.group("value"));
        } else if (directCriticalOutgoingMatch.find()) {
            criticalOutgoingValue = parseDouble(directCriticalOutgoingMatch.group("value"));
        }

        if (criticalOutgoingValue != null) {
            effects.add(orderedMap("Kind", CRITICAL_OUTGOING_DAMAGE_KIND, "Value", criticalOutgoingValue, "Text", normalizedText));
        }

        Matcher critRateMatch = CRIT_RATE_PATTERN.matcher(normalizedText);

        if (critRateMatch.find()) {
            Double critRateValue = parseDouble(critRateMatch.group("value"));

            if (critRateValue != null) {
                effects.add(orderedMap("Kind", CRIT_RATE_KIND, "Value", critRateValue, "Text", normalizedText));
            }
        }

        Matcher critDamageMatch = CRIT_DAMAGE_PATTERN.matcher(normalizedText);

        if (critDamageMatch.find()) {
            Double critDamageValue = parseDouble(critDamageMatch.group("value"));

            if (critDamageValue != null) {
                effects.add(orderedMap("Kind", CRIT_DAMAGE_KIND, "Value", critDamageValue, "Text", normalizedText));
            }
        }

        return effects;
    }

    private void addTextSources(SourceCollection collection, List<String> texts, SourceContext sourceContext) {
        for (String text : texts) {
            for (Map<String, Object> effect : parseCriticalEffects(text)) {
                addSource(collection, buildSource(effect, sourceContext));
            }
        }
    }

    private Map<String, Object> buildSource(Map<String, Object> effect, SourceContext sourceContext) {
        String effectText = String.valueOf(effect.get("Text"));
        String skillFamily = "global".equals(sourceContext.scope()) ? skillFamilyName(effectText) : "";
        String inferredScope = "global".equals(sourceContext.scope()) && !skillFamily.isBlank()
            ? "skillFamily"
            : "global".equals(sourceContext.scope()) && isConditionalCriticalEffect(effect, effectText)
                ? "conditional"
                : sourceContext.scope();

        return orderedMap(
            "Kind", effect.get("Kind"),
            "Scope", inferredScope,
            "SourceType", sourceContext.sourceType(),
            "SourceName", sourceContext.sourceName(),
            "SourceId", sourceContext.sourceId(),
            "SkillName", sourceContext.skillName(),
            "SkillFamily", skillFamily,
            "Value", valueForSource(effect, sourceContext.sourceName()),
            "Text", effectText
        );
    }

    private boolean isConditionalCriticalEffect(Map<String, Object> effect, String text) {
        String kind = String.valueOf(effect.get("Kind"));

        if (CRITICAL_OUTGOING_DAMAGE_KIND.equals(kind)) {
            return true;
        }

        if (CRIT_RATE_KIND.equals(kind)) {
            return Pattern.compile("중첩|최대 중첩|발동|동안|사용 시|적중 시|상태|대상").matcher(effectContext(text, CRIT_RATE_PATTERN)).find();
        }

        return Pattern.compile("사용 시|상태에서|특정|대상|사신 스킬|초각성|아이덴티티|피격이상|시드 이하").matcher(effectContext(text, CRIT_DAMAGE_PATTERN)).find();
    }

    private String effectContext(String text, Pattern pattern) {
        Matcher matcher = pattern.matcher(text);

        if (!matcher.find()) {
            return text;
        }

        return text.substring(Math.max(0, matcher.start() - 40), Math.min(text.length(), matcher.end()));
    }

    private double valueForSource(Map<String, Object> effect, String sourceName) {
        double value = number(effect.get("Value"));
        boolean isMasterCriticalRate = CRIT_RATE_KIND.equals(effect.get("Kind")) && (sourceName + " " + effect.get("Text")).contains("달인");

        if (!isMasterCriticalRate) {
            return value;
        }

        return roundPercent(value * maxStackCountOf(String.valueOf(effect.get("Text"))));
    }

    private int maxStackCountOf(String text) {
        Matcher matcher = Pattern.compile("최대\\s*(?<count>\\d+)\\s*중첩").matcher(text);

        if (!matcher.find()) {
            return 1;
        }

        Integer count = Integer.valueOf(matcher.group("count"));

        return count > 0 ? count : 1;
    }

    private String skillFamilyName(String text) {
        Matcher matcher = SKILL_FAMILY_PATTERN.matcher(cleanText(text));

        return matcher.find() ? matcher.group("name").trim() : "";
    }

    private void extractProfileSources(SourceCollection collection, JsonNode profile) {
        JsonNode critStat = arrayItems(value(profile, "Stats", "stats")).stream()
            .filter(stat -> "치명".equals(textOf(stat, "Type", "type")))
            .findFirst()
            .orElse(null);

        addTextSources(collection, collectText(value(critStat, "Tooltip", "tooltip")), SourceContext.global("profile", "치명 스탯"));
    }

    private void extractEquipmentSources(SourceCollection collection, JsonNode equipment) {
        List<JsonNode> items = arrayItems(equipment);

        for (int itemIndex = 0; itemIndex < items.size(); itemIndex++) {
            JsonNode item = items.get(itemIndex);
            String type = textOf(item, "Type", "type");
            String name = textOf(item, "Name", "name");
            List<String> detailLines = sectionLines(value(item, "DetailSections", "detailSections"), "lines", "Lines");
            List<String> stoneLines = new ArrayList<>();

            for (JsonNode section : arrayItems(value(value(item, "AbilityStone", "abilityStone"), "Effects", "effects"))) {
                stoneLines.addAll(strings(value(section, "Lines", "lines")));
            }

            List<String> texts = new ArrayList<>(detailLines);
            texts.addAll(stoneLines);
            addTextSources(collection, texts, new SourceContext("equipment", (type + " " + (name.isBlank() ? type : name)).trim(), "equipment:" + itemIndex, "global", ""));
        }
    }

    private void extractEngravingSources(SourceCollection collection, JsonNode engravings) {
        for (JsonNode engraving : arrayItems(engravings)) {
            String name = textOf(engraving, "Name", "name");
            String description = textOf(engraving, "Description", "description");

            addTextSources(collection, List.of(description), SourceContext.global("engraving", name.isBlank() ? "각인" : name));
            extractSpecialEngravingSources(collection, engraving, description);
        }
    }

    private void extractSpecialEngravingSources(SourceCollection collection, JsonNode engraving, String description) {
        addSpecialSources(
            collection,
            maxStackAttackPowerSource(engraving, description),
            keenBluntPenaltySource(engraving, description)
        );
    }

    private Map<String, Object> maxStackAttackPowerSource(JsonNode engraving, String description) {
        String name = textOf(engraving, "Name", "name");

        if (!"아드레날린".equals(name)) {
            return null;
        }

        Matcher attackPowerMatch = Pattern.compile("공격력이\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*증가").matcher(description);
        Matcher maxStackMatch = Pattern.compile("최대\\s*(?<count>\\d+)\\s*중첩").matcher(description);

        if (!attackPowerMatch.find() || !maxStackMatch.find()) {
            return null;
        }

        Double attackPowerValue = parseDouble(attackPowerMatch.group("value"));
        int maxStackCount = Integer.parseInt(maxStackMatch.group("count"));

        if (attackPowerValue == null || maxStackCount <= 0) {
            return null;
        }

        return orderedMap(
            "Kind", ATTACK_POWER_KIND,
            "Scope", "conditional",
            "SourceType", "engraving",
            "SourceName", name,
            "Value", roundPercent(attackPowerValue * maxStackCount),
            "PerStackValue", attackPowerValue,
            "MaxStackCount", maxStackCount,
            "Text", description
        );
    }

    private Map<String, Object> keenBluntPenaltySource(JsonNode engraving, String description) {
        String name = textOf(engraving, "Name", "name");

        if (!"예리한 둔기".equals(name)) {
            return null;
        }

        Matcher penaltyMatch = Pattern.compile("(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*감소된 피해").matcher(description);

        if (!penaltyMatch.find()) {
            return null;
        }

        Double reductionPercent = parseDouble(penaltyMatch.group("value"));

        if (reductionPercent == null) {
            return null;
        }

        double expectedPenaltyPercent = roundPercent(reductionPercent * KEEN_BLUNT_PENALTY_CHANCE_PERCENT / 100);

        return orderedMap(
            "Kind", EXPECTED_DAMAGE_PENALTY_KIND,
            "Scope", "global",
            "SourceType", "engraving",
            "SourceName", name,
            "Value", expectedPenaltyPercent,
            "ReductionPercent", reductionPercent,
            "ChancePercent", KEEN_BLUNT_PENALTY_CHANCE_PERCENT,
            "Multiplier", roundPercent((1 - expectedPenaltyPercent / 100) * 100) / 100,
            "Text", description
        );
    }

    private void extractSkillSources(SourceCollection collection, JsonNode skills) {
        for (JsonNode skill : arrayItems(skills)) {
            String skillName = textOf(skill, "Name", "name");

            for (JsonNode tripod : arrayItems(value(skill, "Tripods", "tripods"))) {
                if (!booleanOf(tripod, true, "IsSelected", "isSelected")) {
                    continue;
                }

                addTextSources(
                    collection,
                    List.of(textOf(tripod, "Tooltip", "tooltip")),
                    new SourceContext("tripod", defaultText(textOf(tripod, "Name", "name"), "트라이포드"), "", "skill", defaultText(skillName, "스킬"))
                );
            }
        }
    }

    private void extractArkPassiveSources(SourceCollection collection, JsonNode arkPassive) {
        if (Boolean.FALSE.equals(nullableBoolean(arkPassive, "IsArkPassive", "isArkPassive"))) {
            return;
        }

        for (JsonNode effect : arrayItems(value(arkPassive, "Effects", "effects"))) {
            List<String> texts = collectText(value(effect, "ToolTip", "Tooltip", "tooltip"));
            String sourceName = cleanText(textOf(effect, "Description", "description"));

            if (sourceName.isBlank()) {
                sourceName = defaultText(textOf(effect, "Name", "name"), "아크패시브");
            }

            SourceContext sourceContext = SourceContext.global("arkPassive", sourceName);
            addTextSources(collection, texts, sourceContext);
            addSpecialTextSources(collection, texts, sourceContext);
        }

        extractArkPassivePointSources(collection, arkPassive);
    }

    private void extractArkPassivePointSources(SourceCollection collection, JsonNode arkPassive) {
        for (JsonNode point : arrayItems(value(arkPassive, "Points", "points"))) {
            String name = textOf(point, "Name", "name");
            ArkPassiveProgress progress = arkPassiveProgress(point);

            if ("진화".equals(name) && progress.rank() >= 6) {
                addSpecialSource(collection, orderedMap(
                    "Kind", EVOLUTION_DAMAGE_KIND,
                    "Scope", "global",
                    "SourceType", "arkPassivePoint",
                    "SourceName", "진화 6랭크 달성 보너스",
                    "Value", 6,
                    "Rank", progress.rank(),
                    "Level", progress.level(),
                    "Text", name + " " + progress.text() + " / 진화형 피해 +6%"
                ));
            }

            if ("깨달음".equals(name) && progress.level() > 0) {
                double value = roundPercent(progress.level() * 0.1);
                addSpecialSource(collection, orderedMap(
                    "Kind", WEAPON_POWER_KIND,
                    "Scope", "global",
                    "SourceType", "arkPassivePoint",
                    "SourceName", "깨달음 레벨 보너스",
                    "Value", value,
                    "Rank", progress.rank(),
                    "Level", progress.level(),
                    "Text", name + " " + progress.text() + " / 무기 공격력 +" + String.format("%.1f", value) + "%"
                ));
            }
        }
    }

    private ArkPassiveProgress arkPassiveProgress(JsonNode point) {
        String description = cleanText(textOf(point, "Description", "description"));
        Matcher matcher = Pattern.compile("(?<rank>\\d+)\\s*랭크\\s*(?<level>\\d+)\\s*레벨").matcher(description);

        if (!matcher.find()) {
            return new ArkPassiveProgress(0, 0, description);
        }

        return new ArkPassiveProgress(Integer.parseInt(matcher.group("rank")), Integer.parseInt(matcher.group("level")), description);
    }

    private void addSpecialTextSources(SourceCollection collection, List<String> texts, SourceContext sourceContext) {
        for (String text : texts) {
            addSpecialSources(
                collection,
                additionalDamageSource(text, sourceContext),
                evolutionDamageSource(text, sourceContext),
                criticalRateLimitSource(text, sourceContext)
            );
        }
    }

    @SafeVarargs
    private final void addSpecialSources(SourceCollection collection, Map<String, Object>... sources) {
        for (Map<String, Object> source : sources) {
            if (source != null) {
                addSpecialSource(collection, source);
            }
        }
    }

    private Map<String, Object> additionalDamageSource(String text, SourceContext sourceContext) {
        String normalizedText = cleanText(text);
        Matcher match = ADDITIONAL_DAMAGE_PATTERN.matcher(normalizedText);

        if (!match.find()) {
            return null;
        }

        Double value = parseDouble(match.group("value"));

        if (value == null) {
            return null;
        }

        return orderedMap(
            "Kind", ADDITIONAL_DAMAGE_KIND,
            "Scope", "global",
            "SourceType", sourceContext.sourceType(),
            "SourceName", sourceContext.sourceName(),
            "Value", valueForSpecialTextSource(value, normalizedText, sourceContext.sourceName()),
            "BaseValue", value,
            "Text", normalizedText
        );
    }

    private Map<String, Object> evolutionDamageSource(String text, SourceContext sourceContext) {
        String normalizedText = cleanText(text);
        Matcher match = EVOLUTION_DAMAGE_PATTERN.matcher(normalizedText);

        if (!match.find()) {
            return null;
        }

        Double value = parseDouble(match.group("value"));

        if (value == null) {
            return null;
        }

        return orderedMap(
            "Kind", EVOLUTION_DAMAGE_KIND,
            "Scope", "global",
            "SourceType", sourceContext.sourceType(),
            "SourceName", sourceContext.sourceName(),
            "Value", value,
            "Text", normalizedText
        );
    }

    private Map<String, Object> criticalRateLimitSource(String text, SourceContext sourceContext) {
        String normalizedText = cleanText(text);
        String fullText = sourceContext.sourceName() + " " + normalizedText;

        if (!fullText.contains("뭉툭한 가시")) {
            return null;
        }

        Matcher capMatch = Pattern.compile("치명타가\\s*발생할\\s*확률이\\s*최대\\s*(?<cap>\\d+(?:\\.\\d+)?)\\s*%\\s*로\\s*제한").matcher(normalizedText);
        Matcher conversionMatch = Pattern.compile("초과한\\s*모든\\s*치명타가\\s*발생할\\s*확률의\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*가\\s*진화형\\s*피해로\\s*전환").matcher(normalizedText);
        Matcher maxMatch = Pattern.compile("이\\s*노드에\\s*의한\\s*진화형\\s*피해는\\s*최대\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%\\s*까지").matcher(normalizedText);

        if (!capMatch.find() || !conversionMatch.find() || !maxMatch.find()) {
            return null;
        }

        return orderedMap(
            "Kind", CRITICAL_RATE_LIMIT_KIND,
            "Scope", "global",
            "SourceType", sourceContext.sourceType(),
            "SourceName", sourceContext.sourceName(),
            "Value", parseDouble(capMatch.group("cap")),
            "CapPercent", parseDouble(capMatch.group("cap")),
            "OverflowConversionRatePercent", parseDouble(conversionMatch.group("value")),
            "MaxConvertedEvolutionDamagePercent", parseDouble(maxMatch.group("value")),
            "Text", normalizedText
        );
    }

    private double valueForSpecialTextSource(double value, String text, String sourceName) {
        if (!(sourceName + " " + text).contains("달인")) {
            return value;
        }

        return roundPercent(value * maxStackCountOf(text));
    }

    private void extractArkGridSources(SourceCollection collection, JsonNode arkGrid) {
        for (JsonNode slot : arrayItems(value(arkGrid, "Slots", "slots"))) {
            addTextSources(collection, collectText(value(slot, "Tooltip", "tooltip")), SourceContext.global("arkGrid", defaultText(textOf(slot, "Name", "name"), "아크그리드")));

            for (JsonNode gem : arrayItems(value(slot, "Gems", "gems"))) {
                if (!booleanOf(gem, true, "IsActive", "isActive")) {
                    continue;
                }

                addTextSources(
                    collection,
                    collectText(value(gem, "Tooltip", "tooltip")),
                    SourceContext.global("arkGridGem", defaultText(textOf(slot, "Name", "name"), "아크그리드") + " 젬")
                );
            }
        }
    }

    private void extractCardSources(SourceCollection collection, JsonNode cards) {
        for (JsonNode effect : arrayItems(value(cards, "Effects", "effects"))) {
            for (JsonNode item : arrayItems(value(effect, "Items", "items"))) {
                addTextSources(collection, List.of(textOf(item, "Description", "description")), SourceContext.global("card", defaultText(textOf(item, "Name", "name"), "카드")));
            }
        }
    }

    private void extractClassIdentitySources(SourceCollection collection, JsonNode classIdentityEffects) {
        String className = defaultText(textOf(classIdentityEffects, "ClassName", "className"), "아이덴티티");

        for (JsonNode effect : arrayItems(value(classIdentityEffects, "Effects", "effects"))) {
            Double value = numberOf(effect, "Value", "value");
            String kind = criticalKindOf(effect);
            String confidence = textOf(effect, "Confidence", "confidence");
            boolean isActive = booleanOf(effect, true, "IsActive", "isActive");

            if (!isActive || value == null || kind.isBlank() || "unverified".equals(confidence)) {
                continue;
            }

            addSource(collection, buildSource(orderedMap(
                "Kind", kind,
                "Value", value,
                "Text", String.join(" / ", nonBlank(List.of(
                    defaultText(textOf(effect, "Name", "name"), "아이덴티티 효과"),
                    textOf(effect, "AppliesWhen", "appliesWhen"),
                    textOf(effect, "Target", "target")
                )))
            ), new SourceContext(
                "classIdentity",
                (className + " " + defaultText(textOf(effect, "Name", "name"), "아이덴티티 효과")).trim(),
                "",
                scopeOfIdentityEffect(effect),
                "self".equals(textOf(effect, "Target", "target")) ? "" : textOf(effect, "Target", "target")
            )));
        }
    }

    private String criticalKindOf(JsonNode effect) {
        String kind = textOf(effect, "Kind", "kind");

        return List.of(CRIT_RATE_KIND, CRIT_DAMAGE_KIND, CRITICAL_OUTGOING_DAMAGE_KIND).contains(kind) ? kind : "";
    }

    private String scopeOfIdentityEffect(JsonNode effect) {
        String scope = defaultText(textOf(effect, "Scope", "scope"), "identity");

        return "global".equals(scope) || "skill".equals(scope) ? scope : "conditional";
    }

    private void addSource(SourceCollection collection, Map<String, Object> source) {
        String key = String.join(":",
            String.valueOf(source.getOrDefault("SourceId", "")),
            String.valueOf(source.get("Kind")),
            String.valueOf(source.get("Scope")),
            String.valueOf(source.get("SourceType")),
            String.valueOf(source.get("SourceName")),
            String.valueOf(source.getOrDefault("SkillName", "")),
            String.valueOf(source.get("Value")),
            String.valueOf(source.get("Text"))
        );

        if (collection.keys.add(key)) {
            collection.sources.add(source);
        }
    }

    private void addSpecialSource(SourceCollection collection, Map<String, Object> source) {
        String key = String.join(":",
            String.valueOf(source.get("Kind")),
            String.valueOf(source.get("Scope")),
            String.valueOf(source.get("SourceType")),
            String.valueOf(source.get("SourceName")),
            String.valueOf(source.get("Value")),
            String.valueOf(source.get("Text"))
        );

        if (collection.specialKeys.add(key)) {
            collection.specialSources.add(source);
        }
    }

    private double sumSources(List<Map<String, Object>> sources, String kind, String scope) {
        return sources.stream()
            .filter(source -> kind.equals(source.get("Kind")) && scope.equals(source.get("Scope")))
            .mapToDouble(source -> number(source.get("Value")))
            .sum();
    }

    private double expectedPenaltyMultiplier(List<Map<String, Object>> sources) {
        return sources.stream()
            .filter(source -> EXPECTED_DAMAGE_PENALTY_KIND.equals(source.get("Kind")))
            .reduce(1.0, (multiplier, source) -> multiplier * number(source.getOrDefault("Multiplier", 1)), (left, right) -> left * right);
    }

    private Map<String, Object> criticalRateLimitOf(List<Map<String, Object>> sources) {
        for (Map<String, Object> source : sources) {
            if (CRITICAL_RATE_LIMIT_KIND.equals(source.get("Kind"))) {
                return orderedMap(
                    "IsActive", true,
                    "SourceName", source.get("SourceName"),
                    "CapPercent", source.get("CapPercent"),
                    "OverflowConversionRatePercent", source.get("OverflowConversionRatePercent"),
                    "MaxConvertedEvolutionDamagePercent", source.get("MaxConvertedEvolutionDamagePercent")
                );
            }
        }

        return orderedMap(
            "IsActive", false,
            "CapPercent", 100,
            "OverflowConversionRatePercent", 0,
            "MaxConvertedEvolutionDamagePercent", 0
        );
    }

    private double convertedEvolutionDamagePercent(double criticalRatePercent, Map<String, Object> criticalRateLimit) {
        if (!Boolean.TRUE.equals(criticalRateLimit.get("IsActive"))) {
            return 0;
        }

        double capPercent = number(criticalRateLimit.get("CapPercent"));
        double conversionRatePercent = number(criticalRateLimit.get("OverflowConversionRatePercent"));
        double maxConvertedEvolutionDamagePercent = number(criticalRateLimit.get("MaxConvertedEvolutionDamagePercent"));
        double overflowPercent = Math.max(0, criticalRatePercent - capPercent);
        double convertedPercent = overflowPercent * conversionRatePercent / 100;

        return roundPercent(Math.min(convertedPercent, maxConvertedEvolutionDamagePercent));
    }

    private List<Map<String, Object>> filterByScope(List<Map<String, Object>> sources, String scope) {
        return sources.stream().filter(source -> scope.equals(source.get("Scope"))).toList();
    }

    private List<String> collectText(JsonNode value) {
        List<String> output = new ArrayList<>();
        collectText(value, output);
        return output;
    }

    private void collectText(JsonNode value, List<String> output) {
        if (value == null || value.isNull()) {
            return;
        }

        if (value.isTextual()) {
            String rawText = value.asString();
            JsonNode tooltip = parseTooltip(rawText);

            if (tooltip != null) {
                collectText(tooltip, output);
                return;
            }

            splitTooltipLines(rawText).stream()
                .map(this::cleanText)
                .filter(text -> !text.isBlank())
                .forEach(output::add);
            return;
        }

        if (value.isArray()) {
            for (JsonNode item : value) {
                collectText(item, output);
            }
            return;
        }

        if (value.isObject()) {
            for (JsonNode item : objectValues(value)) {
                collectText(item, output);
            }
        }
    }

    private List<String> sectionLines(JsonNode sections, String... lineKeys) {
        List<String> lines = new ArrayList<>();

        for (JsonNode section : arrayItems(sections)) {
            lines.addAll(strings(value(section, lineKeys)));
        }

        return lines;
    }

    private List<String> strings(JsonNode node) {
        if (node == null || node.isNull()) {
            return List.of();
        }

        if (node.isArray()) {
            List<String> values = new ArrayList<>();

            for (JsonNode item : node) {
                values.add(item.asString());
            }

            return values;
        }

        return List.of(node.asString());
    }

    private JsonNode value(JsonNode source, String... keys) {
        if (source == null || source.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(source, key);

            if (value != null && !value.isNull() && !(value.isTextual() && value.asString().isEmpty())) {
                return value;
            }
        }

        return null;
    }

    private String textOf(JsonNode source, String... keys) {
        JsonNode value = value(source, keys);

        return value == null ? "" : value.asString();
    }

    private Double numberOf(JsonNode source, String... keys) {
        JsonNode value = value(source, keys);

        if (value == null || value.isNull()) {
            return null;
        }

        if (value.isNumber()) {
            return value.asDouble();
        }

        return parseDouble(value.asString());
    }

    private boolean booleanOf(JsonNode source, boolean fallback, String... keys) {
        Boolean value = nullableBoolean(source, keys);

        return value == null ? fallback : value;
    }

    private Boolean nullableBoolean(JsonNode source, String... keys) {
        JsonNode value = value(source, keys);

        if (value == null || value.isNull()) {
            return null;
        }

        if (value.isBoolean()) {
            return value.asBoolean();
        }

        if (value.isTextual()) {
            return Boolean.parseBoolean(value.asString());
        }

        return null;
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String cleanText(String value) {
        return stripMarkup(value == null ? "" : value)
            .replace("||", " ")
            .replace("\\r", " ")
            .replace("\\n", " ")
            .replace("\\\"", "\"")
            .replaceAll("\\s+", " ")
            .trim();
    }

    private List<String> nonBlank(List<String> values) {
        return values.stream().filter(value -> value != null && !value.isBlank()).toList();
    }

    private double roundPercent(double value) {
        return Math.round((value + 1e-12) * 100) / 100.0;
    }

    private double number(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }

        if (value == null) {
            return 0;
        }

        Double parsed = parseDouble(String.valueOf(value));
        return parsed == null ? 0 : parsed;
    }

    private record SourceContext(String sourceType, String sourceName, String sourceId, String scope, String skillName) {

        static SourceContext global(String sourceType, String sourceName) {
            return new SourceContext(sourceType, sourceName, "", "global", "");
        }
    }

    private record SourceCollection(Set<String> keys, List<Map<String, Object>> sources, Set<String> specialKeys, List<Map<String, Object>> specialSources) {

        SourceCollection() {
            this(new HashSet<>(), new ArrayList<>(), new HashSet<>(), new ArrayList<>());
        }
    }

    private record ArkPassiveProgress(int rank, int level, String text) {
    }
}
