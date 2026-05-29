package com.rosaeng.sangdamso.spec;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

class UpgradeMarketCostService {

    private static final List<MaterialDefinition> WEAPON_HONING_MATERIALS = List.of(
        new MaterialDefinition("destiny-destruction-stone-crystal", "운명의 파괴석 결정", "honing-materials", List.of("운명의 파괴석 결정"), null, false),
        new MaterialDefinition("great-destiny-leapstone", "위대한 운명의 돌파석", "honing-materials", List.of("위대한 운명의 돌파석"), null, false),
        new MaterialDefinition("superior-abidos-fusion-material", "상급 아비도스 융화제", "honing-materials", List.of("상급 아비도스 융화 재료", "상급 아비도스 융화제"), null, false),
        new MaterialDefinition("destiny-shard", "운명의 파편", "honing-materials", List.of(), Pattern.compile("^운명의 파편 주머니"), false),
        new MaterialDefinition("lava-breath", "용암의 숨결", "honing-supports", List.of("용암의 숨결"), null, true)
    );
    private static final List<MaterialDefinition> ARMOR_HONING_MATERIALS = List.of(
        new MaterialDefinition("destiny-guardian-stone-crystal", "운명의 수호석 결정", "honing-materials", List.of("운명의 수호석 결정"), null, false),
        new MaterialDefinition("great-destiny-leapstone", "위대한 운명의 돌파석", "honing-materials", List.of("위대한 운명의 돌파석"), null, false),
        new MaterialDefinition("superior-abidos-fusion-material", "상급 아비도스 융화제", "honing-materials", List.of("상급 아비도스 융화 재료", "상급 아비도스 융화제"), null, false),
        new MaterialDefinition("destiny-shard", "운명의 파편", "honing-materials", List.of(), Pattern.compile("^운명의 파편 주머니"), false),
        new MaterialDefinition("glacier-breath", "빙하의 숨결", "honing-supports", List.of("빙하의 숨결"), null, true)
    );

    UpgradeCostInputs build(JsonNode snapshot, JsonNode engravingBookPrices) {
        HoningCostInputs honing = buildHoningCostInputs(snapshot);
        List<AvatarCostInput> legendaryAvatars = buildAvatarCostInputs(snapshot);
        Map<Integer, Map<String, GemCostInput>> gemCostIndex = buildGemCostIndex(snapshot);
        List<Map<String, Object>> engravingBooks = arrayItems(engravingBookPrices).stream()
            .map(this::nodeToCostMap)
            .toList();

        return new UpgradeCostInputs(honing, legendaryAvatars, gemCostIndex, engravingBooks, mapOf(honing, legendaryAvatars, gemCostIndex, engravingBooks));
    }

    private HoningCostInputs buildHoningCostInputs(JsonNode snapshot) {
        List<MarketCostItem> materials = groupItems(snapshot, "honing-materials");
        List<MarketCostItem> supports = groupItems(snapshot, "honing-supports");
        List<MaterialInput> weaponMaterials = WEAPON_HONING_MATERIALS.stream()
            .map(material -> buildMaterialInput(snapshot, material))
            .toList();
        List<MaterialInput> armorMaterials = ARMOR_HONING_MATERIALS.stream()
            .map(material -> buildMaterialInput(snapshot, material))
            .toList();

        return new HoningCostInputs(materials, supports, weaponMaterials, armorMaterials);
    }

    private List<AvatarCostInput> buildAvatarCostInputs(JsonNode snapshot) {
        return List.of("무기", "머리", "상의", "하의").stream()
            .map(slot -> {
                MarketCostItem cheapest = groupItems(snapshot, "legendary-avatars").stream()
                    .filter(item -> slot.equals(item.categoryName()))
                    .min(Comparator.comparingDouble(item -> item.currentMinPrice() == null ? Double.MAX_VALUE : item.currentMinPrice()))
                    .orElse(null);

                return new AvatarCostInput(
                    slot,
                    2.0,
                    cheapest == null ? null : cheapest.currentMinPrice(),
                    cheapest == null ? "" : cheapest.name(),
                    "",
                    "snapshot"
                );
            })
            .toList();
    }

