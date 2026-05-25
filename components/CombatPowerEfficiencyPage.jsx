"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AccessoryRecommendationPanel from "./AccessoryRecommendationPanel.jsx";
import SpecUpRecommendationPanel from "./SpecUpRecommendationPanel.jsx";
import { buildAnalysisHref, resolveEfficiencyCharacterName } from "../lib/ui/efficiencyNavigation.js";

export default function CombatPowerEfficiencyPage() {
  const [characterName, setCharacterName] = useState("");
  const [result, setResult] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [error, setError] = useState("");
  const requestInFlightRef = useRef(false);
  const analysisHref = buildAnalysisHref(result?.CharacterName || characterName);

  const loadRecovery = useCallback(async (top) => {
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
  }, []);

  const loadRecommendationByName = useCallback(async (name) => {
    const normalizedName = name.trim();

    if (!normalizedName || requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    setIsLoading(true);
    setError("");
    setResult(null);
    setRecovery(null);

    try {
      const response = await fetch(`/api/efficiency/spec-up/${encodeURIComponent(normalizedName)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "전투력 효율을 계산하지 못했어.");
      }

      setResult(data);
      window.localStorage.setItem("sggu:lastCharacterName", normalizedName);

      const top = data?.Recommendation?.AccessoryRecommendation?.TopRecommendation;
      if (top) {
        loadRecovery(top);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "전투력 효율을 계산하지 못했어.");
    } finally {
      setIsLoading(false);
      requestInFlightRef.current = false;
    }
  }, [loadRecovery]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const searchParams = new URLSearchParams(window.location.search);
      const initialName = resolveEfficiencyCharacterName({
        searchParams,
        recentCharacterName: window.localStorage.getItem("sggu:lastCharacterName") || ""
      });

      setCharacterName(initialName);

      if (searchParams.has("character") && initialName) {
        loadRecommendationByName(initialName);
      }
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadRecommendationByName]);

  function loadRecommendation(event) {
    event.preventDefault();
    loadRecommendationByName(characterName);
  }

  return (
    <section className="efficiency-shell" aria-labelledby="efficiency-title">
      <div className="efficiency-header">
        <Link className="efficiency-back-link" href={analysisHref}>
          캐릭터 분석으로 돌아가기
        </Link>
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
      {isLoading ? <p className="empty-state">경매장 후보와 강화 기대비용을 같이 계산하는 중이야.</p> : null}
      {result ? (
        <>
          <SpecUpRecommendationPanel recommendation={result.Recommendation} />
          <AccessoryRecommendationPanel
            recommendation={result.Recommendation?.AccessoryRecommendation}
            recovery={recovery}
            isRecoveryLoading={isRecoveryLoading}
          />
        </>
      ) : null}
    </section>
  );
}
