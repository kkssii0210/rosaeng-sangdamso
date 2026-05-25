import { buildAccessoryFingerprint } from "../lostark/accessoryAuction.js";

function valueFromSectionLine(accessory, title) {
  const line = accessory.DetailSections?.find((section) => section.title === title)?.lines?.[0];
  const valueText = line?.split(" +")?.[1];
  const value = Number(valueText?.replaceAll(",", ""));

  return Number.isFinite(value) ? value : undefined;
}

function fingerprintAccessory(accessory) {
  return buildAccessoryFingerprint({
    ...accessory,
    MainStatValue: accessory.MainStatValue ?? valueFromSectionLine(accessory, "기본 효과"),
    EnlightenmentPoint: accessory.EnlightenmentPoint ?? valueFromSectionLine(accessory, "아크 패시브 포인트 효과")
  });
}

function lowConfidenceEstimate(summary) {
  return {
    Status: "lowConfidence",
    Confidence: "low",
    EvidenceCount: summary.Count,
    EstimatedRecoveryGold: summary.MedianPrice || null,
    NetCostGold: null,
    NetGoldPerOnePercentCombatPower: null
  };
}

export function percentile(sortedValues, ratio) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    return null;
  }

  const index = (sortedValues.length - 1) * ratio;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const lowerValue = sortedValues[lowerIndex];
  const upperValue = sortedValues[upperIndex];
  return lowerValue + (upperValue - lowerValue) * (index - lowerIndex);
}

export function summarizeExactMatchPrices(matches) {
  const prices = matches
    .map((match) => Number(match.BuyPrice))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  const medianPrice = percentile(prices, 0.5);
  const firstQuartile = percentile(prices, 0.25);
  const thirdQuartile = percentile(prices, 0.75);

  return {
    Count: prices.length,
    MedianPrice: medianPrice === null ? null : Math.round(medianPrice),
    InterquartileRange:
      firstQuartile === null || thirdQuartile === null ? null : Math.round(thirdQuartile - firstQuartile)
  };
}

export function buildRecoveryEstimate({ currentAccessory, auctionCandidates = [], recommendation = {} } = {}) {
  if (!currentAccessory) {
    return lowConfidenceEstimate({ Count: 0, MedianPrice: null });
  }

  const currentFingerprint = fingerprintAccessory(currentAccessory);
  const exactMatches = auctionCandidates.filter(
    (candidate) => fingerprintAccessory(candidate) === currentFingerprint
  );
  const summary = summarizeExactMatchPrices(exactMatches);
  const stableSpread = summary.MedianPrice > 0 && summary.InterquartileRange / summary.MedianPrice <= 0.35;
  const highConfidence = summary.Count >= 3 && stableSpread;

  if (!highConfidence) {
    return lowConfidenceEstimate(summary);
  }

  const buyPrice = Number(recommendation.BuyPrice);
  const gainPercent = Number(recommendation.CombatPowerGainPercent);

  if (!Number.isFinite(buyPrice) || buyPrice <= 0 || !Number.isFinite(gainPercent) || gainPercent <= 0) {
    return lowConfidenceEstimate(summary);
  }

  const netCost = Math.max(0, buyPrice - summary.MedianPrice);

  return {
    Status: "ready",
    Confidence: "high",
    EvidenceCount: summary.Count,
    EstimatedRecoveryGold: summary.MedianPrice,
    NetCostGold: netCost,
    NetGoldPerOnePercentCombatPower: gainPercent > 0 ? Math.round(netCost / gainPercent) : null
  };
}
