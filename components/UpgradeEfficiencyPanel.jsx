import { formatNumber, valueOf } from "./armoryUtils.js";

function formatGold(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${formatNumber(value)}G`;
}

function formatScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toFixed(number >= 1 ? 2 : 4);
}

function gainLabel(type) {
  if (type === "cooldownGemEffect") {
    return "쿨감";
  }

  if (type === "damageGemEffect") {
    return "피해";
  }

  if (type === "mainStatPercent") {
    return "주스탯";
  }

  if (type === "combatPower") {
    return "전투력";
  }

  return "효율";
}

export default function UpgradeEfficiencyPanel({ upgradeEfficiency }) {
  const status = valueOf(upgradeEfficiency, ["MarketDataStatus", "marketDataStatus"], "unavailable");
  const candidates = Array.isArray(upgradeEfficiency?.Candidates) ? upgradeEfficiency.Candidates.slice(0, 6) : [];

  return (
    <section className="info-panel upgrade-panel" aria-labelledby="upgrade-efficiency-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Upgrade Efficiency</p>
          <h2 id="upgrade-efficiency-title">스펙업 효율</h2>
        </div>
        <span className={`status-pill ${status === "ready" ? "enabled" : "disabled"}`}>{status === "ready" ? "계산됨" : "대기"}</span>
      </div>

      {candidates.length ? (
        <div className="upgrade-candidate-list">
          {candidates.map((candidate) => {
            const label = valueOf(candidate, ["Label", "label"], "스펙업 후보");
            const gainPercent = Number(valueOf(candidate, ["GainPercent", "gainPercent"], 0));
            const scoreUnit = valueOf(candidate, ["ScoreUnit", "scoreUnit"], "");
            const netCostGold = valueOf(candidate, ["NetCostGold", "netCostGold"], valueOf(candidate, ["CostGold", "costGold"], null));

            return (
              <article className="upgrade-candidate" key={valueOf(candidate, ["Id", "id"], label)}>
                <div className="upgrade-candidate-main">
                  <strong>{label}</strong>
                  <span>
                    {gainLabel(valueOf(candidate, ["GainType", "gainType"], ""))} +{gainPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="upgrade-candidate-score">
                  <strong>{formatScore(valueOf(candidate, ["EfficiencyScore", "efficiencyScore"], 0))}</strong>
                  <span>{scoreUnit}</span>
                </div>
                <div className="upgrade-candidate-meta">
                  <span>순비용 {formatGold(netCostGold)}</span>
                  <span>{valueOf(candidate, ["Caveat", "caveat"], "")}</span>
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
