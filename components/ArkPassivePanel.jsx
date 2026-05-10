import Image from "next/image";
import { formatNumber, listOf, sectionLabel, stripMarkup, valueOf } from "./armoryUtils.js";

function passiveTone(name) {
  const label = String(name || "");

  if (label.includes("진화")) {
    return "evolution";
  }

  if (label.includes("깨달음")) {
    return "realization";
  }

  if (label.includes("도약")) {
    return "leap";
  }

  return "default";
}

function parseEffectSummary(effect) {
  const description = stripMarkup(valueOf(effect, ["Description", "description"], ""));
  const category = valueOf(effect, ["Name", "name"], "아크");
  const tier = description.match(/(\d+)티어/)?.[1] || "";
  const level = description.match(/Lv\.\d+/)?.[0] || "";
  const title = description
    .replace(category, "")
    .replace(/\d+티어/g, "")
    .replace(/Lv\.\d+/g, "")
    .trim();

  return {
    category,
    level,
    tier: tier ? `T${tier}` : "",
    title: title || category
  };
}

export default function ArkPassivePanel({ arkPassive }) {
  const isEnabled = valueOf(arkPassive, ["IsArkPassive", "isArkPassive"], null);
  const title = valueOf(arkPassive, ["Title", "title"], "");
  const points = listOf(arkPassive, ["Points", "points"]);
  const effects = listOf(arkPassive, ["Effects", "effects"]);
  const effectGroups = effects.reduce((groups, effect) => {
    const groupName = valueOf(effect, ["Name", "name"], "아크");
    return {
      ...groups,
      [groupName]: [...(groups[groupName] || []), effect]
    };
  }, {});

  return (
    <section className="info-panel passive-panel" aria-labelledby="ark-passive-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Ark Passive</p>
          <h2 id="ark-passive-title">아크패시브</h2>
          {title ? <span className="panel-subtitle">{title}</span> : null}
        </div>
        {isEnabled !== null ? (
          <span className={`status-pill ${isEnabled ? "enabled" : "disabled"}`}>
            {isEnabled ? "활성" : "비활성"}
          </span>
        ) : null}
      </div>

      {points.length ? (
        <div className="passive-points">
          {points.map((point) => {
            const name = sectionLabel(String(valueOf(point, ["Name", "name", "Type", "type"], "")));
            const value = valueOf(point, ["Value", "value", "Point", "point"], "-");

            return (
              <div className={`point-chip ${passiveTone(name)}`} key={`${name}-${value}`}>
                <span aria-hidden="true">{name.slice(0, 1)}</span>
                <div>
                  <small>{name}</small>
                  <strong>{formatNumber(value)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">아크패시브 포인트 정보가 없어.</p>
      )}

      {effects.length ? (
        <div className="passive-node-groups">
          {Object.entries(effectGroups).map(([groupName, groupEffects]) => (
            <div className={`passive-node-group ${passiveTone(groupName)}`} key={groupName}>
              <div className="node-group-heading">
                <span>{sectionLabel(groupName)}</span>
                <strong>{groupEffects.length}</strong>
              </div>
              <div className="passive-node-grid">
                {groupEffects.map((effect, index) => {
                  const icon = valueOf(effect, ["Icon", "icon"], "");
                  const summary = parseEffectSummary(effect);

                  return (
                    <article className="passive-node" key={`${groupName}-${summary.title}-${index}`}>
                      <div className="passive-node-icon">
                        {icon ? <Image src={icon} alt="" width={80} height={80} quality={95} /> : <span aria-hidden="true" />}
                        {summary.tier ? <span className="node-tier">{summary.tier}</span> : null}
                      </div>
                      <strong>{summary.title}</strong>
                      {summary.level ? <span>{summary.level}</span> : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
