import { formatNumber, valueOf } from "./armoryUtils.js";

function formatGold(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number)}G` : "-";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(4)}%` : "-";
}

function formatScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toFixed(4);
}

function typeLabel(type) {
  if (type === "accessory") {
    return "악세";
  }

  if (type === "weaponHoning") {
    return "무기 강화";
  }

  if (type === "armorHoning") {
    return "방어구 강화";
  }

  if (type === "engravingBook") {
    return "각인서";
  }

  if (type === "gem") {
    return "보석";
  }

  if (type === "legendaryAvatar") {
    return "전설 아바타";
  }

  return "스펙업";
}

function candidateMeta(candidate) {
  const type = valueOf(candidate, ["Type", "type"], "");
  const target = valueOf(candidate, ["Target", "target"], "");
  const currentLevel = valueOf(candidate, ["CurrentLevel", "currentLevel"], null);
  const targetLevel = valueOf(candidate, ["TargetLevel", "targetLevel"], null);

  if ((type === "weaponHoning" || type === "armorHoning") && currentLevel && targetLevel) {
    return `${target || typeLabel(type)} ${currentLevel}->${targetLevel}`;
  }

  if (type === "engravingBook" && target && currentLevel !== null && targetLevel !== null) {
    return `${target} 각인 ${currentLevel}->${targetLevel}`;
  }

  if (type === "gem" && target && currentLevel !== null && targetLevel !== null) {
    return `${target} 보석 ${currentLevel}->${targetLevel}`;
  }

  if (type === "legendaryAvatar" && target) {
    return `${target} 전설 아바타`;
  }

  if (type === "accessory") {
    const comparison = valueOf(candidate, ["AccessoryComparison", "accessoryComparison"], null);
    const replaced = valueOf(comparison?.ReplacedAccessory, ["Name", "name"], "현재 악세");
    const next = valueOf(comparison?.Candidate, ["Name", "name"], "후보 악세");

    return `${replaced} -> ${next}`;
  }

  return valueOf(candidate, ["Caveat", "caveat"], "");
}

export default function SpecUpRecommendationPanel({ recommendation }) {
  const status = valueOf(recommendation, ["Status", "status"], "unavailable");
  const candidates = Array.isArray(recommendation?.TopCandidates) ? recommendation.TopCandidates : [];

  return (
    <section className="info-panel upgrade-panel" aria-labelledby="spec-up-recommendation-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Spec-up Efficiency</p>
          <h2 id="spec-up-recommendation-title">스펙업 효율 Top 5</h2>
        </div>
        <span className={`status-pill ${status === "ready" ? "enabled" : "disabled"}`}>{status === "ready" ? "계산됨" : "대기"}</span>
      </div>

      {candidates.length ? (
        <div className="upgrade-candidate-list">
          {candidates.map((candidate, index) => {
            const type = valueOf(candidate, ["Type", "type"], "");
            const label = valueOf(candidate, ["Label", "label"], "스펙업 후보");
            const gainPercent = Number(valueOf(candidate, ["GainPercent", "gainPercent"], 0));
            const costGold = valueOf(candidate, ["NetCostGold", "netCostGold"], valueOf(candidate, ["CostGold", "costGold"], null));
            const caveat = valueOf(candidate, ["Caveat", "caveat"], "");

            return (
              <article className="upgrade-candidate" key={valueOf(candidate, ["Id", "id"], `${label}-${index}`)}>
                <div className="upgrade-candidate-main">
                  <strong>
                    {index + 1}. {label}
                  </strong>
                  <span>{typeLabel(type)} · 전투력 +{formatPercent(gainPercent)}</span>
                </div>
                <div className="upgrade-candidate-score">
                  <strong>{formatScore(valueOf(candidate, ["EfficiencyScore", "efficiencyScore"], 0))}</strong>
                  <span>전투력 % / 10만 골드</span>
                </div>
                <div className="upgrade-candidate-meta">
                  <span>비용 {formatGold(costGold)}</span>
                  <span>{candidateMeta(candidate)}</span>
                  {caveat ? <span>{caveat}</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">계산 가능한 스펙업 후보가 아직 없어.</p>
      )}
    </section>
  );
}
