function formatAvatarStatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) && Number.isInteger(number) ? String(number) : String(value ?? "0");
}

export default function AvatarSummaryPanel({ avatars, avatarStats }) {
  const summary = avatarStats || { StatBonuses: [], AppliedAvatarCount: 0, IgnoredStatEffectCount: 0 };
  const statBonuses = summary.StatBonuses || [];
  const avatarCount = Array.isArray(avatars) ? avatars.length : 0;

  return (
    <section className="info-panel avatar-panel" aria-labelledby="avatar-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Avatars</p>
          <h2 id="avatar-title">아바타</h2>
        </div>
        <span className="count-pill">{avatarCount}</span>
      </div>

      {statBonuses.length ? (
        <div className="avatar-bonus-list">
          {statBonuses.map((bonus) => (
            <div className="avatar-bonus-item" key={bonus.Stat}>
              <span>{bonus.Stat}</span>
              <strong>+{formatAvatarStatPercent(bonus.Value)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">적용 중인 아바타 스탯 보너스 없음.</p>
      )}

      <div className="avatar-summary-meta">
        <span>적용 {summary.AppliedAvatarCount}</span>
        {summary.IgnoredStatEffectCount ? <span>덧입기 제외 {summary.IgnoredStatEffectCount}</span> : null}
      </div>
    </section>
  );
}