    private Map<Integer, Map<String, GemCostInput>> buildGemCostIndex(JsonNode snapshot) {
        Map<Integer, Map<String, GemCostInput>> levels = new LinkedHashMap<>();

        for (MarketCostItem item : groupItems(snapshot, "gems")) {
            if (item.gemLevel() == null || item.gemEffectType().isBlank() || item.currentMinPrice() == null) {
                continue;
            }

            Map<String, GemCostInput> byEffectType = levels.computeIfAbsent(item.gemLevel(), ignored -> new LinkedHashMap<>());
            GemCostInput previous = byEffectType.get(item.gemEffectType());

            if (previous == null || item.currentMinPrice() < previous.minBuyPrice()) {
                byEffectType.put(item.gemEffectType(), new GemCostInput(
                    item.gemLevel(),
                    item.gemEffectType(),
                    item.currentMinPrice(),
                    item.gemEffectValue(),
                    item.name()
                ));
            }
        }

        return levels;
    }

    private MaterialInput buildMaterialInput(JsonNode snapshot, MaterialDefinition material) {
        List<MarketCostItem> marketOptions = groupItems(snapshot, material.groupId()).stream()
            .filter(item -> matchesMaterial(item, material))
            .sorted(Comparator
                .comparingDouble((MarketCostItem item) -> item.unitPrice() == null ? Double.MAX_VALUE : item.unitPrice())
                .thenComparingDouble(item -> item.currentMinPrice() == null ? Double.MAX_VALUE : item.currentMinPrice()))
            .toList();
        MarketCostItem selected = marketOptions.isEmpty() ? null : marketOptions.get(0);

        return new MaterialInput(
            material.key(),
            material.name(),
            selected == null ? "" : selected.name(),
            selected == null ? "" : selected.grade(),
            selected == null ? null : selected.currentMinPrice(),
            selected == null ? null : selected.bundleCount(),
            selected == null ? null : selected.unitPrice(),
            selected == null ? null : selected.recentPrice(),
            selected == null ? null : selected.yesterdayAveragePrice(),
            material.additional(),
            selected != null,
            marketOptions
        );
    }

    private boolean matchesMaterial(MarketCostItem item, MaterialDefinition material) {
        if (material.matchNames().contains(item.name())) {
            return true;
        }

        return material.matchPattern() != null && material.matchPattern().matcher(item.name()).find();
    }

    private List<MarketCostItem> groupItems(JsonNode snapshot, String id) {
        JsonNode group = arrayItems(value(snapshot, "groups", "Groups")).stream()
            .filter(item -> id.equals(textValue(item, "id", "Id")))
            .findFirst()
            .orElse(null);

        return arrayItems(value(group, "items", "Items")).stream()
            .map(this::normalizeMarketCostItem)
            .toList();
    }

    private MarketCostItem normalizeMarketCostItem(JsonNode item) {
        Integer currentMinPrice = intValue(item, "currentMinPrice", "CurrentMinPrice");
        Integer bundleCount = intValue(item, "bundleCount", "BundleCount");
        int normalizedBundleCount = bundleCount == null || bundleCount <= 0 ? 1 : bundleCount;
        Double unitPrice = currentMinPrice == null ? null : round(currentMinPrice / (double) normalizedBundleCount, 4);

        return new MarketCostItem(
            textValue(item, "name", "Name"),
            textValue(item, "grade", "Grade"),
            currentMinPrice,
            normalizedBundleCount,
            unitPrice,
            intValue(item, "recentPrice", "RecentPrice"),
            intValue(item, "yesterdayAveragePrice", "YDayAvgPrice"),
            textValue(item, "categoryName", "CategoryName"),
            intValue(item, "gemLevel", "GemLevel"),
            textValue(item, "gemEffectType", "GemEffectType"),
            doubleValue(item, "gemEffectValue", "GemEffectValue")
        );
    }

    private Map<String, Object> nodeToCostMap(JsonNode node) {
        Map<String, Object> result = new LinkedHashMap<>();

        if (node == null || node.isNull() || !node.isObject()) {
            return result;
        }

        for (String field : node.propertyNames()) {
            JsonNode value = node.get(field);
            if (value == null || value.isNull()) {
                result.put(field, null);
            } else if (value.isNumber()) {
                result.put(field, value.asDouble() % 1 == 0 ? value.asInt() : value.asDouble());
            } else if (value.isBoolean()) {
                result.put(field, value.asBoolean());
            } else {
                result.put(field, value.asString());
            }
        }

        return result;
    }

