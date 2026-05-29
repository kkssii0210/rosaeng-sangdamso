package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

public class UpgradeEfficiencyService {

    private static final Pattern HONING_LEVEL_PATTERN = Pattern.compile("\\+(?<level>\\d+)");
    private final UpgradeMarketCostService marketCostService = new UpgradeMarketCostService();
    private final UpgradeCombatPowerEstimator combatPowerEstimator = new UpgradeCombatPowerEstimator();

    public JsonNode build(Map<String, JsonNode> context) {
        JsonNode marketSnapshot = context.get("marketSnapshot");
        boolean marketReady = marketSnapshot != null && !marketSnapshot.isNull();

        if (!marketReady) {
            return toJsonNode(orderedMap(
                "MarketDataStatus", "unavailable",
                "UpdatedAt", "",
                "CostInputs", null,
                "Candidates", List.of(),
                "Insights", List.of(),
                "MissingInputs", List.of("거래소/경매장 가격 스냅샷"),
                "Inputs", orderedMap("HasMarketSnapshot", false)
            ));
        }

        UpgradeMarketCostService.UpgradeCostInputs costInputs = marketCostService.build(
            marketSnapshot,
            context.get("engravingBookPrices")
        );
        List<Map<String, Object>> candidates = new ArrayList<>();

        candidates.addAll(buildHoningCandidates(context.get("equipment"), costInputs.honing()));
        candidates.addAll(buildAvatarCandidates(context.get("avatars"), costInputs.legendaryAvatars()));
        candidates.addAll(buildGemCandidates(context, costInputs.gemCostIndex()));
        candidates.addAll(buildEngravingBookCandidates(context, costInputs.engravingBooks()));
        candidates.sort(Comparator.comparingDouble(this::efficiencyScore).reversed());

        return toJsonNode(orderedMap(
            "MarketDataStatus", "ready",
            "UpdatedAt", textValue(marketSnapshot, "updatedAt", "UpdatedAt"),
            "CostInputs", costInputs.asMap(),
            "Candidates", candidates,
            "Insights", List.of(),
            "MissingInputs", buildMissingInputs(costInputs),
            "Inputs", orderedMap(
                "HasMarketSnapshot", true
            )
        ));
    }

