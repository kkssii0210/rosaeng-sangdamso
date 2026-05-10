import Image from "next/image";
import { gradeClass, listOf, valueOf } from "./armoryUtils.js";

export default function GemsPanel({ gems }) {
  if (!gems.length) {
    return (
      <section className="info-panel gems-panel" aria-labelledby="gems-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Gems</p>
            <h2 id="gems-title">보석</h2>
          </div>
        </div>
        <p className="empty-state">보석 정보를 찾지 못했어.</p>
      </section>
    );
  }

  return (
    <section className="info-panel gems-panel" aria-labelledby="gems-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Gems</p>
          <h2 id="gems-title">보석</h2>
        </div>
        <span className="count-pill">{gems.length}</span>
      </div>

      <div className="gem-list">
        {gems.map((gem, index) => {
          const name = valueOf(gem, ["Name", "name"], "보석");
          const icon = valueOf(gem, ["Icon", "icon"], "");
          const grade = valueOf(gem, ["Grade", "grade"], "");
          const level = valueOf(gem, ["Level", "level"], "");
          const skillName = valueOf(gem, ["SkillName", "skillName"], "");
          const effectTypeText = valueOf(gem, ["EffectTypeText", "effectTypeText"], "");
          const effectValue = valueOf(gem, ["EffectValue", "effectValue"], null);
          const additionalEffects = listOf(gem, ["AdditionalEffects", "additionalEffects"]);

          return (
            <article className="gem-item" key={`${name}-${index}`}>
              <div className="gem-icon">
                {icon ? <Image src={icon} alt="" width={52} height={52} quality={95} /> : <span aria-hidden="true" />}
              </div>
              <div className="gem-body">
                <div className="gem-row">
                  <span className={`grade ${gradeClass(grade)}`}>{grade || "보석"}</span>
                  {level ? <strong>Lv.{level}</strong> : null}
                </div>
                <div className="gem-name">{skillName || name}</div>
                <div className="gem-meta">
                  {effectValue !== null ? <span>{`${effectTypeText} ${Number(effectValue).toFixed(2)}%`}</span> : null}
                  {additionalEffects.map((effect) => (
                    <span key={`${name}-${valueOf(effect, ["Name", "name"], "")}`}>
                      {valueOf(effect, ["Name", "name"], "추가 효과")} {valueOf(effect, ["Value", "value"], "")}
                      {valueOf(effect, ["Unit", "unit"], "%")}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