    private Map<String, Object> mapOf(
        HoningCostInputs honing,
        List<AvatarCostInput> legendaryAvatars,
        Map<Integer, Map<String, GemCostInput>> gemCostIndex,
        List<Map<String, Object>> engravingBooks
    ) {
        return orderedMap(
            "Honing", honing.toMap(),
            "Accessories", orderedMap("FloorPrices", List.of()),
            "EngravingBooks", engravingBooks,
            "LegendaryAvatars", legendaryAvatars.stream().map(AvatarCostInput::toMap).toList(),
            "Gems", gemCostIndex.values().stream()
                .flatMap(byType -> byType.values().stream())
                .map(GemCostInput::toMap)
                .toList()
        );
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

    private Integer intValue(JsonNode node, String... keys) {
        JsonNode value = value(node, keys);

        if (value == null || value.isNull()) {
            return null;
        }

        if (value.isNumber()) {
            return value.asInt();
        }

        try {
            return Integer.parseInt(value.asString().replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Double doubleValue(JsonNode node, String... keys) {
        JsonNode value = value(node, keys);

        if (value == null || value.isNull()) {
            return null;
        }

        if (value.isNumber()) {
            return value.asDouble();
        }

        try {
            return Double.parseDouble(value.asString().replace(",", "").trim());
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    static double round(double value, int digits) {
        double multiplier = Math.pow(10, digits);
        return Math.round((value + 1e-12) * multiplier) / multiplier;
    }

    private record MaterialDefinition(
        String key,
        String name,
        String groupId,
        List<String> matchNames,
        Pattern matchPattern,
        boolean additional
    ) {
    }

    record UpgradeCostInputs(
        HoningCostInputs honing,
        List<AvatarCostInput> legendaryAvatars,
        Map<Integer, Map<String, GemCostInput>> gemCostIndex,
        List<Map<String, Object>> engravingBooks,
        Map<String, Object> asMap
    ) {
    }

    record HoningCostInputs(
        List<MarketCostItem> materials,
        List<MarketCostItem> supports,
        List<MaterialInput> weaponMaterials,
        List<MaterialInput> armorMaterials
    ) {
        Map<String, Object> toMap() {
            return orderedMap(
                "Materials", materials.stream().map(MarketCostItem::toMap).toList(),
                "Supports", supports.stream().map(MarketCostItem::toMap).toList(),
                "WeaponMaterials", weaponMaterials.stream().map(MaterialInput::toMap).toList(),
                "ArmorMaterials", armorMaterials.stream().map(MaterialInput::toMap).toList()
            );
        }
    }

    record MarketCostItem(
        String name,
        String grade,
        Integer currentMinPrice,
        Integer bundleCount,
        Double unitPrice,
        Integer recentPrice,
        Integer yesterdayAveragePrice,
        String categoryName,
        Integer gemLevel,
        String gemEffectType,
        Double gemEffectValue
    ) {
        Map<String, Object> toMap() {
            return orderedMap(
                "Name", name,
                "Grade", grade,
                "CurrentMinPrice", currentMinPrice,
                "BundleCount", bundleCount,
                "UnitPrice", unitPrice,
                "RecentPrice", recentPrice,
                "YesterdayAveragePrice", yesterdayAveragePrice
            );
        }
    }

    record MaterialInput(
        String key,
        String name,
        String sourceName,
        String grade,
        Integer currentMinPrice,
        Integer bundleCount,
        Double unitPrice,
        Integer recentPrice,
        Integer yesterdayAveragePrice,
        boolean additionalMaterial,
        boolean available,
        List<MarketCostItem> marketOptions
    ) {
        Map<String, Object> toMap() {
            return orderedMap(
                "Key", key,
                "Name", name,
                "SourceName", sourceName,
                "Grade", grade,
                "CurrentMinPrice", currentMinPrice,
                "BundleCount", bundleCount,
                "UnitPrice", unitPrice,
                "RecentPrice", recentPrice,
                "YesterdayAveragePrice", yesterdayAveragePrice,
                "IsAdditionalMaterial", additionalMaterial,
                "IsAvailable", available,
                "MarketOptions", marketOptions.stream().map(MarketCostItem::toMap).toList()
            );
        }
    }

    record AvatarCostInput(
        String slot,
        double targetMainStatPercent,
        Integer minPrice,
        String sampleName,
        String className,
        String source
    ) {
        Map<String, Object> toMap() {
            return orderedMap(
                "Slot", slot,
                "TargetMainStatPercent", targetMainStatPercent,
                "MinPrice", minPrice,
                "SampleName", sampleName,
                "ClassName", className,
                "Source", source
            );
        }
    }

    record GemCostInput(
        int level,
        String effectType,
        int minBuyPrice,
        Double effectValue,
        String sampleName
    ) {
        Map<String, Object> toMap() {
            return orderedMap(
                "Level", level,
                "EffectType", effectType,
                "MinBuyPrice", minBuyPrice,
                "EffectValue", effectValue,
                "SampleName", sampleName
            );
        }
    }
}
