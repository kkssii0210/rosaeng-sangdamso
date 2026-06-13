"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ClassroomIntro from "../components/classroom/ClassroomIntro.jsx";
import ClassroomShell from "../components/classroom/ClassroomShell.jsx";
import { resolveAnalysisCharacterName } from "../lib/ui/efficiencyNavigation.js";
import {
  nextClassroomTheme,
  readStoredClassroomTheme,
  writeStoredClassroomTheme
} from "../lib/ui/classroomTheme.js";
import {
  appendAssistantMessage,
  appendErrorMessage,
  appendUserMessage,
  buildConsultRequestBody,
  createInitialConsultMessages,
  getConsultErrorMessage,
  getConsultDisplayText
} from "../lib/ui/sgguConsultantState.js";

const apiErrorMessages = {
  MISSING_API_KEY: "공식 Lostark Open API 키가 필요해. .env.local에 LOSTARK_API_KEY를 설정해줘.",
  CHARACTER_NOT_FOUND: "해당 캐릭터를 찾지 못했어.",
  LOSTARK_API_ERROR: "공식 Lostark API 응답이 불안정해. 잠시 후 다시 조회해줘.",
  INVALID_CHARACTER_NAME: "조회할 캐릭터명을 입력해줘."
};

function getApiErrorMessage(data) {
  return apiErrorMessages[data?.code] || data?.message || "캐릭터 정보를 불러오지 못했어.";
}

export default function Home() {
  const [messages, setMessages] = useState(() => createInitialConsultMessages());
  const [input, setInput] = useState("");
  const [armory, setArmory] = useState(null);
  const [specUpRecommendation, setSpecUpRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConsulting, setIsConsulting] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isCheckingRoute, setIsCheckingRoute] = useState(true);
  const [lookupErrorCode, setLookupErrorCode] = useState("");
  const [classroomTheme, setClassroomTheme] = useState("light");
  const autoLoadStartedRef = useRef(false);
  const consultInFlightRef = useRef(false);
  const inputRef = useRef(null);

  const loadCharacter = useCallback(async (characterName) => {
    setLookupErrorCode("");
    setIsLoading(true);
    setArmory(null);
    setSpecUpRecommendation(null);
    setMessages([{ role: "sggu", text: "공식 API에서 장비창을 불러오는 중이야." }]);

    try {
      const response = await fetch(`/api/characters/${encodeURIComponent(characterName)}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(getApiErrorMessage(data));
        error.code = data?.code || "";
        throw error;
      }

      setArmory(data);
      setSpecUpRecommendation(Array.isArray(data?.upgradeEfficiency?.Candidates)
        ? {
          Recommendation: {
            TopCandidates: data.upgradeEfficiency.Candidates.slice(0, 5)
          }
        }
        : null);
      window.localStorage.setItem("sggu:lastCharacterName", characterName);
      setInput("");
      setMessages([
        { role: "sggu", text: "현재 너의 캐릭터 장비창이야" },
        { role: "sggu", text: "엘릭서는 제외하고 장비, 아크패시브, 스킬만 먼저 봤어." }
      ]);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "캐릭터 정보를 불러오지 못했어.";
      setArmory(null);
      setSpecUpRecommendation(null);
      setLookupErrorCode(caughtError instanceof Error ? caughtError.code || "" : "");
      setMessages([{ role: "error", text: message }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryCharacterName = resolveAnalysisCharacterName(searchParams);

    if (!queryCharacterName || autoLoadStartedRef.current) {
      setIsCheckingRoute(false);
      return;
    }

    autoLoadStartedRef.current = true;
    setHasEntered(true);
    setInput(queryCharacterName);
    setIsCheckingRoute(false);
    loadCharacter(queryCharacterName);
  }, [loadCharacter]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setClassroomTheme(readStoredClassroomTheme(window.localStorage));
    }
  }, []);

  const askSggu = useCallback(async (question) => {
    if (!armory || consultInFlightRef.current) {
      return;
    }

    const conversation = messages;

    consultInFlightRef.current = true;
    setIsConsulting(true);
    setMessages(appendUserMessage(conversation, question));
    setInput("");

    try {
      const response = await fetch("/api/consult/sggu", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(buildConsultRequestBody({
          message: question,
          conversation,
          armory,
          specUpRecommendation
        }))
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getConsultErrorMessage(data));
      }

      const answer = getConsultDisplayText(data);

      if (!answer) {
        throw new Error("슥구 상담 응답을 불러오지 못했어.");
      }

      setMessages((currentMessages) => appendAssistantMessage(currentMessages, answer));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "슥구 상담 응답을 불러오지 못했어.";
      setMessages((currentMessages) => appendErrorMessage(currentMessages, message));
    } finally {
      consultInFlightRef.current = false;
      setIsConsulting(false);
    }
  }, [armory, messages, specUpRecommendation]);

  const toggleClassroomTheme = useCallback(() => {
    setClassroomTheme((currentTheme) => {
      const nextTheme = nextClassroomTheme(currentTheme);

      if (typeof window !== "undefined") {
        writeStoredClassroomTheme(window.localStorage, nextTheme);
      }

      return nextTheme;
    });
  }, []);

  function handleSubmit(event) {
    event.preventDefault();

    const submittedInput = input.trim();

    if (!submittedInput || isLoading || isConsulting) {
      return;
    }

    if (armory) {
      askSggu(submittedInput);
      return;
    }

    loadCharacter(submittedInput);
  }

  if (isCheckingRoute && !armory) {
    return null;
  }

  if (!hasEntered && !armory) {
    return <ClassroomIntro onComplete={() => setHasEntered(true)} />;
  }

  return (
    <ClassroomShell
      theme={classroomTheme}
      onToggleTheme={toggleClassroomTheme}
      messages={messages}
      input={input}
      onInputChange={setInput}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      isConsulting={isConsulting}
      armory={armory}
      specUpRecommendation={specUpRecommendation}
      lookupErrorCode={lookupErrorCode}
      inputRef={inputRef}
    />
  );
}
