import Image from "next/image";
import { buildEngravingContributionIndex } from "../lib/spec/engravingContributions.js";
import { listOf, valueOf } from "./armoryUtils.js";

function gradeClass(grade) {
  const gradeName = String(grade || "");

  if (gradeName.includes("유물")) {
    return "relic";
  }

  if (gradeName.includes("고대")) {
    return "ancient";
  }

  return "default";
}

export default function EngravingsPanel({ engravings, criticalStats }) {
  if (!engravings.length) {
    return (
      <section className="info-panel engravings-panel" aria-labelledby="engravings-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Engravings</p>
            <h2 id="engravings-title">각인</h2>
          </div>
        </div>
        <p className="empty-state">각인 정보를 찾지 못했어.</p>
      </section>
    );
  }

  const engravingContributions = buildEngravingContributionIndex(engravings, criticalStats);

  return (
    <section className="info-panel engravings-panel" aria-labelledby="engravings-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Engravings</p>
          <h2 id="engravings-title">각인</h2>
        </div>
        <span className="count-pill">{engravings.length}</span>
      </div>

      <div className="engraving-list">
        {engravings.map((engraving) => {
          const name = valueOf(engraving, ["Name", "name"], "각인");
          const grade = valueOf(engraving, ["Grade", "grade"], "");
          const level = valueOf(engraving, ["Level", "level"], "");
          const abilityStoneLevel = valueOf(engraving, ["AbilityStoneLevel", "abilityStoneLevel"], null);
          const icon = valueOf(engraving, ["Icon", "icon"], "");
          const contribution = engravingContributions[name];
          const efficiencyText = contribution?.ContributionText || valueOf(engraving, ["EfficiencyText", "efficiencyText"], "");
          const metrics = listOf(engraving, ["Metrics", "metrics"]);
          const description = valueOf(engraving, ["Description", "description"], "");
          const bookLevel = Math.max(0, Math.min(4, Number(level) || 0));

          return (
            <article className="engraving-card" key={name}>
              <div className={`engraving-mark ${gradeClass(grade)}`} aria-hidden="true">
                {icon ? <Image src={icon} alt="" width={48} height={48} quality={95} unoptimized /> : name.slice(0, 1)}
              </div>
              <div className="engraving-main">
                <div className="engraving-row">
                  <strong>{name}</strong>
                  {efficiencyText ? <span className="engraving-efficiency">{efficiencyText}</span> : null}
                </div>
                {grade ? (
                  <div className="book-progress" aria-label={`${name} ${grade} 각인서 ${bookLevel}단계`}>
                    <span>{grade}</span>
                    {Array.from({ length: 4 }).map((_, stepIndex) => (
                      <i className={stepIndex < bookLevel ? "active" : ""} key={`${name}-book-${stepIndex}`} />
                    ))}
                    <strong>{bookLevel}/4</strong>
                  </div>
                ) : null}
                <div className="engraving-meta">
                  {abilityStoneLevel ? <span>돌 Lv.{abilityStoneLevel}</span> : null}
                  {metrics.slice(1, 3).map((metric) => (
                    <span key={`${name}-${metric}`}>{metric}</span>
                  ))}
                </div>
                {description ? <p>{description}</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