    private List<Map<String, Object>> buildHoningCandidates(JsonNode equipment, UpgradeMarketCostService.HoningCostInputs costInputs) {
        List<Map<String, Object>> candidates = new ArrayList<>();
        List<JsonNode> items = arrayItems(equipment);
        JsonNode weapon = items.stream()
            .filter(item -> "무기".equals(textValue(item, "Type", "type")))
            .findFirst()
            .orElse(null);
        Integer currentWeaponLevel = inferWeaponHoningLevel(weapon);

        if (weapon != null && currentWeaponLevel != null && currentWeaponLevel >= 11 && currentWeaponLevel < 25) {
            int targetLevel = currentWeaponLevel + 1;
            Double currentWeaponPower = UpgradeEfficiencyConstants.WEAPON_POWER_BY_LEVEL.get(currentWeaponLevel);
            Double nextWeaponPower = UpgradeEfficiencyConstants.WEAPON_POWER_BY_LEVEL.get(targetLevel);
            Map<String, Object> cost = expectedHoningCost("weapon", targetLevel, costInputs);

            if (currentWeaponPower != null && nextWeaponPower != null && cost != null) {
                double gainPercent = (Math.sqrt(nextWeaponPower / currentWeaponPower) - 1) * 100;
                candidates.add(candidate(
                    "weapon-honing-" + currentWeaponLevel + "-" + targetLevel,
                    "weaponHoning",
                    "무기 " + currentWeaponLevel + "->" + targetLevel,
                    (Number) cost.get("ExpectedCostGold"),
                    gainPercent,
                    "combatPower",
                    "무기",
                    currentWeaponLevel,
                    targetLevel,
                    cost,
                    (((Number) cost.get("BreathCount")).intValue() > 0 ? cost.get("BreathName") : "노숨") + " 기대비용 기준"
                ));
            }
        }

        double mainStatTotal = items.stream()
            .mapToDouble(item -> numberValue(item, "MainStatValue", "mainStatValue"))
            .sum();

        if (mainStatTotal <= 0) {
            return candidates;
        }

        for (JsonNode item : items) {
            String slot = textValue(item, "Type", "type");
            List<Double> slotStats = UpgradeEfficiencyConstants.ARMOR_MAIN_STAT_BY_SLOT.get(slot);

            if (slotStats == null) {
                continue;
            }

            Integer currentLevel = inferArmorHoningLevel(item);

            if (currentLevel == null || currentLevel < 11 || currentLevel >= 25) {
                continue;
            }

            int index = currentLevel - 11;
            int targetLevel = currentLevel + 1;

            if (index < 0 || index + 1 >= slotStats.size()) {
                continue;
            }

            double gainStat = slotStats.get(index + 1) - slotStats.get(index);
            Map<String, Object> cost = expectedHoningCost("armor", targetLevel, costInputs);

            if (gainStat <= 0 || cost == null) {
                continue;
            }

            double gainPercent = (Math.sqrt((mainStatTotal + gainStat) / mainStatTotal) - 1) * 100;
            candidates.add(candidate(
                "armor-honing-" + slot + "-" + currentLevel + "-" + targetLevel,
                "armorHoning",
                slot + " " + currentLevel + "->" + targetLevel,
                (Number) cost.get("ExpectedCostGold"),
                gainPercent,
                "combatPower",
                slot,
                currentLevel,
                targetLevel,
                cost,
                (((Number) cost.get("BreathCount")).intValue() > 0 ? cost.get("BreathName") : "노숨") + " 기대비용 기준"
            ));
        }

        return candidates;
    }

    private List<Map<String, Object>> buildAvatarCandidates(
        JsonNode avatars,
        List<UpgradeMarketCostService.AvatarCostInput> costInputs
    ) {
        List<Map<String, Object>> candidates = new ArrayList<>();

        for (UpgradeMarketCostService.AvatarCostInput costInput : costInputs) {
            if (costInput.minPrice() == null || costInput.minPrice() <= 0) {
                continue;
            }

            double currentValue = avatarSlotCurrentValue(avatars, costInput.slot());
            double gainPercent = costInput.targetMainStatPercent() - currentValue;

            if (gainPercent <= 0) {
                continue;
            }

            candidates.add(candidate(
                "legendary-avatar-" + costInput.slot(),
                "legendaryAvatar",
                costInput.className().isBlank()
                    ? "전설 아바타 " + costInput.slot()
                    : costInput.className() + " 전설 아바타 " + costInput.slot(),
                costInput.minPrice(),
                gainPercent,
                "mainStatPercent",
                costInput.slot(),
                null,
                null,
                costInput.toMap(),
                "아바타 주스탯 기준. 실제 최종 피해 환산은 주스탯-공격력 모델 필요"
            ));
        }

        return candidates;
    }

