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
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class EngravingContributionService {

    private static final String CRIT_RATE_KIND = "critRate";
    private static final String CRIT_DAMAGE_KIND = "critDamage";
    private static final String ATTACK_POWER_KIND = "attackPower";
    private static final String EXPECTED_DAMAGE_PENALTY_KIND = "expectedDamagePenalty";
    private static final Set<String> SUPPORTED_ENGRAVING_NAMES = Set.of("아드레날린", "예리한 둔기");

    public JsonNode build(JsonNode engravings, JsonNode criticalStats) {
        Map<String, Object> result = new LinkedHashMap<>();

        for (JsonNode engraving : arrayItems(engravings)) {
            String name = textValue(engraving, "Name", "name");
            Map<String, Object> contribution = buildContributionForName(criticalStats, name);
            if (contribution != null) {
                result.put(name, contribution);
            }
        }

        return toJsonNode(result);
    }

    private Map<String, Object> buildContributionForName(JsonNode criticalStats, String engravingName) {
        if (!SUPPORTED_ENGRAVING_NAMES.contains(engravingName)) {
            return null;
        }

        List<JsonNode> sources = engravingSources(criticalStats, engravingName);
        List<JsonNode> specialSources = specialEngravingSources(criticalStats, engravingName);
        double ownCritRate = sumKind(sources, CRIT_RATE_KIND);
        double ownCritDamage = sumKind(sources, CRIT_DAMAGE_KIND);
        double ownAttackPower = sumKind(specialSources, ATTACK_POWER_KIND);
        double ownPenaltyMultiplier = ownExpectedPenaltyMultiplier(specialSources);

        if (ownCritRate == 0 && ownCritDamage == 0 && ownAttackPower == 0 && ownPenaltyMultiplier == 1) {
            return null;
        }

        double currentCritRate = totalCriticalRate(criticalStats);
        double currentCritDamage = totalCriticalDamageBonus(criticalStats);
        double currentAttackPower = totalAttackPower(criticalStats);
        double currentFixedEvolutionDamage = fixedEvolutionDamagePercent(criticalStats);
        CriticalRateLimit currentCriticalRateLimit = DamageModel.criticalRateLimitFromStats(criticalStats);
        double currentCriticalOutgoingDamage = criticalOutgoingDamagePercent(criticalStats);
        double currentPenaltyMultiplier = expectedPenaltyMultiplier(criticalStats);

        double currentMultiplier = attackPowerMultiplier(currentAttackPower)
            * DamageModel.criticalAverageMultiplier(
                currentCritRate,
                currentCritDamage,
                currentCriticalOutgoingDamage,
                currentCriticalRateLimit
            )
            * (1 + DamageModel.toRatio(currentFixedEvolutionDamage
                + DamageModel.convertedEvolutionDamagePercent(currentCritRate, currentCriticalRateLimit)))
            * currentPenaltyMultiplier;

        double withoutCritRate = currentCritRate - ownCritRate;
        double withoutMultiplier = attackPowerMultiplier(currentAttackPower - ownAttackPower)
            * DamageModel.criticalAverageMultiplier(
                withoutCritRate,
                currentCritDamage - ownCritDamage,
                currentCriticalOutgoingDamage,
                currentCriticalRateLimit
            )
            * (1 + DamageModel.toRatio(currentFixedEvolutionDamage
                + DamageModel.convertedEvolutionDamagePercent(withoutCritRate, currentCriticalRateLimit)))
            * (currentPenaltyMultiplier / ownPenaltyMultiplier);

        Double contribution = contributionFromMultiplier(currentMultiplier, withoutMultiplier);
        if (contribution == null) {
            return null;
        }

        return orderedMap(
            "ContributionPercent", contribution,
            "ContributionText", formatEngravingContributionPercent(contribution),
            "CriticalRatePercent", ownCritRate,
            "CriticalDamageBonusPercent", ownCritDamage,
            "AttackPowerPercent", ownAttackPower,
            "ExpectedDamagePenaltyMultiplier", ownPenaltyMultiplier,
            "ConvertedEvolutionDamagePercent", roundContribution(DamageModel.convertedEvolutionDamagePercent(currentCritRate, currentCriticalRateLimit)),
            "WithoutConvertedEvolutionDamagePercent", roundContribution(DamageModel.convertedEvolutionDamagePercent(withoutCritRate, currentCriticalRateLimit))
        );
    }

    private List<JsonNode> engravingSources(JsonNode criticalStats, String engravingName) {
        return allSources(criticalStats).stream()
            .filter(source -> "engraving".equals(textValue(source, "SourceType", "sourceType"))
                && engravingName.equals(textValue(source, "SourceName", "sourceName")))
            .toList();
    }

    private List<JsonNode> specialEngravingSources(JsonNode criticalStats, String engravingName) {
        return arrayItems(value(criticalStats, "SpecialEngravingSources", "specialEngravingSources")).stream()
            .filter(source -> "engraving".equals(textValue(source, "SourceType", "sourceType"))
                && engravingName.equals(textValue(source, "SourceName", "sourceName")))
            .toList();
    }

    private List<JsonNode> allSources(JsonNode criticalStats) {
        List<JsonNode> sources = new ArrayList<>();
        sources.addAll(arrayItems(value(criticalStats, "GlobalSources", "globalSources")));
        sources.addAll(arrayItems(value(criticalStats, "ConditionalSources", "conditionalSources")));
        return sources;
    }

    private double sumKind(List<JsonNode> sources, String kind) {
        return sources.stream()
            .filter(source -> kind.equals(textValue(source, "Kind", "kind")))
            .mapToDouble(source -> numberValue(source, "Value", "value"))
            .sum();
    }

    private double ownExpectedPenaltyMultiplier(List<JsonNode> specialSources) {
        double multiplier = 1;
        for (JsonNode source : specialSources) {
            if (!EXPECTED_DAMAGE_PENALTY_KIND.equals(textValue(source, "Kind", "kind"))) {
                continue;
            }
            double sourceMultiplier = numberValue(source, 1, "Multiplier", "multiplier");
            multiplier *= sourceMultiplier > 0 ? sourceMultiplier : 1;
        }
        return multiplier;
    }

    private double totalCriticalRate(JsonNode criticalStats) {
        return numberValue(criticalStats, "GlobalCriticalRatePercent", "globalCriticalRatePercent")
            + numberValue(criticalStats, "ConditionalCriticalRatePercent", "conditionalCriticalRatePercent");
    }

    private double totalCriticalDamageBonus(JsonNode criticalStats) {
        return numberValue(criticalStats, "GlobalCriticalDamageBonusPercent", "globalCriticalDamageBonusPercent")
            + numberValue(criticalStats, "ConditionalCriticalDamageBonusPercent", "conditionalCriticalDamageBonusPercent");
    }

    private double totalAttackPower(JsonNode criticalStats) {
        return numberValue(criticalStats, "GlobalAttackPowerPercent", "globalAttackPowerPercent")
            + numberValue(criticalStats, "ConditionalAttackPowerPercent", "conditionalAttackPowerPercent");
    }

    private double fixedEvolutionDamagePercent(JsonNode criticalStats) {
        return numberValue(criticalStats, "FixedEvolutionDamagePercent", "fixedEvolutionDamagePercent");
    }

    private double criticalOutgoingDamagePercent(JsonNode criticalStats) {
        return numberValue(criticalStats, "CriticalOutgoingDamagePercent", "criticalOutgoingDamagePercent")
            + numberValue(criticalStats, "ConditionalCriticalOutgoingDamagePercent", "conditionalCriticalOutgoingDamagePercent");
    }

    private double attackPowerMultiplier(double attackPowerPercent) {
        return 1 + DamageModel.toRatio(Math.max(0, attackPowerPercent));
    }

    private double expectedPenaltyMultiplier(JsonNode criticalStats) {
        double multiplier = numberValue(criticalStats, 1, "ExpectedDamagePenaltyMultiplier", "expectedDamagePenaltyMultiplier");
        return multiplier > 0 ? multiplier : 1;
    }

    private Double contributionFromMultiplier(double current, double without) {
        if (!Double.isFinite(current) || !Double.isFinite(without) || without <= 0) {
            return null;
        }
        return (current / without - 1) * 100;
    }

    private String formatEngravingContributionPercent(double value) {
        return String.format(java.util.Locale.ROOT, "%.2f%%", roundContribution(value));
    }

    private double roundContribution(double value) {
        if (!Double.isFinite(value)) {
            return 0;
        }
        return Math.round((value + Math.ulp(1.0)) * 100.0) / 100.0;
    }

    private JsonNode value(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }
        for (String key : keys) {
            JsonNode value = child(node, key);
            if (value != null && !value.isNull() && !(value.isTextual() && value.asString().isEmpty())) {
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
        return numberValue(node, 0, keys);
    }

    private double numberValue(JsonNode node, double fallback, String... keys) {
        JsonNode value = value(node, keys);
        if (value == null || value.isNull()) {
            return fallback;
        }
        if (value.isNumber()) {
            return value.asDouble();
        }
        try {
            return Double.parseDouble(value.asString().replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }
}
