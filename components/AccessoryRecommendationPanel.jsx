import { formatNumber, valueOf } from "./armoryUtils.js";

function formatGold(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number)}G` : "-";
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(4)}%` : "-";
}

function AccessorySummary({ title, accessory }) {
  const sections = Array.isArray(accessory?.DetailSections) ? accessory.DetailSections : [];
  const lines = sections.flatMap((section) => section.lines || section.Lines || []).slice(0, 4);

  return (
    <div className="accessory-summary">
      <span>{title}</span>
      <strong>{valueOf(accessory, ["Name", "name"], "악세사리")}</strong>
      <div className="simulator-meta">
        <span>품질 {valueOf(accessory, ["Quality", "quality"], "-")}</span>
        <span>깨달음 {valueOf(accessory, ["EnlightenmentPoint", "enlightenmentPoint"], "-")}</span>
      </div>
      <ul>
        {lines.map((line, index) => (
          <li key={`${line}-${index}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AccessoryRecommendationPanel({ recommendation, recovery, isRecoveryLoading }) {
  const status = valueOf(recommendation, ["Status", "status"], "unavailable");
  const top = valueOf(recommendation, ["TopRecommendation", "topRecommendation"], null);
  const comparisons = Array.isArray(recommendation?.Comparisons) ? recommendation.Comparisons : [];

  if (status === "noRecommendation") {
    return (
      <section className="info-panel simulator-panel">
        <p className="empty-state">현재 조건에서 추천할 만한 악세가 없습니다</p>
      </section>
    );
  }

  if (!top) {
    return (
      <section className="info-panel simulator-panel">
        <p className="empty-state">전투력 효율 추천 결과가 아직 없어.</p>
      </section>
    );
  }

  return (
    <section className="info-panel simulator-panel" aria-labelledby="accessory-recommendation-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Combat Power Efficiency</p>
          <h2 id="accessory-recommendation-title">악세사리 교체 추천</h2>
        </div>
        <span className="status-pill enabled">1위 추천</span>
      </div>

      <div className="simulator-scoreboard">
        <div>
          <span>예상 전투력</span>
          <strong>
            {formatNumber(top.CurrentOfficialCombatPower)} -&gt; {formatNumber(top.ExpectedCombatPower)}
          </strong>
        </div>
        <div>
          <span>전투력 상승률</span>
          <strong>{formatPercent(top.CombatPowerGainPercent)}</strong>
        </div>
        <div>
          <span>+1%당 골드</span>
          <strong>{formatGold(top.GoldPerOnePercentCombatPower)}</strong>
        </div>
        <div>
          <span>즉시구매가</span>
          <strong>{formatGold(top.BuyPrice)}</strong>
        </div>
      </div>

      <div className="accessory-compare-grid">
        <AccessorySummary title="현재 교체 대상" accessory={top.ReplacedAccessory} />
        <AccessorySummary title="추천 후보" accessory={top.Candidate} />
      </div>

      <div className="recovery-box">
        {isRecoveryLoading ? (
          <span>현재 악세 예상 회수가 계산 중</span>
        ) : recovery?.RecoveryEstimate?.Status === "ready" ? (
          <span>
            예상 회수가 {formatGold(recovery.RecoveryEstimate.EstimatedRecoveryGold)} · 순비용 기준 +1%당{" "}
            {formatGold(recovery.RecoveryEstimate.NetGoldPerOnePercentCombatPower)}
          </span>
        ) : recovery ? (
          <span>근거 부족으로 순비용 효율을 표시하지 않습니다</span>
        ) : (
          <span>즉시구매가 기준 효율을 먼저 표시합니다</span>
        )}
      </div>

      {comparisons.length > 1 ? (
        <details className="comparison-details">
          <summary>상위 3개 비교</summary>
          <div className="comparison-list">
            {comparisons.map((item, index) => (
              <article className="comparison-row" key={`${item.Candidate?.Name}-${index}`}>
                <strong>
                  {index + 1}. {item.Candidate?.Name}
                </strong>
                <span>
                  {item.Candidate?.Type} · {formatGold(item.BuyPrice)} · +1%당 {formatGold(item.GoldPerOnePercentCombatPower)}
                </span>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