    private List<Map<String, Object>> buildGemCandidates(
        Map<String, JsonNode> context,
        Map<Integer, Map<String, UpgradeMarketCostService.GemCostInput>> gemCostIndex
    ) {
        JsonNode gems = context.get("gems");
        Double currentEstimate = combatPowerEstimator.estimate(
            context.get("profile"),
            context.get("equipment"),
            context.get("engravings"),
            gems
        );

        if (currentEstimate == null || currentEstimate <= 0) {
            return List.of();
        }

        List<Map<String, Object>> candidates = new ArrayList<>();
        List<JsonNode> currentGems = arrayItems(gems);

        for (int index = 0; index < currentGems.size(); index++) {
            JsonNode gem = currentGems.get(index);
            int currentLevel = (int) numberValue(gem, "Level", "level");
            String effectType = textValue(gem, "EffectType", "effectType");
            int targetLevel = currentLevel + 1;

            if (currentLevel <= 0 || currentLevel >= 10 || effectType.isBlank()) {
                continue;
            }

            UpgradeMarketCostService.GemCostInput currentPrice = gemCostIndex.getOrDefault(currentLevel, Map.of()).get(effectType);
            UpgradeMarketCostService.GemCostInput nextPrice = gemCostIndex.getOrDefault(targetLevel, Map.of()).get(effectType);

            if (nextPrice == null || nextPrice.minBuyPrice() <= 0) {
                continue;
            }

            int rawNetCost = currentPrice == null ? nextPrice.minBuyPrice() : nextPrice.minBuyPrice() - currentPrice.minBuyPrice();
            int netCostGold = rawNetCost > 0 ? rawNetCost : nextPrice.minBuyPrice();
            JsonNode nextGems = gemsWithTargetLevel(currentGems, index, targetLevel, nextPrice);
            Double nextEstimate = combatPowerEstimator.estimate(
                context.get("profile"),
                context.get("equipment"),
                context.get("engravings"),
                nextGems
            );

            if (nextEstimate == null || nextEstimate <= currentEstimate) {
                continue;
            }

            double gainPercent = ((nextEstimate / currentEstimate) - 1) * 100;
            String target = textValue(gem, "SkillName", "skillName");
            if (target.isBlank()) {
                target = textValue(gem, "Name", "name");
            }
            if (target.isBlank()) {
                target = "보석";
            }

            Map<String, Object> costDetail = orderedMap(
                "CurrentPrice", currentPrice == null ? null : currentPrice.toMap(),
                "NextPrice", nextPrice.toMap()
            );
            Map<String, Object> candidate = candidate(
                "gem-" + textValue(gem, "Slot", "slot") + "-" + currentLevel + "-" + targetLevel,
                "gem",
                target + " " + currentLevel + "->" + targetLevel,
                nextPrice.minBuyPrice(),
                gainPercent,
                "combatPower",
                target,
                currentLevel,
                targetLevel,
                costDetail,
                "보석 최저가 순비용, 기본공%는 레벨별 추정"
            );
            candidate.put("NetCostGold", netCostGold);
            candidate.put("EfficiencyScore", efficiencyPer100kGold(gainPercent, netCostGold));
            candidate.put("EffectType", effectType);
            candidates.add(candidate);
        }

        return candidates;
    }

    private List<Map<String, Object>> buildEngravingBookCandidates(
        Map<String, JsonNode> context,
        List<Map<String, Object>> engravingBookPrices
    ) {
        JsonNode engravings = context.get("engravings");
        Double currentEstimate = combatPowerEstimator.estimate(
            context.get("profile"),
            context.get("equipment"),
            engravings,
            context.get("gems")
        );

        if (currentEstimate == null || currentEstimate <= 0) {
            return List.of();
        }

        List<Map<String, Object>> candidates = new ArrayList<>();
        List<JsonNode> currentEngravings = arrayItems(engravings);

        for (int index = 0; index < currentEngravings.size(); index++) {
            JsonNode engraving = currentEngravings.get(index);
            String name = cleanKey(textValue(engraving, "Name", "name"));
            int currentLevel = Math.min(4, Math.max(0, (int) numberValue(engraving, "Level", "level")));
            int targetLevel = currentLevel + 1;
            Map<String, Object> price = findEngravingBookPrice(engravingBookPrices, name);
            Double costGold = number(price == null ? null : price.get("CostForFiveBooks"));

            if (name.isBlank() || currentLevel >= 4 || costGold == null || costGold <= 0) {
                continue;
            }

            JsonNode nextEngravings = engravingsWithTargetLevel(currentEngravings, index, targetLevel);
            Double nextEstimate = combatPowerEstimator.estimate(
                context.get("profile"),
                context.get("equipment"),
                nextEngravings,
                context.get("gems")
            );

            if (nextEstimate == null || nextEstimate <= currentEstimate) {
                continue;
            }

            double gainPercent = ((nextEstimate / currentEstimate) - 1) * 100;
            String displayName = textValue(engraving, "Name", "name");
            Map<String, Object> candidate = candidate(
                "engraving-book-" + index + "-" + name + "-" + currentLevel + "-" + targetLevel,
                "engravingBook",
                displayName + " 각인 " + currentLevel + "->" + targetLevel,
                round(costGold, 0),
                gainPercent,
                "combatPower",
                displayName,
                currentLevel,
                targetLevel,
                price,
                "유물 각인서 5권 기준"
            );
            candidate.put("BookCount", 5);
            candidate.put("UnitPrice", number(price.get("UnitPrice")));
            candidates.add(candidate);
        }

        return candidates;
    }

