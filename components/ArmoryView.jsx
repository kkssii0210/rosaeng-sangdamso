"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ArkPassiveSkillsPage from "./ArkPassiveSkillsPage.jsx";
import EquipmentPage from "./EquipmentPage.jsx";
import UpgradeEfficiencyPage from "./UpgradeEfficiencyPage.jsx";
import { formatNumber, listOf, valueOf } from "./armoryUtils.js";
import { buildEfficiencyHref } from "../lib/ui/efficiencyNavigation.js";

const ARMORY_PAGE_IDS = new Set(["equipment", "build", "upgrade"]);

function getPageFromHash() {
  if (typeof window === "undefined") {
    return "equipment";
  }

  const page = window.location.hash.replace("#", "");
  return ARMORY_PAGE_IDS.has(page) ? page : "equipment";
}

export default function ArmoryView({ armory }) {
  const [activePage, setActivePage] = useState(() => getPageFromHash());
  const profile = armory?.profile || {};
  const equipment = Array.isArray(armory?.equipment) ? armory.equipment : [];
  const engravings = Array.isArray(armory?.engravings) ? armory.engravings : [];
  const gems = Array.isArray(armory?.gems) ? armory.gems : [];
  const avatars = Array.isArray(armory?.avatars) ? armory.avatars : [];
  const criticalStats = armory?.criticalStats || {};
  const profileImage = valueOf(profile, ["CharacterImage", "characterImage"], "");
  const characterName = valueOf(profile, ["CharacterName", "characterName"], "캐릭터");
  const serverName = valueOf(profile, ["ServerName", "serverName"], "-");
  const className = valueOf(profile, ["CharacterClassName", "characterClassName"], "-");
  const itemLevel = valueOf(profile, ["ItemAvgLevel", "itemAvgLevel"], "-");
  const combatLevel = valueOf(profile, ["CharacterLevel", "characterLevel"], "-");
  const combatPower = valueOf(profile, ["CombatPower", "combatPower"], "");

  const skills = Array.isArray(armory?.skills) ? armory.skills : [];
  const visibleSkills = skills
    .filter((skill) => {
      const level = Number(valueOf(skill, ["Level", "level"], 0));
      const skillType = Number(valueOf(skill, ["SkillType", "skillType"], 0));
      const tripods = listOf(skill, ["Tripods", "tripods"]);
      const hasSelectedTripod = tripods.some((tripod) => valueOf(tripod, ["IsSelected", "isSelected"], true));
      const hasRune = Boolean(valueOf(skill, ["Rune", "rune"], null));

      return level > 1 || skillType > 0 || hasRune || hasSelectedTripod;
    })
    .sort((left, right) => Number(valueOf(right, ["Level", "level"], 0)) - Number(valueOf(left, ["Level", "level"], 0)));

  const pages = [
    { id: "equipment", label: "장비", meta: `장비 ${equipment.length} · 보석 ${gems.length} · 아바타 ${avatars.length}` },
    { id: "build", label: "아크패시브/스킬", meta: `스킬 ${visibleSkills.length}개` },
    { id: "upgrade", label: "스펙업 효율", meta: `후보 ${armory?.upgradeEfficiency?.Candidates?.length || 0}개` }
  ];

  useEffect(() => {
    function handleHashChange() {
      setActivePage(getPageFromHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function selectPage(pageId) {
    setActivePage(pageId);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${pageId}`);
    }
  }

  return (
    <section className="armory-shell" aria-label={`${characterName} 장비창`}>
      <header className="character-banner">
        <div className="portrait-frame">
          {profileImage ? (
            <Image src={profileImage} alt={`${characterName} 캐릭터 이미지`} width={192} height={240} quality={90} className="profile-portrait" />
          ) : (
            <div className="profile-placeholder" aria-hidden="true" />
          )}
        </div>
        <div className="character-summary">
          <p className="eyebrow">Lostark Open API</p>
          <h1>{characterName}</h1>
          <div className="summary-tags">
            <span>{serverName}</span>
            <span>{className}</span>
            <span>전투 Lv.{combatLevel}</span>
          </div>
        </div>
        <div className="power-summary" aria-label="캐릭터 주요 수치">
          <div>
            <span>아이템 레벨</span>
            <strong>{itemLevel}</strong>
          </div>
          <div>
            <span>전투력</span>
            <strong>{combatPower ? formatNumber(combatPower) : "-"}</strong>
          </div>
        </div>
        <div className="character-actions">
          <Link className="character-efficiency-link" href={buildEfficiencyHref(characterName)}>
            전투력 효율 시뮬레이터
          </Link>
        </div>
      </header>

      <nav className="armory-nav" aria-label="장비창 페이지">
        {pages.map((page) => (
          <button
            type="button"
            className={activePage === page.id ? "active" : ""}
            aria-current={activePage === page.id ? "page" : undefined}
            key={page.id}
            onClick={() => selectPage(page.id)}
          >
            <span>{page.label}</span>
            <strong>{page.meta}</strong>
          </button>
        ))}
      </nav>

      {activePage === "equipment" ? (
        <EquipmentPage
          equipment={equipment}
          engravings={engravings}
          gems={gems}
          profile={profile}
          avatars={avatars}
          criticalStats={criticalStats}
        />
      ) : activePage === "build" ? (
        <ArkPassiveSkillsPage arkPassive={armory?.arkPassive || {}} skills={visibleSkills} />
      ) : (
        <UpgradeEfficiencyPage
          combatPowerAnalysis={armory?.combatPowerAnalysis || null}
          upgradeEfficiency={armory?.upgradeEfficiency || null}
        />
      )}
    </section>
  );
}
