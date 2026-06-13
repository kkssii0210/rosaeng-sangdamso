import AvatarSummaryPanel from "./AvatarSummaryPanel.jsx";
import EngravingsPanel from "./EngravingsPanel.jsx";
import EquipmentList from "./EquipmentList.jsx";
import GemsPanel from "./GemsPanel.jsx";

export default function EquipmentPage({ equipment, engravings, gems, profile, avatars, criticalStats, mainStats, avatarStats, accessoryContributions, engravingContributions }) {
  const equipmentSpecContext = {
    MainStatTotal: mainStats?.MainStatTotal ?? 0
  };

  return (
    <div className="armory-page equipment-page-grid">
      <EngravingsPanel engravings={engravings} criticalStats={criticalStats} engravingContributions={engravingContributions} />
      <GemsPanel gems={gems} />
      <AvatarSummaryPanel avatars={avatars} avatarStats={avatarStats} />
      <section className="info-panel equipment-panel" aria-labelledby="equipment-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Equipment</p>
            <h2 id="equipment-title">장비</h2>
          </div>
          <span className="count-pill">{equipment.length}</span>
        </div>
        <EquipmentList equipment={equipment} profile={profile} specContext={equipmentSpecContext} criticalStats={criticalStats} accessoryContributions={accessoryContributions} />
      </section>
    </div>
  );
}