    private Map<String, Object> candidate(
        String id,
        String type,
        String label,
        Number costGold,
        double gainPercent,
        String gainType,
        String target,
        Integer currentLevel,
        Integer targetLevel,
        Object costDetail,
        String caveat
    ) {
        double roundedGainPercent = round(gainPercent, 4);
        double roundedCostGold = costGold == null ? 0 : costGold.doubleValue();

        return orderedMap(
            "Id", id,
            "Type", type,
            "Label", label,
            "CostGold", wholeNumberWhenPossible(roundedCostGold),
            "NetCostGold", wholeNumberWhenPossible(roundedCostGold),
            "GainPercent", roundedGainPercent,
            "GainType", gainType,
            "EfficiencyScore", efficiencyPer100kGold(roundedGainPercent, roundedCostGold),
            "ScoreUnit", "combatPower".equals(gainType) ? "전투력 % / 10만 골드" : "주스탯 % / 10만 골드",
            "Target", target,
            "CurrentLevel", currentLevel,
            "TargetLevel", targetLevel,
            "CostDetail", costDetail,
            "Caveat", caveat
        );
    }

    private Map<String, Object> expectedHoningCost(
        String type,
        int targetLevel,
        UpgradeMarketCostService.HoningCostInputs costInputs
    ) {
        UpgradeEfficiencyConstants.HoningAmounts amounts = "weapon".equals(type)
            ? UpgradeEfficiencyConstants.WEAPON_HONING_AMOUNTS_BY_TARGET_LEVEL.get(targetLevel)
            : UpgradeEfficiencyConstants.ARMOR_HONING_AMOUNTS_BY_TARGET_LEVEL.get(targetLevel);
        Double baseProbability = UpgradeEfficiencyConstants.HONING_PROBABILITY_BY_TARGET_LEVEL.get(targetLevel);
        UpgradeEfficiencyConstants.HoningBreath breath = UpgradeEfficiencyConstants.HONING_BREATH_BY_TARGET_LEVEL.get(targetLevel);
        Map<String, Double> prices = honingUnitPrices(costInputs, type);

        if (amounts == null || baseProbability == null || breath == null || !hasAllPrices(prices)) {
            return null;
        }

        double baseCost = amounts.gold()
            + amounts.stone() * prices.get("stone")
            + amounts.leapstone() * prices.get("leapstone")
            + amounts.fusion() * prices.get("fusion")
            + amounts.shard() * prices.get("shard");
        double noBreathCost = expectedHoningCostForBreathCount(baseCost, prices.get("breath"), baseProbability, breath, 0);
        double fullBreathCost = expectedHoningCostForBreathCount(baseCost, prices.get("breath"), baseProbability, breath, breath.max());
        boolean useFullBreath = fullBreathCost < noBreathCost;
        double expectedCost = useFullBreath ? fullBreathCost : noBreathCost;

        return orderedMap(
            "ExpectedCostGold", round(expectedCost, 0),
            "NoBreathExpectedCostGold", round(noBreathCost, 0),
            "FullBreathExpectedCostGold", round(fullBreathCost, 0),
            "BreathCount", useFullBreath ? breath.max() : 0,
            "BreathName", "weapon".equals(type) ? "용암의 숨결" : "빙하의 숨결",
            "BaseSuccessRate", baseProbability * 100
        );
    }

