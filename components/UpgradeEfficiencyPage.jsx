import CombatPowerAnalysisPanel from "./CombatPowerAnalysisPanel.jsx";
import UpgradeEfficiencyPanel from "./UpgradeEfficiencyPanel.jsx";

export default function UpgradeEfficiencyPage({ upgradeEfficiency, combatPowerAnalysis }) {
  return (
    <div className="armory-page upgrade-page-grid">
      <CombatPowerAnalysisPanel combatPowerAnalysis={combatPowerAnalysis} />
      <UpgradeEfficiencyPanel upgradeEfficiency={upgradeEfficiency} />
    </div>
  );
}
