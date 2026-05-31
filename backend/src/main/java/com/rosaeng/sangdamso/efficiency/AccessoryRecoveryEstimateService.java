package com.rosaeng.sangdamso.efficiency;

import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.arrayItems;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.child;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.orderedMap;
import static com.rosaeng.sangdamso.character.normalization.ArmoryJsonSupport.toJsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

@Service
public class AccessoryRecoveryEstimateService {

    private final AccessoryNormalizer normalizer;

    public AccessoryRecoveryEstimateService(AccessoryNormalizer normalizer) {
        this.normalizer = normalizer;
    }

    public JsonNode build(JsonNode currentAccessory, JsonNode auctionCandidates, JsonNode recommendation) {
        Summary summary = summarizeExactMatchPrices(currentAccessory, auctionCandidates);
        boolean stableSpread = summary.medianPrice() != null
            && summary.medianPrice() > 0
            && summary.interquartileRange() != null
            && summary.interquartileRange() / (double) summary.medianPrice() <= 0.35;
        boolean highConfidence = summary.count() >= 3 && stableSpread;

        if (!highConfidence) {
            return lowConfidenceEstimate(summary);
        }

        Double buyPrice = positiveNumber(recommendation, "BuyPrice", "buyPrice");
        Double gainPercent = positiveNumber(recommendation, "CombatPowerGainPercent", "combatPowerGainPercent");

        if (buyPrice == null || gainPercent == null) {
            return lowConfidenceEstimate(summary);
        }

        long netCost = Math.max(0L, Math.round(buyPrice) - summary.medianPrice());

        return toJsonNode(orderedMap(
            "Status", "ready",
            "Confidence", "high",
            "EvidenceCount", summary.count(),
            "EstimatedRecoveryGold", summary.medianPrice(),
            "NetCostGold", netCost,
            "NetGoldPerOnePercentCombatPower", Math.round(netCost / gainPercent)
        ));
    }

    Double percentile(List<Integer> sortedValues, double ratio) {
        if (sortedValues == null || sortedValues.isEmpty()) {
            return null;
        }

        double index = (sortedValues.size() - 1) * ratio;
        int lowerIndex = (int) Math.floor(index);
        int upperIndex = (int) Math.ceil(index);

        if (lowerIndex == upperIndex) {
            return sortedValues.get(lowerIndex).doubleValue();
        }

        double lowerValue = sortedValues.get(lowerIndex);
        double upperValue = sortedValues.get(upperIndex);
        return lowerValue + (upperValue - lowerValue) * (index - lowerIndex);
    }

    private Summary summarizeExactMatchPrices(JsonNode currentAccessory, JsonNode auctionCandidates) {
        if (currentAccessory == null || currentAccessory.isNull()) {
            return new Summary(0, null, null);
        }

        String currentFingerprint = normalizer.fingerprint(currentAccessory);
        List<Integer> prices = new ArrayList<>();

        for (JsonNode candidate : arrayItems(auctionCandidates)) {
            if (!currentFingerprint.equals(normalizer.fingerprint(candidate))) {
                continue;
            }

            Integer buyPrice = positiveInteger(candidate, "BuyPrice", "buyPrice");

            if (buyPrice != null) {
                prices.add(buyPrice);
            }
        }

        Collections.sort(prices);

        Double median = percentile(prices, 0.5);
        Double firstQuartile = percentile(prices, 0.25);
        Double thirdQuartile = percentile(prices, 0.75);
        Integer medianPrice = median == null ? null : Math.toIntExact(Math.round(median));
        Integer interquartileRange = firstQuartile == null || thirdQuartile == null
            ? null
            : Math.toIntExact(Math.round(thirdQuartile - firstQuartile));

        return new Summary(prices.size(), medianPrice, interquartileRange);
    }

    private JsonNode lowConfidenceEstimate(Summary summary) {
        return toJsonNode(orderedMap(
            "Status", "lowConfidence",
            "Confidence", "low",
            "EvidenceCount", summary.count(),
            "EstimatedRecoveryGold", summary.medianPrice(),
            "NetCostGold", null,
            "NetGoldPerOnePercentCombatPower", null
        ));
    }

    private Integer positiveInteger(JsonNode node, String... keys) {
        Double value = positiveNumber(node, keys);

        return value == null ? null : Math.toIntExact(Math.round(value));
    }

    private Double positiveNumber(JsonNode node, String... keys) {
        if (node == null || node.isNull()) {
            return null;
        }

        for (String key : keys) {
            JsonNode value = child(node, key);

            if (value == null || value.isNull()) {
                continue;
            }

            Double number = null;

            if (value.isNumber()) {
                number = value.asDouble();
            } else {
                try {
                    number = Double.parseDouble(value.asString().replace(",", "").trim());
                } catch (NumberFormatException exception) {
                    number = null;
                }
            }

            if (number != null && Double.isFinite(number) && number > 0) {
                return number;
            }
        }

        return null;
    }

    private record Summary(int count, Integer medianPrice, Integer interquartileRange) {
    }
}