    private double expectedHoningCostForBreathCount(
        double baseCost,
        double breathPrice,
        double baseProbability,
        UpgradeEfficiencyConstants.HoningBreath breath,
        int breathCount
    ) {
        return expectedHoningCostRecursive(baseCost, breathPrice, baseProbability, baseProbability, 0, breath, breathCount, new LinkedHashMap<>());
    }

    private double expectedHoningCostRecursive(
        double baseCost,
        double breathPrice,
        double baseProbability,
        double currentProbability,
        double jangin,
        UpgradeEfficiencyConstants.HoningBreath breath,
        int breathCount,
        Map<String, Double> memo
    ) {
        if (jangin >= 1) {
            return baseCost;
        }

        String key = round4(currentProbability) + "|" + round4(jangin);
        Double cached = memo.get(key);

        if (cached != null) {
            return cached;
        }

        double totalProbability = round4(Math.min(currentProbability + breathCount * breath.probability(), 1));
        double nextProbability = Math.min(currentProbability + baseProbability * 0.1, baseProbability * 2);
        double nextJangin = jangin + totalProbability / UpgradeEfficiencyConstants.JANGIN_ACCUMULATE_DIVIDER;
        double result = baseCost
            + breathCount * breathPrice
            + (1 - totalProbability) * expectedHoningCostRecursive(
                baseCost,
                breathPrice,
                baseProbability,
                nextProbability,
                nextJangin,
                breath,
                breathCount,
                memo
            );

        memo.put(key, result);
        return result;
    }

    private Map<String, Double> honingUnitPrices(UpgradeMarketCostService.HoningCostInputs costInputs, String type) {
        String stoneName = "weapon".equals(type) ? "운명의 파괴석 결정" : "운명의 수호석 결정";
        String breathName = "weapon".equals(type) ? "용암의 숨결" : "빙하의 숨결";
        Map<String, Double> prices = new LinkedHashMap<>();

        prices.put("stone", materialUnitPrice(costInputs, stoneName));
        prices.put("leapstone", materialUnitPrice(costInputs, "위대한 운명의 돌파석"));
        prices.put("fusion", materialUnitPrice(costInputs, "상급 아비도스 융화제"));
        prices.put("shard", shardUnitPrice(material(costInputs, "운명의 파편")));
        prices.put("breath", materialUnitPrice(costInputs, breathName));
        return prices;
    }

    private UpgradeMarketCostService.MaterialInput material(UpgradeMarketCostService.HoningCostInputs costInputs, String name) {
        return allMaterials(costInputs).stream()
            .filter(item -> name.equals(item.name()))
            .findFirst()
            .orElse(null);
    }

    private List<UpgradeMarketCostService.MaterialInput> allMaterials(UpgradeMarketCostService.HoningCostInputs costInputs) {
        List<UpgradeMarketCostService.MaterialInput> materials = new ArrayList<>();
        materials.addAll(costInputs.weaponMaterials());
        materials.addAll(costInputs.armorMaterials());
        return materials;
    }

    private Double materialUnitPrice(UpgradeMarketCostService.HoningCostInputs costInputs, String name) {
        UpgradeMarketCostService.MaterialInput material = material(costInputs, name);
        return material == null ? null : material.unitPrice();
    }

    private Double shardUnitPrice(UpgradeMarketCostService.MaterialInput material) {
        if (material == null) {
            return null;
        }

        return material.marketOptions().stream()
            .map(option -> {
                Integer shardCount = UpgradeEfficiencyConstants.SHARD_POUCH_SIZES.get(option.name());
                return shardCount == null || option.currentMinPrice() == null
                    ? null
                    : option.currentMinPrice() / (double) shardCount;
            })
            .filter(price -> price != null && price > 0)
            .min(Double::compareTo)
            .orElse(null);
    }

