import ArkPassivePanel from "./ArkPassivePanel.jsx";
import SkillsPanel from "./SkillsPanel.jsx";

export default function ArkPassiveSkillsPage({ arkPassive, skills }) {
  return (
    <div className="armory-page build-page-grid">
      <SkillsPanel skills={skills} />
      <ArkPassivePanel arkPassive={arkPassive} />
    </div>
  );
}
