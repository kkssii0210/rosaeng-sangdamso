import Image from "next/image";
import { listOf, valueOf } from "./armoryUtils.js";

function runeGradeClass(grade) {
  const gradeName = String(grade || "");

  if (gradeName.includes("전설")) {
    return "legendary";
  }

  if (gradeName.includes("영웅")) {
    return "epic";
  }

  if (gradeName.includes("희귀")) {
    return "rare";
  }

  return "default";
}

function skillTypeLabel(skillType, type) {
  const value = Number(skillType);

  if (value === 100) {
    return "각성";
  }

  if (value === 101) {
    return "초각성";
  }

  if (value === 1) {
    return "초각성 스킬";
  }

  return type || "일반";
}

export default function SkillsPanel({ skills }) {
  if (!skills.length) {
    return (
      <section className="info-panel skills-panel" aria-labelledby="skills-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Combat Skills</p>
            <h2 id="skills-title">스킬</h2>
          </div>
        </div>
        <p className="empty-state">스킬 정보를 찾지 못했어.</p>
      </section>
    );
  }

  return (
    <section className="info-panel skills-panel" aria-labelledby="skills-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Combat Skills</p>
          <h2 id="skills-title">스킬</h2>
        </div>
      </div>

      <div className="skill-icon-grid">
        {skills.map((skill) => {
          const name = valueOf(skill, ["Name", "name"], "스킬");
          const icon = valueOf(skill, ["Icon", "icon"], "");
          const level = valueOf(skill, ["Level", "level"], "-");
          const type = valueOf(skill, ["Type", "type", "SkillType", "skillType"], "");
          const skillType = valueOf(skill, ["SkillType", "skillType"], "");
          const rune = valueOf(valueOf(skill, ["Rune", "rune"], null), ["Name", "name"], "");
          const runeIcon = valueOf(valueOf(skill, ["Rune", "rune"], null), ["Icon", "icon"], "");
          const runeGrade = valueOf(valueOf(skill, ["Rune", "rune"], null), ["Grade", "grade"], "");
          const tripods = listOf(skill, ["Tripods", "tripods"]);
          const selectedTripods = tripods.filter((tripod) => valueOf(tripod, ["IsSelected", "isSelected"], true));
          const label = skillTypeLabel(skillType, type);

          return (
            <article className="skill-card" key={name}>
              <div className="skill-art">
                {icon ? <Image src={icon} alt="" width={96} height={96} quality={95} /> : <span aria-hidden="true" />}
                <span className="skill-level">Lv.{level}</span>
                {runeIcon ? (
                  <span className={`rune-icon ${runeGradeClass(runeGrade)}`}>
                    <Image src={runeIcon} alt="" width={48} height={48} quality={95} />
                  </span>
                ) : null}
              </div>
              <div className="skill-card-body">
                <strong>{name}</strong>
                <div className="skill-badges">
                  <span>{label}</span>
                  {rune ? <span>{rune}</span> : null}
                </div>
                <div className="tripod-icons" aria-label={`${name} 선택 트라이포드`}>
                  {selectedTripods.slice(0, 3).map((tripod, index) => {
                    const tripodName = valueOf(tripod, ["Name", "name"], "트라이포드");
                    const tripodIcon = valueOf(tripod, ["Icon", "icon"], "");

                    return (
                      <span title={tripodName} key={`${name}-${tripodName}-${index}`}>
                        {tripodIcon ? <Image src={tripodIcon} alt={tripodName} width={48} height={48} quality={95} /> : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
