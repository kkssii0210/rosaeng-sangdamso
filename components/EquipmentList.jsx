import Image from "next/image";
import { buildAccessoryContributionIndex, formatContributionPercent, isAccessoryType } from "../lib/spec/accessoryContributions.js";
import { formatNumber, gradeClass, listOf, qualityClass, stripMarkup, valueOf } from "./armoryUtils.js";

export default function EquipmentList({ equipment, profile, criticalStats }) {
  if (!equipment.length) {
    return <p className="empty-state">장비 정보를 찾지 못했어.</p>;
  }

  const accessoryContributions = buildAccessoryContributionIndex(equipment, profile, criticalStats);
  const hasAccessoryContributions = Object.keys(accessoryContributions.lines).length > 0;

  return (
    <>
      {hasAccessoryContributions ? (
        <div className="accessory-contribution-summary">
          <span>악세 연마 효과 종합</span>
          <strong>{accessoryContributions.TotalContributionText}</strong>
        </div>
      ) : null}
      <div className="equipment-list">
        {equipment.map((item, index) => {
          const type = valueOf(item, ["Type", "type"], "장비");
          const name = valueOf(item, ["Name", "name"], "이름 없음");
          const grade = valueOf(item, ["Grade", "grade"], "");
          const icon = valueOf(item, ["Icon", "icon"], "");
          const quality = valueOf(item, ["Quality", "quality"], null);
          const itemLevelText = stripMarkup(valueOf(item, ["ItemLevelText", "itemLevelText"], ""));
          const detailSections = listOf(item, ["DetailSections", "detailSections"]);
          const abilityStone = valueOf(item, ["AbilityStone", "abilityStone"], null);
          const stoneEngravings = listOf(abilityStone, ["Engravings", "engravings"]);
          const stoneEffects = listOf(abilityStone, ["Effects", "effects"]);
          const itemContribution = accessoryContributions.itemTotals[index];
          const hasAccessoryContribution = isAccessoryType(type) && Number.isFinite(itemContribution);
          const weaponStats = valueOf(item, ["WeaponStats", "weaponStats"], null);
          const weaponPower = valueOf(weaponStats, ["WeaponPower", "weaponPower"], null);
          const weaponAdditionalDamage = valueOf(weaponStats, ["AdditionalDamage", "additionalDamage"], null);
          const weaponPowerValue = valueOf(weaponPower, ["Value", "value"], null);
          const weaponAdditionalDamageValue = valueOf(weaponAdditionalDamage, ["Value", "value"], null);
          const mainStatValue = valueOf(item, ["MainStatValue", "mainStatValue"], null);

          return (
            <article className="equipment-item" key={`${type}-${name}-${index}`}>
              <div className="item-icon">
                {icon ? <Image src={icon} alt="" width={80} height={80} quality={95} /> : <span aria-hidden="true" />}
              </div>
              <div className="item-body">
                <div className="item-row">
                  <span className="item-type">{type}</span>
                  {grade ? <span className={`grade ${gradeClass(grade)}`}>{grade}</span> : null}
                </div>
                <strong>{name}</strong>
                <div className="equipment-meta">
                  {quality !== null ? (
                    <span className={`quality-badge ${qualityClass(quality)}`}>
                      품질 <strong>{quality}</strong>
                    </span>
                  ) : null}
                  {itemLevelText ? <span>{itemLevelText}</span> : null}
                  {mainStatValue !== null ? (
                    <span className="stat-badge">
                      주스탯 <strong>{formatNumber(mainStatValue)}</strong>
                    </span>
                  ) : null}
                  {weaponPowerValue !== null ? (
                    <span className="stat-badge">
                      무공 <strong>{formatNumber(weaponPowerValue)}</strong>
                    </span>
                  ) : null}
                  {weaponAdditionalDamageValue !== null ? (
                    <span className="stat-badge">
                      추피 <strong>{Number(weaponAdditionalDamageValue).toFixed(2)}%</strong>
                    </span>
                  ) : null}
                  {hasAccessoryContribution ? (
                    <span className="contribution-badge">
                      연마 <b>{formatContributionPercent(itemContribution)}</b>
                    </span>
                  ) : null}
                </div>
                {abilityStone ? (
                  <div className="ability-stone-details">
                    {stoneEngravings.length ? (
                      <div className="stone-section">
                        <span className="stone-section-title">각인 효과</span>
                        <div className="stone-engraving-list">
                          {stoneEngravings.map((engraving, engravingIndex) => {
                            const engravingName = valueOf(engraving, ["Name", "name"], "각인");
                            const valueText = valueOf(engraving, ["ValueText", "valueText"], "");
                            const points = valueOf(engraving, ["Points", "points"], 0);
                            const level = valueOf(engraving, ["Level", "level"], null);
                            const isPenalty = Boolean(valueOf(engraving, ["IsPenalty", "isPenalty"], false));
                            const displayValue = valueText || (level !== null ? `Lv.${level}` : Number(points) > 0 ? `+${points}` : points);

                            return (
                              <div
                                className={`stone-engraving ${isPenalty ? "penalty" : "positive"}`}
                                key={`${type}-${index}-stone-${engravingName}-${engravingIndex}`}
                              >
                                <span>{engravingName}</span>
                                <strong>{displayValue}</strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {stoneEffects.length ? (
                      <div className="stone-effect-groups">
                        {stoneEffects.map((section, sectionIndex) => {
                          const sectionTitle = valueOf(section, ["Title", "title"], "추가 효과");
                          const lines = listOf(section, ["Lines", "lines"]);

                          return (
                            <div className="stone-section" key={`${type}-${index}-stone-effect-${sectionTitle}-${sectionIndex}`}>
                              <span className="stone-section-title">{sectionTitle}</span>
                              <ul className="stone-effect-list">
                                {lines.map((line, lineIndex) => (
                                  <li key={`${type}-${index}-stone-effect-${sectionIndex}-${lineIndex}`}>{line}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {detailSections.length ? (
                  <div className="equipment-details">
                    {detailSections.map((section, sectionIndex) => {
                      const title = valueOf(section, ["title", "Title"], "");
                      const lines = listOf(section, ["lines", "Lines"]);

                      return (
                        <div className="detail-section" key={`${type}-${index}-${title}-${sectionIndex}`}>
                          <span className="detail-title">{title}</span>
                          <ul>
                            {lines.map((line, lineIndex) => {
                              const contribution = accessoryContributions.lines[`${index}:${sectionIndex}:${lineIndex}`];
                              const isZeroContribution = Number(contribution?.ContributionPercent || 0) === 0;

                              return (
                                <li
                                  className={contribution ? "detail-line with-contribution" : "detail-line"}
                                  key={`${type}-${index}-${sectionIndex}-${lineIndex}`}
                                >
                                  <span className="detail-line-text">{line}</span>
                                  {contribution ? (
                                    <span className={`detail-contribution ${isZeroContribution ? "zero" : ""}`}>
                                      {contribution.ContributionText}
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
