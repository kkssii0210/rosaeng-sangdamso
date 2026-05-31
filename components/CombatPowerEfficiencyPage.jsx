"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AccessoryRecommendationPanel from "./AccessoryRecommendationPanel.jsx";
import SpecUpRecommendationPanel from "./SpecUpRecommendationPanel.jsx";
import {
  buildEfficiencyConsultRequestBody,
  createEfficiencyConsultationState,
  resolveEfficiencyAdvisorMessage
} from "../lib/ui/efficiencyConsultationState.js";
import { buildAnalysisHref, resolveEfficiencyCharacterName } from "../lib/ui/efficiencyNavigation.js";

function buildFallbackConsultationResponse(errorMessage) {
  return {
    Source: "fallback",
    DisplayText: "계산 결과는 정리됐어. 추천 후보의 비용과 전투력 상승폭을 먼저 비교해보자.",
    Diagnosis: "슥구 상담 응답을 불러오지 못해서 계산 결과 기준의 기본 요약으로 정리했어.",
    Recommendation: "효율 점수가 높은 후보부터 보고, 순비용과 전투력 상승폭이 납득되는 항목을 먼저 검토해줘.",
    Caution: errorMessage || "실제 구매 전에는 경매장 매물, 거래 가능 횟수, 현재 보유 골드를 다시 확인해야 해.",
    NextAction: "상위 추천 후보를 장바구니처럼 비교한 뒤 가장 부담이 낮은 스펙업부터 진행해보자."
  };
}

function ConsultationField({ label, value }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function EfficiencyConsultationCard({ consultation }) {
  const response = consultation.response;

  return (
    <section className="efficiency-consultation-card" aria-labelledby="efficiency-consultation-title">
      <div>
        <p className="eyebrow">Sggu Consultation</p>
        <h2 id="efficiency-consultation-title">슥구 효율 상담</h2>
      </div>

      {consultation.status === "loading" || !response ? (
        <div className="efficiency-consultation-loading" role="status" aria-live="polite">
          <strong>슥구가 결과를 정리하고 있어.</strong>
          <p>슥구가 계산 결과를 읽고 상담 메모를 정리하고 있어.</p>
        </div>
      ) : (
        <div className="efficiency-consultation-grid">
          <ConsultationField label="Diagnosis" value={response.Diagnosis} />
          <ConsultationField label="Recommendation" value={response.Recommendation} />
          <ConsultationField label="Caution" value={response.Caution} />
          <ConsultationField label="NextAction" value={response.NextAction} />
        </div>
      )}
    </section>
  );
}

export default function CombatPowerEfficiencyPage() {
  const router = useRouter();
  const [characterName, setCharacterName] = useState("");
  const [result, setResult] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [consultation, setConsultation] = useState(() => createEfficiencyConsultationState());
  const [isCheckingEntry, setIsCheckingEntry] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [error, setError] = useState("");
  const requestInFlightRef = useRef(false);
  const consultationRequestIdRef = useRef(0);
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

  const loadConsultation = useCallback(async (calculationResult) => {
    const requestId = ++consultationRequestIdRef.current;

    setConsultation({
      status: "loading",
      response: null,
      error: ""
    });

    try {
      const response = await fetch("/api/consult/sggu", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildEfficiencyConsultRequestBody({ result: calculationResult }))
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message || "슥구 상담 응답을 불러오지 못했어.");
      }

      if (requestId !== consultationRequestIdRef.current) {
        return;
      }

      setConsultation({
        status: data?.Source === "fallback" ? "fallback" : "ready",
        response: data,
        error: ""
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "슥구 상담 응답을 불러오지 못했어.";

      if (requestId !== consultationRequestIdRef.current) {
        return;
      }

      setConsultation({
        status: "fallback",
        response: buildFallbackConsultationResponse(message),
        error: message
      });
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
    consultationRequestIdRef.current += 1;
    setConsultation(createEfficiencyConsultationState());

    try {
      const response = await fetch(`/api/efficiency/spec-up/${encodeURIComponent(normalizedName)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "전투력 효율을 계산하지 못했어.");
      }

      setResult(data);
      loadConsultation(data);
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
  }, [loadConsultation, loadRecovery]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const searchParams = new URLSearchParams(window.location.search);
      const initialName = resolveEfficiencyCharacterName({
        searchParams
      });

      if (!initialName) {
        router.replace("/");
        return;
      }

      setCharacterName(initialName);
      setIsCheckingEntry(false);
      loadRecommendationByName(initialName);
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadRecommendationByName, router]);

  function loadRecommendation(event) {
    event.preventDefault();
    loadRecommendationByName(characterName);
  }

  const advisorMessage = error
    ? "자료를 읽는 중에 막힌 부분이 있어. 캐릭터명과 API 상태를 확인하고 다시 계산해보자."
    : resolveEfficiencyAdvisorMessage({
      isLoading,
      consultation,
      result
    });

  if (isCheckingEntry) {
    return null;
  }

  return (
    <section className="efficiency-shell" aria-labelledby="efficiency-title">
      <div className="efficiency-hero">
        <Image
          src="/efficiency-consult-room.png"
          alt=""
          fill
          priority
          sizes="(max-width: 760px) 100vw, 1120px"
          className="efficiency-room-image"
        />
        <div className="efficiency-hero-content">
          <div className="efficiency-sggu-stage" aria-hidden="true">
            <Image
              src="/sggu-welcome-canonical.png"
              alt=""
              width={1024}
              height={1536}
              priority
              className="efficiency-sggu"
            />
          </div>

          <div className="efficiency-consult-copy">
            <Link className="efficiency-back-link" href={analysisHref}>
              캐릭터 분석으로 돌아가기
            </Link>
            <p className="eyebrow">Sggu Efficiency Counsel</p>
            <h1 id="efficiency-title">{characterName} 전투력 효율 상담</h1>
            <p className="efficiency-lede">
              현재 장비, 강화 기대비용, 경매장 후보를 같은 책상 위에 올려두고 다음 스펙업 순서를 정리해볼게.
            </p>

            <div className="efficiency-advisor-note" role="status" aria-live="polite">
              <span>슥구 상담 메모</span>
              <p>{advisorMessage}</p>
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
                {isLoading ? "계산 중" : "다시 계산"}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="efficiency-results-flow">
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
            <EfficiencyConsultationCard consultation={consultation} />
          </>
        ) : null}
      </div>
    </section>
  );
}
