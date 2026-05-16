import { formatNumber, valueOf } from "./armoryUtils.js";

const CATEGORY_LABELS = {
  baseAttack: "기본공",
  level: "전투레벨",
  weapon: "무기",
  attackPower: "공격력",
  additionalDamage: "추가피해",
  bossDamage: "보스피해",
  arkPassive: "아크패시브",
  karma: "카르마",
  combatStats: "전투특성",
  engraving: "각인",
  cards: "카드",
  gems: "보석",
  paradiseOrb: "낙원보주",
  accessories: "장신구",
  bracelet: "팔찌",
  arkGrid: "아크그리드",
  arkGridGem: "아크그리드 젬"
};

const BASE_ATTACK_SOURCE_LABELS = {
  profileBasicAttackReverse: "프로필 역산",
  equipmentFormula: "장비식",
  missing: "없음"
};

function formatCombatPower(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return formatNumber(number.toFixed(2));
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

export default function CombatPowerAnalysisPanel({ combatPowerAnalysis }) {
  const status = valueOf(combatPowerAnalysis, ["Status", "status"], "unavailable");
  const formula = valueOf(combatPowerAnalysis, ["Formula", "formula"], {});
  const attack = valueOf(combatPowerAnalysis, ["AttackBreakdown", "attackBreakdown"], {});
  const paradisePower = valueOf(combatPowerAnalysis, ["ParadisePower", "paradisePower"], null);
  const categories = Array.isArray(combatPowerAnalysis?.CategorySummary) ? combatPowerAnalysis.CategorySummary : [];
  const notes = Array.isArray(combatPowerAnalysis?.MissingInputs) ? combatPowerAnalysis.MissingInputs.slice(0, 4) : [];
  const baseAttackSource = valueOf(attack, ["BaseAttackSource", "baseAttackSource"], "missing");
  const equipmentFormulaBaseAttack = valueOf(
    attack,
    ["EquipmentFormulaBaseAttackPower", "equipmentFormulaBaseAttackPower"],
    null
  );
  const equipmentFormulaGapPercent = valueOf(
    attack,
    ["EquipmentFormulaGapPercent", "equipmentFormulaGapPercent"],
    null
  );
  const equipmentWeaponPowerPercent = valueOf(
    attack,
    ["EquipmentWeaponPowerPercent", "equipmentWeaponPowerPercent"],
    null
  );
  const equipmentEffectiveWeaponPower = valueOf(
    attack,
    ["EquipmentEffectiveWeaponPower", "equipmentEffectiveWeaponPower"],
    null
  );

  return (
    <section className="info-panel combat-power-panel" aria-labelledby="combat-power-analysis-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Combat Power</p>
          <h2 id="combat-power-analysis-title">전투력 공식 검산</h2>
        </div>
        <span className={`status-pill ${status === "unavailable" ? "disabled" : "enabled"}`}>
          {status === "unavailable" ? "대기" : "부분 계산"}
        </span>
      </div>

      <div className="combat-power-metrics">
        <div>
          <span>공식 API</span>
          <strong>{formatCombatPower(valueOf(combatPowerAnalysis, ["OfficialCombatPower", "officialCombatPower"], null))}</strong>
        </div>
        <div>
          <span>문서식 추정</span>
          <strong>{formatCombatPower(valueOf(formula, ["Estimate", "estimate"], null))}</strong>
        </div>
        <div>
          <span>오차</span>
          <strong>{formatPercent(valueOf(formula, ["DeltaFromOfficialPercent", "deltaFromOfficialPercent"], null))}</strong>
        </div>
        <div>
          <span>보정계수</span>
          <strong>{valueOf(formula, ["CalibrationRatio", "calibrationRatio"], "-")}</strong>
        </div>
      </div>

      <div className="combat-power-base">
        <span>기본 공격력 {formatNumber(valueOf(attack, ["BasicAttackPower", "basicAttackPower"], 0))}</span>
        <span>기본공% {formatPercent(valueOf(attack, ["BasicAttackPercent", "basicAttackPercent"], 0))}</span>
        <span>순수기본공 추정 {formatNumber(valueOf(attack, ["BaseAttackBeforeBasicPercent", "baseAttackBeforeBasicPercent"], 0))}</span>
        <span>순수공 기준 {BASE_ATTACK_SOURCE_LABELS[baseAttackSource] || baseAttackSource}</span>
        {equipmentWeaponPowerPercent ? (
          <span>무기공% {formatPercent(equipmentWeaponPowerPercent)}</span>
        ) : null}
        {equipmentEffectiveWeaponPower ? (
          <span>실효 무기공 {formatNumber(equipmentEffectiveWeaponPower)}</span>
        ) : null}
        {equipmentFormulaBaseAttack ? (
          <span>장비식 순수공 {formatNumber(equipmentFormulaBaseAttack)}</span>
        ) : null}
        {equipmentFormulaGapPercent ? (
          <span>장비식 차이 {formatPercent(equipmentFormulaGapPercent)}</span>
        ) : null}
        {paradisePower ? (
          <span>최대 낙원력 {formatNumber(valueOf(paradisePower, ["Value", "value"], 0))}</span>
        ) : null}
      </div>

      {categories.length ? (
        <div className="combat-power-factor-grid">
          {categories.map((category) => {
            const id = valueOf(category, ["Category", "category"], "");
            const label = CATEGORY_LABELS[id] || id;

            return (
              <div className="combat-power-factor" key={id}>
                <span>{label}</span>
                <strong>{formatPercent(valueOf(category, ["Percent", "percent"], 0))}</strong>
              </div>
            );
          })}
        </div>
      ) : null}

      {notes.length ? (
        <ul className="combat-power-notes">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
