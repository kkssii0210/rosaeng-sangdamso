import Image from "next/image";
import ClassroomThemeToggle from "./ClassroomThemeToggle.jsx";
import TodayChalkboard from "./TodayChalkboard.jsx";
import { buildTodayChalkboardState } from "../../lib/ui/todayChalkboard.js";
import { themeClassName } from "../../lib/ui/classroomTheme.js";

function lessonItems() {
  return [
    ["오늘의 칠판", "LIVE", true],
    ["장비", "다음 강의", false],
    ["스펙업 추천", "다음 강의", false],
    ["각인", "후속", false],
    ["보석", "후속", false],
    ["아크패시브", "후속", false]
  ];
}

export default function ClassroomShell({
  theme,
  onToggleTheme,
  messages = [],
  input = "",
  onInputChange = () => {},
  onSubmit,
  isLoading = false,
  isConsulting = false,
  armory,
  specUpRecommendation,
  lookupErrorCode = "",
  inputRef
}) {
  const hasArmory = Boolean(armory);
  const chalkboardStatus = isLoading
    ? "loading"
    : lookupErrorCode
      ? "error"
      : hasArmory
        ? "ready"
        : "idle";
  const chalkboardState = buildTodayChalkboardState({
    status: chalkboardStatus,
    armory,
    specUpRecommendation,
    errorCode: lookupErrorCode
  });
  const sgguIsThinking = isLoading || isConsulting;
  const submitLabel = isLoading
    ? "불러오는 중"
    : isConsulting
      ? "상담 중"
      : hasArmory
        ? "질문하기"
        : "강의 시작";

  function focusInput() {
    inputRef?.current?.focus();
  }

  return (
    <main className={`classroom-home ${themeClassName(theme)}`}>
      <header className="classroom-topbar">
        <div className="classroom-brand" aria-label="로생상담소">
          <span className="classroom-brand-mark">슥</span>
          <span>
            <strong>로생상담소</strong>
            <small>슥구의 성장 강의실</small>
          </span>
        </div>
        <nav className="classroom-topnav" aria-label="강의실 메뉴">
          <span>오늘의 칠판</span>
          <span>성장 상담</span>
          <span>추천 기록</span>
        </nav>
        <ClassroomThemeToggle theme={theme} onToggle={onToggleTheme} />
      </header>

      <section className="classroom-layout" aria-label="슥구 강의실">
        <aside className="classroom-rail" aria-label="강의 목차">
          <div className="classroom-rail-profile">
            <span>오늘의 수강생</span>
            <strong>{armory?.profile?.CharacterName || armory?.profile?.characterName || "출석 전"}</strong>
          </div>
          <div className="classroom-lesson-list">
            {lessonItems().map(([label, meta, active]) => (
              <button
                type="button"
                key={label}
                className={active ? "active" : ""}
                disabled={!active}
                onClick={active ? focusInput : undefined}
              >
                <span>{label}</span>
                <em>{meta}</em>
              </button>
            ))}
          </div>
        </aside>

        <div className="classroom-main">
          <TodayChalkboard state={chalkboardState} isLoading={isLoading} onFocusInput={focusInput} />

          <form className="classroom-query" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="classroom-query-input">
              {hasArmory ? "슥구에게 질문 입력" : "조회할 로스트아크 캐릭터명 입력"}
            </label>
            <input
              id="classroom-query-input"
              ref={inputRef}
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={hasArmory ? "슥구에게 질문해보세요" : "캐릭터명을 입력하세요"}
              autoComplete="off"
            />
            <button type="submit" disabled={isLoading || isConsulting}>
              {submitLabel}
            </button>
          </form>
        </div>

        <aside className="classroom-advisor" aria-label="슥구 상담 패널">
          <div className="classroom-sggu-card">
            {sgguIsThinking ? <div className="sggu-thought-bubble classroom" aria-hidden="true">슥...</div> : null}
            <Image
              src={sgguIsThinking ? "/sggu-thinking-closed-eyes.png" : "/sggu-final-teacher-laser.png"}
              alt="칠판 앞에서 성장 방향을 설명하는 슥구"
              width={1024}
              height={1536}
              priority
            />
          </div>
          <div className="classroom-message-log" aria-live="polite">
            {messages.map((message, index) => (
              <p className={`classroom-message ${message.role}`} key={`${message.role}-${index}-${message.text}`}>
                {message.text}
              </p>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
