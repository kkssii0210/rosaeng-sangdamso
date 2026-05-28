import AvatarSummaryPanel from "./AvatarSummaryPanel.jsx";
import EngravingsPanel from "./EngravingsPanel.jsx";
import EquipmentList from "./EquipmentList.jsx";
import GemsPanel from "./GemsPanel.jsx";
import { buildMainStatSummary } from "../lib/ui/mainStats.js";

export default function EquipmentPage({ equipment, engravings, gems, profile, avatars, criticalStats }) {
  const equipmentSpecContext = {
    MainStatTotal: buildMainStatSummary(equipment).MainStatTotal
  };

  return (
    <div className="armory-page equipment-page-grid">
      <EngravingsPanel engravings={engravings} criticalStats={criticalStats} />
      <GemsPanel gems={gems} />
      <AvatarSummaryPanel avatars={avatars} />
      <section className="info-panel equipment-panel" aria-labelledby="equipment-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Equipment</p>
            <h2 id="equipment-title">장비</h2>
          </div>
          <span className="count-pill">{equipment.length}</span>
        </div>
        <EquipmentList equipment={equipment} profile={profile} specContext={equipmentSpecContext} criticalStats={criticalStats} />
      </section>
    </div>
  );
}
