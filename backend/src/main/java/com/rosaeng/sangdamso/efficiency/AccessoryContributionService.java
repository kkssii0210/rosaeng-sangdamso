package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import com.rosaeng.sangdamso.spec.DamageModel;
import com.rosaeng.sangdamso.spec.DamageModel.CriticalRateLimit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class AccessoryContributionService {

    private static final Set<String> ACCESSORY_TYPES = Set.of("목걸이", "귀걸이", "반지");
    private static final Pattern REFINEMENT_SECTION_PATTERN = Pattern.compile("연마");
    private static final Pattern PREFIX_PATTERN = Pattern.compile("^(상|중|하)\\s+");
    private static final Pattern OUTGOING_DAMAGE_PATTERN = Pattern.compile("^(?:적에게\\s*)?주는 피해\\s*\\+?\\s*(?<value>[+-]?\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern ADDITIONAL_DAMAGE_PATTERN = Pattern.compile("^추가 피해\\s*\\+?\\s*(?<value>[+-]?\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern WEAPON_POWER_PATTERN = Pattern.compile("^무기 공격력\\s*\\+?\\s*(?<value>[+-]?\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern ATTACK_POWER_PATTERN = Pattern.compile("^공격력\\s*\\+?\\s*(?<value>[+-]?\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern CRIT_RATE_PATTERN = Pattern.compile("^치명타 적중(?:률)?\\s*\\+?\\s*(?<value>[+-]?\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern CRIT_DAMAGE_PATTERN = Pattern.compile("^치명타 피해\\s*\\+?\\s*(?<value>[+-]?\\d+(?:\\.\\d+)?)\\s*%");
    private static final Pattern UTILITY_PATTERN = Pattern.compile("(?:최대 마나|상태이상 공격 지속시간|공격 및 이동 속도|파티원 보호막 효과|파티원 회복 효과|생명력|깨달음|진화|도약)\\s*\\+?\\s*(?<value>[+-]?\\d+(?:\\.\\d+)?)(?:\\s*%)?");
    private static final Pattern CRIT_RATE_TOOLTIP_PATTERN = Pattern.compile("치명타 적중률(?:이)?\\s*(?<value>\\d+(?:\\.\\d+)?)\\s*%");

    public JsonNode build(JsonNode equipment, JsonNode profile, JsonNode criticalStats) {
        List<Entry> entries = collectAccessoryEntries(equipment);
        CriticalContext context = buildCriticalContext(entries, equipment, profile, criticalStats);
        double currentMultiplier = multiplierFromEntries(entries, context);
        Map<String, Object> lines = new LinkedHashMap<>();

        for (Entry entry : entries) {
            List<Entry> entriesWithoutLine = entries.stream()
                .filter(candidate -> candidate != entry)
                .toList();
            double withoutLineMultiplier = multiplierFromEntries(entriesWithoutLine, context);
            double contributionPercent = "utility".equals(entry.effect().mode())
                ? 0
                : contributionFromMultiplier(currentMultiplier, withoutLineMultiplier);
            lines.put(entry.key(), orderedMap(
                "line", entry.effect().line(),
                "bucket", entry.effect().bucket(),
                "mode", entry.effect().mode(),
                "value", entry.effect().value(),
                "ContributionPercent", contributionPercent,
                "ContributionText", formatContributionPercent(contributionPercent)
            ));
        }

        Map<String, Object> itemTotals = new LinkedHashMap<>();
        for (Integer itemIndex : entries.stream().map(Entry::itemIndex).distinct().toList()) {
            List<Entry> entriesWithoutItem = entries.stream()
                .filter(entry -> entry.itemIndex() != itemIndex)
                .toList();
            double withoutItemMultiplier = multiplierFromEntries(entriesWithoutItem, context);
            itemTotals.put(String.valueOf(itemIndex), contributionFromMultiplier(currentMultiplier, withoutItemMultiplier));
        }

        double totalContributionPercent = DamageModel.toPercent(currentMultiplier - 1);
        return toJsonNode(orderedMap(
            "lines", lines,
            "itemTotals", itemTotals,
            "CriticalContext", orderedMap(
                "AdditionalDamagePercent", roundContribution(DamageModel.toPercent(context.additionalDamage())),
                "CritRatePercent", roundContribution(DamageModel.toPercent(context.critRate())),
                "CritDamageBonusPercent", roundContribution(context.critDamage()),
                "CriticalOutgoingDamagePercent", roundContribution(context.criticalOutgoingDamagePercent()),
                "AttackPowerPercent", roundContribution(DamageModel.toPercent(context.attackPower())),
                "WeaponPowerPercent", roundContribution(DamageModel.toPercent(context.weaponPower())),
                "FixedEvolutionDamagePercent", roundContribution(context.fixedEvolutionDamagePercent()),
                "CriticalRateCapPercent", roundContribution(context.criticalRateLimit().capPercent()),
                "ConvertedEvolutionDamagePercent", roundContribution(DamageModel.convertedEvolutionDamagePercent(
                    DamageModel.toPercent(context.critRate()),
                    context.criticalRateLimit()
                ))
            ),
            "TotalContributionPercent", totalContributionPercent,
            "TotalContributionText", formatContributionPercent(totalContributionPercent)
        ));
    }

    private List<Entry> collectAccessoryEntries(JsonNode equipment) {
        List<Entry> entries = new ArrayList<>();
        List<JsonNode> items = arrayItems(equipment);

        for (int itemIndex = 0; itemIndex < items.size(); itemIndex++) {
            JsonNode item = items.get(itemIndex);
            if (!ACCESSORY_TYPES.contains(textValue(item, "Type", "type"))) {
                continue;
            }

            List<JsonNode> sections = arrayItems(value(item, "DetailSections", "detailSections"));
            for (int sectionIndex = 0; sectionIndex < sections.size(); sectionIndex++) {
                JsonNode section = sections.get(sectionIndex);
                if (!REFINEMENT_SECTION_PATTERN.matcher(textValue(section, "Title", "title")).find()) {
                    continue;
                }

                List<JsonNode> lines = arrayItems(value(section, "Lines", "lines"));
                for (int lineIndex = 0; lineIndex < lines.size(); lineIndex++) {
                    Effect effect = parseAccessoryEffectLine(lines.get(lineIndex).asString());
                    if (effect != null) {
                        entries.add(new Entry(itemIndex + ":" + sectionIndex + ":" + lineIndex, itemIndex, sectionIndex, lineIndex, effect));
                    }
                }
            }
        }

        return entries;
    }

    private Effect parseAccessoryEffectLine(String line) {
        String normalizedLine = PREFIX_PATTERN.matcher(String.valueOf(line).replaceAll("\\s+", " ").trim()).replaceFirst("");
        if (normalizedLine.isBlank()) {
            return null;
        }

        Effect effect = matchEffect(normalizedLine, OUTGOING_DAMAGE_PATTERN, "outgoingDamage", "multiplicative");
        if (effect != null) return effect;
        effect = matchEffect(normalizedLine, ADDITIONAL_DAMAGE_PATTERN, "additionalDamage", "additive");
        if (effect != null) return effect;
        effect = matchEffect(normalizedLine, WEAPON_POWER_PATTERN, "weaponPower", "weaponPower");
        if (effect != null) return effect;
        effect = matchEffect(normalizedLine, ATTACK_POWER_PATTERN, "attackPower", "additive");
        if (effect != null) return effect;
        effect = matchEffect(normalizedLine, CRIT_RATE_PATTERN, "critRate", "critRate");
        if (effect != null) return effect;
        effect = matchEffect(normalizedLine, CRIT_DAMAGE_PATTERN, "critDamage", "critDamage");
        if (effect != null) return effect;
        return matchEffect(normalizedLine, UTILITY_PATTERN, "utility", "utility");
    }

    private Effect matchEffect(String line, Pattern pattern, String bucket, String mode) {
        Matcher matcher = pattern.matcher(line);
        if (!matcher.find()) {
            return null;
        }
        return new Effect(line, bucket, mode, number(matcher.group("value")));
    }

    private CriticalContext buildCriticalContext(List<Entry> entries, JsonNode equipment, JsonNode profile, JsonNode criticalStats) {
        Map<String, Double> entryTotals = sumBuckets(entries);
        double weaponAdditionalDamage = weaponAdditionalDamageFromEquipment(equipment);
        CriticalRateLimit criticalRateLimit = DamageModel.criticalRateLimitFromStats(criticalStats);

        if (criticalStats == null || criticalStats.isNull()) {
            return new CriticalContext(
                DamageModel.toRatio(weaponAdditionalDamage),
                getCritRateFromProfile(profile),
                0,
                0,
                0,
                0,
                0,
                criticalRateLimit
            );
        }

        double criticalRatePercent = numberValue(criticalStats, "GlobalCriticalRatePercent", "globalCriticalRatePercent")
            + numberValue(criticalStats, "ConditionalCriticalRatePercent", "conditionalCriticalRatePercent");
        double criticalDamagePercent = numberValue(criticalStats, "GlobalCriticalDamageBonusPercent", "globalCriticalDamageBonusPercent")
            + numberValue(criticalStats, "ConditionalCriticalDamageBonusPercent", "conditionalCriticalDamageBonusPercent");
        double attackPowerPercent = numberValue(criticalStats, "GlobalAttackPowerPercent", "globalAttackPowerPercent")
            + numberValue(criticalStats, "ConditionalAttackPowerPercent", "conditionalAttackPowerPercent");
        double weaponPowerPercent = numberValue(criticalStats, "GlobalWeaponPowerPercent", "globalWeaponPowerPercent")
            + numberValue(criticalStats, "ConditionalWeaponPowerPercent", "conditionalWeaponPowerPercent");
        double additionalDamagePercent = numberValue(criticalStats, "GlobalAdditionalDamagePercent", "globalAdditionalDamagePercent")
            + numberValue(criticalStats, "ConditionalAdditionalDamagePercent", "conditionalAdditionalDamagePercent");
        double fixedEvolutionDamagePercent = numberValue(criticalStats, "FixedEvolutionDamagePercent", "fixedEvolutionDamagePercent");
        double criticalOutgoingDamagePercent = numberValue(criticalStats, "CriticalOutgoingDamagePercent", "criticalOutgoingDamagePercent")
            + numberValue(criticalStats, "ConditionalCriticalOutgoingDamagePercent", "conditionalCriticalOutgoingDamagePercent");

        return new CriticalContext(
            DamageModel.toRatio(weaponAdditionalDamage + additionalDamagePercent),
            Math.max(0, DamageModel.toRatio(criticalRatePercent - entryTotals.getOrDefault("critRate", 0.0))),
            Math.max(0, criticalDamagePercent - entryTotals.getOrDefault("critDamage", 0.0)),
            Math.max(0, DamageModel.toRatio(attackPowerPercent)),
            Math.max(0, DamageModel.toRatio(weaponPowerPercent)),
            Math.max(0, fixedEvolutionDamagePercent),
            Math.max(0, criticalOutgoingDamagePercent),
            criticalRateLimit
        );
    }

    private Map<String, Double> sumBuckets(List<Entry> entries) {
        Map<String, Double> totals = new LinkedHashMap<>();
        for (Entry entry : entries) {
            totals.put(entry.effect().bucket(), totals.getOrDefault(entry.effect().bucket(), 0.0) + entry.effect().value());
        }
        return totals;
    }

    private double weaponAdditionalDamageFromEquipment(JsonNode equipment) {
        double total = 0;
        for (JsonNode item : arrayItems(equipment)) {
            total += numberValue(value(value(item, "WeaponStats", "weaponStats"), "AdditionalDamage", "additionalDamage"), "Value", "value");
        }
        return total;
    }

    private double multiplierFromEntries(List<Entry> entries, CriticalContext context) {
        Map<String, Double> totals = sumBuckets(entries);
        double additionalDamage = (1 + context.additionalDamage() + DamageModel.toRatio(totals.getOrDefault("additionalDamage", 0.0))) / (1 + context.additionalDamage());
        double attackPower = (1 + context.attackPower() + DamageModel.toRatio(totals.getOrDefault("attackPower", 0.0))) / (1 + context.attackPower());
        double weaponPower = Math.sqrt((1 + context.weaponPower() + DamageModel.toRatio(totals.getOrDefault("weaponPower", 0.0))) / (1 + context.weaponPower()));
        double currentCritRate = context.critRate() + DamageModel.toRatio(totals.getOrDefault("critRate", 0.0));
        double currentCrit = DamageModel.criticalAverageMultiplier(
            DamageModel.toPercent(currentCritRate),
            context.critDamage() + totals.getOrDefault("critDamage", 0.0),
            context.criticalOutgoingDamagePercent(),
            context.criticalRateLimit()
        );
        double baseCrit = DamageModel.criticalAverageMultiplier(
            DamageModel.toPercent(context.critRate()),
            context.critDamage(),
            context.criticalOutgoingDamagePercent(),
            context.criticalRateLimit()
        );
        double evolutionDamage = DamageModel.evolutionDamageMultiplier(
            context.fixedEvolutionDamagePercent(),
            DamageModel.toPercent(currentCritRate),
            DamageModel.toPercent(context.critRate()),
            context.criticalRateLimit()
        );
        return outgoingDamageMultiplier(entries) * additionalDamage * attackPower * weaponPower * (currentCrit / baseCrit) * evolutionDamage;
    }

    private double outgoingDamageMultiplier(List<Entry> entries) {
        double totalOutgoingDamage = entries.stream()
            .filter(entry -> "outgoingDamage".equals(entry.effect().bucket()))
            .mapToDouble(entry -> entry.effect().value())
            .sum();
        return 1 + DamageModel.toRatio(totalOutgoingDamage);
    }

    private double contributionFromMultiplier(double current, double without) {
        if (!Double.isFinite(current) || !Double.isFinite(without) || without <= 0) {
            return 0;
        }
        return DamageModel.toPercent(current / without - 1);
    }

    private String formatContributionPercent(double value) {
        return String.format(java.util.Locale.ROOT, "%.2f%%", roundContribution(value));
    }

    private double roundContribution(double value) {
        return DamageModel.roundPercent(value);
    }

    private double getCritRateFromProfile(JsonNode profile) {
        for (JsonNode stat : arrayItems(value(profile, "Stats", "stats"))) {
            if (!"치명".equals(textValue(stat, "Type", "type"))) {
                continue;
            }
            JsonNode tooltip = value(stat, "Tooltip", "tooltip");
            String text = tooltip != null && tooltip.isArray()
                ? String.join(" ", arrayItems(tooltip).stream().map(JsonNode::asString).toList())
                : (tooltip == null ? "" : tooltip.asString());
            Matcher matcher = CRIT_RATE_TOOLTIP_PATTERN.matcher(text);
            if (matcher.find()) {
                return Math.max(0, Math.min(1, DamageModel.toRatio(number(matcher.group("value")))));
            }
        }
        return 0;
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
        JsonNode value = value(node, keys);
        if (value == null || value.isNull()) {
            return 0;
        }
        if (value.isNumber()) {
            return value.asDouble();
        }
        return number(value.asString());
    }

    private double number(String value) {
        if (value == null || value.isBlank()) {
            return 0;
        }
        try {
            return Double.parseDouble(value.replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private record Entry(String key, int itemIndex, int sectionIndex, int lineIndex, Effect effect) {
    }

    private record Effect(String line, String bucket, String mode, double value) {
    }

    private record CriticalContext(
        double additionalDamage,
        double critRate,
        double critDamage,
        double attackPower,
        double weaponPower,
        double fixedEvolutionDamagePercent,
        double criticalOutgoingDamagePercent,
        CriticalRateLimit criticalRateLimit
    ) {
    }
}