    private boolean hasAllPrices(Map<String, Double> prices) {
        return prices.values().stream().allMatch(price -> price != null && price > 0);
    }

    private Integer inferWeaponHoningLevel(JsonNode item) {
        Integer parsed = parseHoningLevel(item);

        if (parsed != null) {
            return parsed;
        }

        double weaponPower = numberValue(value(value(item, "WeaponStats", "weaponStats"), "WeaponPower", "weaponPower"), "Value", "value");

        return UpgradeEfficiencyConstants.WEAPON_POWER_BY_LEVEL.entrySet().stream()
            .filter(entry -> Math.abs(entry.getValue() - weaponPower) < 0.0001)
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse(null);
    }

    private Integer inferArmorHoningLevel(JsonNode item) {
        Integer parsed = parseHoningLevel(item);

        if (parsed != null) {
            return parsed;
        }

        String type = textValue(item, "Type", "type");
        double mainStatValue = numberValue(item, "MainStatValue", "mainStatValue");
        List<Double> stats = UpgradeEfficiencyConstants.ARMOR_MAIN_STAT_BY_SLOT.get(type);

        if (stats == null || mainStatValue <= 0) {
            return null;
        }

        for (int index = 0; index < stats.size(); index++) {
            if (Math.abs(stats.get(index) - mainStatValue) < 0.0001) {
                return 11 + index;
            }
        }

        return null;
    }

    private Integer parseHoningLevel(JsonNode item) {
        String name = textValue(item, "Name", "name");
        Matcher matcher = HONING_LEVEL_PATTERN.matcher(name);

        if (!matcher.find()) {
            return null;
        }

        return (int) numberValue(matcher.group("level"));
    }

    private double avatarSlotCurrentValue(JsonNode avatars, String slot) {
        double currentValue = 0;

        for (JsonNode avatar : arrayItems(avatars)) {
            String type = textValue(avatar, "Type", "type");

            if (!type.contains(slot) || !isAvatarStatApplied(avatar)) {
                continue;
            }

            for (JsonNode effect : arrayItems(value(avatar, "StatEffects", "statEffects"))) {
                currentValue = Math.max(currentValue, numberValue(effect, "Value", "value"));
            }
        }

        return currentValue;
    }

    private boolean isAvatarStatApplied(JsonNode avatar) {
        JsonNode isStatApplied = value(avatar, "IsStatApplied", "isStatApplied", "IsInner", "isInner");
        return isStatApplied != null && isStatApplied.asBoolean(false);
    }

    private JsonNode gemsWithTargetLevel(
        List<JsonNode> currentGems,
        int targetIndex,
        int targetLevel,
        UpgradeMarketCostService.GemCostInput nextPrice
    ) {
        List<Map<String, Object>> gems = new ArrayList<>();

        for (int index = 0; index < currentGems.size(); index++) {
            JsonNode gem = currentGems.get(index);
            boolean isTarget = index == targetIndex;
            int level = isTarget ? targetLevel : (int) numberValue(gem, "Level", "level");
            List<Map<String, Object>> additionalEffects = additionalEffectsForGem(gem, level);

            gems.add(orderedMap(
                "Slot", (int) numberValue(gem, "Slot", "slot"),
                "Name", textValue(gem, "Name", "name"),
                "Level", level,
                "SkillName", textValue(gem, "SkillName", "skillName"),
                "EffectType", textValue(gem, "EffectType", "effectType"),
                "EffectValue", isTarget && nextPrice.effectValue() != null
                    ? nextPrice.effectValue()
                    : numberValue(gem, "EffectValue", "effectValue"),
                "AdditionalEffects", additionalEffects
            ));
        }

        return toJsonNode(gems);
    }

