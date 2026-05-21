"use client";

import { useState } from "react";
import Image from "next/image";
import AppNavigation from "../components/AppNavigation.jsx";
import ArmoryView from "../components/ArmoryView.jsx";
import WelcomeScene from "../components/WelcomeScene.jsx";

const starterMessages = [
  {
    role: "sggu",
    text: "캐릭터명을 입력해봐. 공식 API 기준으로 장비, 아크패시브, 스킬부터 정리해줄게."
  }
];

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
  const [messages, setMessages] = useState(starterMessages);
  const [input, setInput] = useState("");
  const [armory, setArmory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  async function loadCharacter(characterName) {
    setIsLoading(true);
    setMessages([{ role: "sggu", text: "공식 API에서 장비창을 불러오는 중이야." }]);

    try {
      const response = await fetch(`/api/characters/${encodeURIComponent(characterName)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(data));
      }

      setArmory(data);
      window.localStorage.setItem("sggu:lastCharacterName", characterName);
      setMessages([
        { role: "sggu", text: "현재 너의 캐릭터 장비창이야" },
        { role: "sggu", text: "엘릭서는 제외하고 장비, 아크패시브, 스킬만 먼저 봤어." }
      ]);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "캐릭터 정보를 불러오지 못했어.";
      setMessages([{ role: "error", text: message }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    const characterName = input.trim();

    if (!characterName || isLoading) {
      return;
    }

    loadCharacter(characterName);
  }

  if (!hasEntered && !armory) {
    return <WelcomeScene onComplete={() => setHasEntered(true)} />;
  }

  return (
    <main className={`home ${armory ? "armory-home" : ""}`}>
      <AppNavigation />
      <section className={`consult-stage ${armory ? "armory-mode" : "intro-mode"}`} aria-label="슥구 성장 상담">
        <div className="advisor-rail">
          <div className="speech-bubble">
            <span className="bubble-puff puff-one" aria-hidden="true" />
            <span className="bubble-puff puff-two" aria-hidden="true" />
            <span className="bubble-puff puff-three" aria-hidden="true" />
            <span className="bubble-puff puff-four" aria-hidden="true" />
            <div className="bubble-kicker" aria-hidden="true">
              <span className="bubble-kicker-dot" />
              슥구 상담소
            </div>
            <div className="message-log" aria-live="polite">
              {messages.map((message, index) => (
                <div className={`message ${message.role}`} key={`${message.role}-${index}-${message.text}`}>
                  {message.text}
                </div>
              ))}
            </div>

            <form className="chat-form" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="consult-input">
                조회할 로스트아크 캐릭터명 입력
              </label>
              <input
                id="consult-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="캐릭터명을 입력해줘"
                autoComplete="off"
              />
              <button type="submit" disabled={isLoading}>
                {isLoading ? "조회중" : "조회"}
              </button>
            </form>
          </div>

          <div className="sggu-wrap">
            <Image
              src="/sggu-cutout.png"
              alt="검은 정장을 입은 슥구 캐릭터"
              width={1024}
              height={1536}
              className="sggu-character"
              priority
            />
            <div className="sggu-name" aria-hidden="true">
              슥구
            </div>
            <div className="ground-shadow" aria-hidden="true" />
          </div>
        </div>

        {armory ? <ArmoryView armory={armory} /> : null}
      </section>
    </main>
  );
}
