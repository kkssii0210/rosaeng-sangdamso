"use client";

import { useEffect, useState } from "react";
import AccessoryRecommendationPanel from "./AccessoryRecommendationPanel.jsx";

export default function CombatPowerEfficiencyPage() {
  const [characterName, setCharacterName] = useState("");
  const [result, setResult] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const recent = window.localStorage.getItem("sggu:lastCharacterName") || "";
      setCharacterName(recent);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, []);

  async function loadRecommendation(event) {
    event.preventDefault();
    const name = characterName.trim();

    if (!name || isLoading) {
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);
    setRecovery(null);

    try {
      const response = await fetch(`/api/efficiency/accessories/${encodeURIComponent(name)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "전투력 효율을 계산하지 못했어.");
      }

      setResult(data);
      window.localStorage.setItem("sggu:lastCharacterName", name);

      const top = data?.Recommendation?.TopRecommendation;
      if (top) {
        loadRecovery(top);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "전투력 효율을 계산하지 못했어.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRecovery(top) {
    setIsRecoveryLoading(true);

    try {
      const response = await fetch("/api/efficiency/accessories/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          CurrentAccessory: top.ReplacedAccessory,
          Recommendation: {
            BuyPrice: top.BuyPrice,
            CombatPowerGainPercent: top.CombatPowerGainPercent
          }
        })
      });
      const data = await response.json();

      if (response.ok) {
        setRecovery(data);
      }
    } finally {
      setIsRecoveryLoading(false);
    }
  }

  return (
    <section className="efficiency-shell" aria-labelledby="efficiency-title">
      <div className="efficiency-header">
        <p className="eyebrow">Simulator</p>
        <h1 id="efficiency-title">전투력 효율 시뮬레이터</h1>
      </div>

      <form className="efficiency-search" onSubmit={loadRecommendation}>
        <label className="sr-only" htmlFor="efficiency-character-name">
          캐릭터명
        </label>
        <input
          id="efficiency-character-name"
          value={characterName}
          onChange={(event) => setCharacterName(event.target.value)}
          placeholder="캐릭터명을 입력해줘"
          autoComplete="off"
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "계산 중" : "시뮬레이션"}
        </button>
      </form>

      {error ? <p className="error-state">{error}</p> : null}
      {isLoading ? <p className="empty-state">경매장 후보를 탐색하고 전투력 효율을 계산하는 중이야.</p> : null}
      {result ? (
        <AccessoryRecommendationPanel recommendation={result.Recommendation} recovery={recovery} isRecoveryLoading={isRecoveryLoading} />
      ) : null}
    </section>
  );
}