    private List<Map<String, Object>> additionalEffectsForGem(JsonNode gem, int level) {
        List<Map<String, Object>> effects = new ArrayList<>();

        for (JsonNode effect : arrayItems(value(gem, "AdditionalEffects", "additionalEffects"))) {
            if (!"기본 공격력".equals(textValue(effect, "Name", "name"))) {
                effects.add(orderedMap(
                    "Name", textValue(effect, "Name", "name"),
                    "Value", numberValue(effect, "Value", "value"),
                    "Unit", textValue(effect, "Unit", "unit"),
                    "Direction", textValue(effect, "Direction", "direction")
                ));
            }
        }

        Double basicAttackPercent = UpgradeEfficiencyConstants.GEM_BASIC_ATTACK_PERCENT_BY_LEVEL.get(level);

        if (basicAttackPercent != null) {
            effects.add(orderedMap("Name", "기본 공격력", "Value", basicAttackPercent, "Unit", "%", "Direction", "증가"));
        }

        return effects;
    }

    private JsonNode engravingsWithTargetLevel(List<JsonNode> currentEngravings, int targetIndex, int targetLevel) {
        List<Map<String, Object>> engravings = new ArrayList<>();

        for (int index = 0; index < currentEngravings.size(); index++) {
            JsonNode engraving = currentEngravings.get(index);
            engravings.add(orderedMap(
                "Name", textValue(engraving, "Name", "name"),
                "Grade", index == targetIndex ? "유물" : textValue(engraving, "Grade", "grade"),
                "Level", index == targetIndex ? targetLevel : (int) numberValue(engraving, "Level", "level"),
                "AbilityStoneLevel", (int) numberValue(engraving, "AbilityStoneLevel", "abilityStoneLevel")
            ));
        }

        return toJsonNode(engravings);
    }

    private Map<String, Object> findEngravingBookPrice(List<Map<String, Object>> engravingBookPrices, String name) {
        return engravingBookPrices.stream()
            .filter(price -> name.equals(cleanKey(String.valueOf(price.getOrDefault("EngravingName", "")))))
            .findFirst()
            .orElse(null);
    }

    private List<String> buildMissingInputs(UpgradeMarketCostService.UpgradeCostInputs costInputs) {
        List<String> missing = new ArrayList<>();
        List<String> missingMaterials = allMaterials(costInputs.honing()).stream()
            .filter(item -> !item.available())
            .map(UpgradeMarketCostService.MaterialInput::name)
            .distinct()
            .toList();

        if (!missingMaterials.isEmpty()) {
            missing.add("강화 재료 시세 누락: " + String.join(", ", missingMaterials));
        }

        missing.add("악세 효율: 목표 옵션 필터와 후보 악세 옵션별 기여도");
        missing.add("보석 최종 피해 효율: 스킬별 실제 딜 지분");
        return missing;
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
        return numberValue(value(node, keys));
    }

    private double numberValue(Object value) {
        Double number = number(value);
        return number == null ? 0 : number;
    }

    private Double number(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof Number number) {
            return number.doubleValue();
        }

        if (value instanceof JsonNode node) {
            if (node.isNull()) {
                return null;
            }

            if (node.isNumber()) {
                return node.asDouble();
            }

            value = node.asString();
        }

        try {
            return Double.parseDouble(String.valueOf(value).replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String cleanKey(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "").trim();
    }

    private double round(double value, int digits) {
        return UpgradeMarketCostService.round(value, digits);
    }

    private double round4(double value) {
        return Math.round(value * 10000) / 10000.0;
    }

    private double efficiencyPer100kGold(double gainPercent, double costGold) {
        if (!Double.isFinite(gainPercent) || !Double.isFinite(costGold) || costGold <= 0) {
            return 0;
        }

        return round(gainPercent / costGold * 100000, 4);
    }

    private double efficiencyScore(Map<String, Object> candidate) {
        return numberValue(candidate.get("EfficiencyScore"));
    }

    private Number wholeNumberWhenPossible(double value) {
        return value % 1 == 0 ? (long) value : value;
    }
}
