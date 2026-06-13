# Lavender Classroom Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first lavender classroom homepage slice: 1-second intro, classroom shell, light/dark theme toggle, and `오늘의 칠판`.

**Architecture:** Keep existing character lookup and Sggu consultation API flows in `app/page.jsx`, but move the visual shell into focused components under `components/classroom/`. Put pure UI state derivation in `lib/ui/` helpers so tests can cover theme persistence and chalkboard copy without a browser renderer.

**Tech Stack:** Next.js 16, React 19, Node test runner, plain CSS in `app/globals.css`, browser `localStorage`.

---

## File Structure

- Create `lib/ui/classroomTheme.js`
  - Owns valid theme values, localStorage key, normalization, persistence helpers, and next-theme resolution.
- Create `lib/ui/todayChalkboard.js`
  - Converts current home state into display copy for the chalkboard.
- Create `components/classroom/ClassroomIntro.jsx`
  - 1-second lavender herb cabin intro with reduced-motion shortcut.
- Create `components/classroom/ClassroomThemeToggle.jsx`
  - Light/dark segmented toggle.
- Create `components/classroom/TodayChalkboard.jsx`
  - Renders chalkboard title, notes, CTAs, and skeleton state.
- Create `components/classroom/ClassroomShell.jsx`
  - Owns the new home layout: topbar, left rail, main chalkboard/input, right Sggu panel.
- Modify `app/page.jsx`
  - Replace `WelcomeScene`, `SgguConsultantChat`, and the old intro/armory layout with `ClassroomIntro` and `ClassroomShell`.
  - Keep existing fetch calls and state transitions.
- Modify `app/globals.css`
  - Add classroom theme tokens and layout styles at the end of the file.
  - Do not remove old styles in this slice; they are still used by `/efficiency` and other components.
- Create `tests/classroomTheme.test.js`
  - Unit tests for theme helper behavior.
- Create `tests/todayChalkboard.test.js`
  - Unit tests for chalkboard state copy.
- Create `tests/classroomHomeStructure.test.js`
  - Source-level structure guard for the first slice.

## Task 1: Theme Helper

**Files:**
- Create: `tests/classroomTheme.test.js`
- Create: `lib/ui/classroomTheme.js`

- [ ] **Step 1: Write the failing theme helper test**

Create `tests/classroomTheme.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASSROOM_THEME_STORAGE_KEY,
  nextClassroomTheme,
  normalizeClassroomTheme,
  readStoredClassroomTheme,
  themeClassName,
  writeStoredClassroomTheme
} from "../lib/ui/classroomTheme.js";

function createStorage(initialValue) {
  const values = new Map();

  if (initialValue !== undefined) {
    values.set(CLASSROOM_THEME_STORAGE_KEY, initialValue);
  }

  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    valueOf: (key = CLASSROOM_THEME_STORAGE_KEY) => values.get(key)
  };
}

test("normalizes classroom theme values", () => {
  assert.equal(normalizeClassroomTheme("light"), "light");
  assert.equal(normalizeClassroomTheme("dark"), "dark");
  assert.equal(normalizeClassroomTheme("lavender"), "light");
  assert.equal(normalizeClassroomTheme(null), "light");
});

test("reads the stored classroom theme with light fallback", () => {
  assert.equal(readStoredClassroomTheme(createStorage("dark")), "dark");
  assert.equal(readStoredClassroomTheme(createStorage("broken")), "light");
  assert.equal(readStoredClassroomTheme(null), "light");
});

test("writes only normalized classroom theme values", () => {
  const storage = createStorage();

  assert.equal(writeStoredClassroomTheme(storage, "dark"), "dark");
  assert.equal(storage.valueOf(), "dark");
  assert.equal(writeStoredClassroomTheme(storage, "unknown"), "light");
  assert.equal(storage.valueOf(), "light");
});

test("resolves next classroom theme and class name", () => {
  assert.equal(nextClassroomTheme("light"), "dark");
  assert.equal(nextClassroomTheme("dark"), "light");
  assert.equal(nextClassroomTheme("invalid"), "dark");
  assert.equal(themeClassName("dark"), "classroom-theme-dark");
  assert.equal(themeClassName("invalid"), "classroom-theme-light");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- tests/classroomTheme.test.js
```

Expected: FAIL with `Cannot find module '../lib/ui/classroomTheme.js'`.

- [ ] **Step 3: Implement the theme helper**

Create `lib/ui/classroomTheme.js`:

```js
export const CLASSROOM_THEME_STORAGE_KEY = "sggu:classroom-theme";
export const CLASSROOM_THEMES = ["light", "dark"];

export function normalizeClassroomTheme(value) {
  return CLASSROOM_THEMES.includes(value) ? value : "light";
}

export function readStoredClassroomTheme(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return "light";
  }

  return normalizeClassroomTheme(storage.getItem(CLASSROOM_THEME_STORAGE_KEY));
}

export function writeStoredClassroomTheme(storage, theme) {
  const normalizedTheme = normalizeClassroomTheme(theme);

  if (storage && typeof storage.setItem === "function") {
    storage.setItem(CLASSROOM_THEME_STORAGE_KEY, normalizedTheme);
  }

  return normalizedTheme;
}

export function nextClassroomTheme(theme) {
  return normalizeClassroomTheme(theme) === "dark" ? "light" : "dark";
}

export function themeClassName(theme) {
  return `classroom-theme-${normalizeClassroomTheme(theme)}`;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
npm test -- tests/classroomTheme.test.js
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add tests/classroomTheme.test.js lib/ui/classroomTheme.js
git commit -m "test: add classroom theme helper"
```

## Task 2: Today Chalkboard Helper

**Files:**
- Create: `tests/todayChalkboard.test.js`
- Create: `lib/ui/todayChalkboard.js`

- [ ] **Step 1: Write the failing chalkboard helper test**

Create `tests/todayChalkboard.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildTodayChalkboardState } from "../lib/ui/todayChalkboard.js";

test("builds idle chalkboard copy before lookup", () => {
  const state = buildTodayChalkboardState({ status: "idle" });

  assert.equal(state.variant, "idle");
  assert.equal(state.title, "캐릭터명을 적으면 오늘의 강의가 시작됩니다.");
  assert.deepEqual(state.notes.map((note) => note.title), [
    "캐릭터명 입력",
    "공식 API 조회",
    "성장 우선순위 정리"
  ]);
  assert.equal(state.primaryActionLabel, "강의 시작");
});

test("builds loading chalkboard copy", () => {
  const state = buildTodayChalkboardState({ status: "loading" });

  assert.equal(state.variant, "loading");
  assert.equal(state.title, "슥구가 장비창을 펼쳐보는 중입니다.");
  assert.equal(state.description, "공식 API와 시장 데이터를 확인하고 있습니다.");
  assert.equal(state.notes.length, 3);
});

test("builds completed chalkboard copy from a top candidate", () => {
  const state = buildTodayChalkboardState({
    status: "ready",
    armory: {
      profile: {
        CharacterName: "붐버",
        CharacterClassName: "스카우터"
      }
    },
    specUpRecommendation: {
      Recommendation: {
        TopCandidates: [
          {
            Label: "겁화 보석 8레벨 -> 9레벨",
            NetCostGold: 92000,
            GainPercent: 1.28,
            Caveat: "경매장 최저가 기준"
          }
        ]
      }
    }
  });

  assert.equal(state.variant, "ready");
  assert.equal(state.kicker, "붐버 · 스카우터");
  assert.equal(state.title, "오늘은 보석부터 보는 게 좋겠습니다.");
  assert.deepEqual(state.notes.map((note) => note.value), [
    "겁화 보석 8레벨 -> 9레벨",
    "92,000골드",
    "+1.28%"
  ]);
  assert.equal(state.caution, "경매장 최저가 기준");
});

test("uses fallback completed copy without candidates", () => {
  const state = buildTodayChalkboardState({
    status: "ready",
    armory: { profile: { CharacterName: "붐버" } },
    specUpRecommendation: null
  });

  assert.equal(state.title, "지금은 가격을 다시 확인하는 편이 좋겠습니다.");
  assert.equal(state.notes[0].value, "추천 후보 없음");
});

test("maps lookup error codes to chalkboard copy", () => {
  assert.equal(
    buildTodayChalkboardState({ status: "error", errorCode: "CHARACTER_NOT_FOUND" }).title,
    "출석부에 없는 캐릭터입니다."
  );
  assert.equal(
    buildTodayChalkboardState({ status: "error", errorCode: "MISSING_API_KEY" }).title,
    "상담소 설정을 먼저 확인해야 합니다."
  );
  assert.equal(
    buildTodayChalkboardState({ status: "error", errorCode: "LOSTARK_API_ERROR" }).title,
    "공식 API가 잠시 불안정합니다."
  );
  assert.equal(
    buildTodayChalkboardState({ status: "error", errorCode: "UNKNOWN" }).title,
    "캐릭터 정보를 불러오지 못했습니다."
  );
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- tests/todayChalkboard.test.js
```

Expected: FAIL with `Cannot find module '../lib/ui/todayChalkboard.js'`.

- [ ] **Step 3: Implement the chalkboard helper**

Create `lib/ui/todayChalkboard.js`:

```js
const errorTitles = {
  CHARACTER_NOT_FOUND: "출석부에 없는 캐릭터입니다.",
  MISSING_API_KEY: "상담소 설정을 먼저 확인해야 합니다.",
  LOSTARK_API_ERROR: "공식 API가 잠시 불안정합니다."
};

function valueOf(source, keys, fallback = "") {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }

  return fallback;
}

function formatGold(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? `${new Intl.NumberFormat("ko-KR").format(Math.round(number))}골드`
    : "가격 확인 필요";
}

function formatGain(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? `+${number.toFixed(2)}%` : "상승량 확인 필요";
}

function topCandidateOf(specUpRecommendation) {
  const candidates = specUpRecommendation?.Recommendation?.TopCandidates;
  return Array.isArray(candidates) && candidates.length > 0 ? candidates[0] : null;
}

function titleForCandidate(candidate) {
  const label = String(candidate?.Label || candidate?.label || "");

  if (/보석|겁화|작열|멸화|홍염/.test(label)) {
    return "오늘은 보석부터 보는 게 좋겠습니다.";
  }

  if (/악세|목걸이|귀걸이|반지/.test(label)) {
    return "악세 교체를 먼저 비교해봅시다.";
  }

  if (/강화|무기|방어구/.test(label)) {
    return "강화 효율을 먼저 확인합시다.";
  }

  return label ? `오늘의 1순위는 ${label}입니다.` : "지금은 가격을 다시 확인하는 편이 좋겠습니다.";
}

export function buildTodayChalkboardState({
  status = "idle",
  armory = null,
  specUpRecommendation = null,
  errorCode = ""
} = {}) {
  if (status === "loading") {
    return {
      variant: "loading",
      kicker: "자료 확인",
      title: "슥구가 장비창을 펼쳐보는 중입니다.",
      description: "공식 API와 시장 데이터를 확인하고 있습니다.",
      notes: [
        { title: "공식 API", value: "조회 중" },
        { title: "성장 후보", value: "정리 중" },
        { title: "상담 준비", value: "판서 중" }
      ],
      primaryActionLabel: "불러오는 중",
      secondaryActionLabel: ""
    };
  }

  if (status === "error") {
    return {
      variant: "error",
      kicker: "조회 실패",
      title: errorTitles[errorCode] || "캐릭터 정보를 불러오지 못했습니다.",
      description: "캐릭터명과 상담소 설정을 확인한 뒤 다시 조회하세요.",
      notes: [
        { title: "확인 1", value: "캐릭터명" },
        { title: "확인 2", value: "API 상태" },
        { title: "확인 3", value: "잠시 후 재시도" }
      ],
      primaryActionLabel: "다시 조회",
      secondaryActionLabel: ""
    };
  }

  if (status === "ready") {
    const profile = armory?.profile || {};
    const characterName = valueOf(profile, ["CharacterName", "characterName"], "캐릭터");
    const characterClassName = valueOf(profile, ["CharacterClassName", "characterClassName"], "");
    const candidate = topCandidateOf(specUpRecommendation);
    const label = candidate?.Label || candidate?.label || "추천 후보 없음";

    return {
      variant: "ready",
      kicker: characterClassName ? `${characterName} · ${characterClassName}` : characterName,
      title: titleForCandidate(candidate),
      description: "전투력 상승량과 예상 비용을 함께 본 결과입니다.",
      notes: [
        { title: "1순위", value: label },
        { title: "예상 비용", value: formatGold(valueOf(candidate, ["NetCostGold", "netCostGold"])) },
        { title: "예상 상승", value: formatGain(valueOf(candidate, ["GainPercent", "gainPercent"])) }
      ],
      caution: candidate?.Caveat || candidate?.caveat || "",
      primaryActionLabel: "스펙업 추천 보기",
      secondaryActionLabel: "슥구에게 질문하기"
    };
  }

  return {
    variant: "idle",
    kicker: "입장 준비",
    title: "캐릭터명을 적으면 오늘의 강의가 시작됩니다.",
    description: "장비, 보석, 각인, 스펙업 후보를 슥구가 칠판에 정리해드립니다.",
    notes: [
      { title: "캐릭터명 입력", value: "출석부에 이름 적기" },
      { title: "공식 API 조회", value: "장비창 확인" },
      { title: "성장 우선순위 정리", value: "오늘의 숙제 받기" }
    ],
    primaryActionLabel: "강의 시작",
    secondaryActionLabel: ""
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
npm test -- tests/todayChalkboard.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit Task 2**

```bash
git add tests/todayChalkboard.test.js lib/ui/todayChalkboard.js
git commit -m "test: add today chalkboard helper"
```

## Task 3: Classroom Home Structure Guard

**Files:**
- Create: `tests/classroomHomeStructure.test.js`

- [ ] **Step 1: Write the failing structure test**

Create `tests/classroomHomeStructure.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readText(path) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("classroom home component files exist", () => {
  const files = [
    "components/classroom/ClassroomIntro.jsx",
    "components/classroom/ClassroomShell.jsx",
    "components/classroom/ClassroomThemeToggle.jsx",
    "components/classroom/TodayChalkboard.jsx"
  ];

  for (const file of files) {
    assert.equal(existsSync(join(rootDir, file)), true, `${file} should exist`);
  }
});

test("home page uses the classroom shell and keeps Spring API paths", () => {
  const source = readText("app/page.jsx");

  assert.match(source, /ClassroomIntro/);
  assert.match(source, /ClassroomShell/);
  assert.match(source, /\/api\/characters\/\$\{encodeURIComponent\(characterName\)\}/);
  assert.match(source, /\/api\/consult\/sggu/);
  assert.doesNotMatch(source, /WelcomeScene/);
  assert.doesNotMatch(source, /SgguConsultantChat/);
});

test("classroom styles are present in global css", () => {
  const source = readText("app/globals.css");

  assert.match(source, /classroom-home/);
  assert.match(source, /classroom-theme-light/);
  assert.match(source, /classroom-theme-dark/);
  assert.match(source, /classroom-chalkboard/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- tests/classroomHomeStructure.test.js
```

Expected: FAIL because `components/classroom/ClassroomIntro.jsx should exist`.

- [ ] **Step 3: Commit the failing structure test**

```bash
git add tests/classroomHomeStructure.test.js
git commit -m "test: guard classroom home structure"
```

## Task 4: Classroom Components

**Files:**
- Create: `components/classroom/ClassroomIntro.jsx`
- Create: `components/classroom/ClassroomThemeToggle.jsx`
- Create: `components/classroom/TodayChalkboard.jsx`
- Create: `components/classroom/ClassroomShell.jsx`

- [ ] **Step 1: Create `ClassroomIntro`**

Create `components/classroom/ClassroomIntro.jsx`:

```jsx
"use client";

import { useCallback, useEffect, useRef } from "react";

const INTRO_DURATION_MS = 1000;
const REDUCED_MOTION_DURATION_MS = 150;

export default function ClassroomIntro({ onComplete }) {
  const completedRef = useRef(false);

  const finishIntro = useCallback(() => {
    if (completedRef.current) {
      return;
    }

    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      finishIntro,
      prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS
    );

    return () => window.clearTimeout(timer);
  }, [finishIntro]);

  return (
    <section className="classroom-intro" aria-label="라벤더 강의실 입장">
      <div className="classroom-intro-sky" aria-hidden="true" />
      <div className="classroom-intro-cabin" aria-hidden="true">
        <span className="classroom-intro-door" />
      </div>
      <div className="classroom-intro-herbs" aria-hidden="true" />
      <p className="classroom-intro-title">라벤더 강의실로 입장합니다.</p>
      <button type="button" className="classroom-intro-skip" onClick={finishIntro}>
        바로 입장
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Create `ClassroomThemeToggle`**

Create `components/classroom/ClassroomThemeToggle.jsx`:

```jsx
export default function ClassroomThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="classroom-theme-toggle"
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-pressed={isDark}
      onClick={onToggle}
    >
      <span className={isDark ? "" : "active"}>Light</span>
      <span className={isDark ? "active" : ""}>Dark</span>
    </button>
  );
}
```

- [ ] **Step 3: Create `TodayChalkboard`**

Create `components/classroom/TodayChalkboard.jsx`:

```jsx
export default function TodayChalkboard({ state, isLoading, onFocusInput }) {
  return (
    <section className={`classroom-chalkboard ${state.variant}`} aria-labelledby="today-chalkboard-title">
      <div className="classroom-chalk-dust" aria-hidden="true" />
      <div className="classroom-chalkboard-content">
        <p className="classroom-board-kicker">{state.kicker}</p>
        <h1 id="today-chalkboard-title">{state.title}</h1>
        <p className="classroom-board-description">{state.description}</p>

        <div className="classroom-board-notes" aria-label="칠판 판서">
          {state.notes.map((note) => (
            <article className="classroom-board-note" key={`${note.title}-${note.value}`}>
              <span>{note.title}</span>
              <strong>{isLoading ? " " : note.value}</strong>
            </article>
          ))}
        </div>

        {state.caution ? <p className="classroom-board-caution">{state.caution}</p> : null}

        <div className="classroom-board-actions">
          <button type="button" className="classroom-board-primary" onClick={onFocusInput} disabled={isLoading}>
            {state.primaryActionLabel}
          </button>
          {state.secondaryActionLabel ? (
            <button type="button" className="classroom-board-secondary" onClick={onFocusInput}>
              {state.secondaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `ClassroomShell`**

Create `components/classroom/ClassroomShell.jsx`:

```jsx
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
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  isConsulting,
  armory,
  specUpRecommendation,
  lookupErrorCode,
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
    inputRef.current?.focus();
  }

  function handlePreparedLessonClick(event) {
    event.currentTarget.blur();
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
                aria-disabled={!active}
                onClick={active ? focusInput : handlePreparedLessonClick}
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
```

- [ ] **Step 5: Run the structure test and verify the remaining failures**

Run:

```bash
npm test -- tests/classroomHomeStructure.test.js
```

Expected: still FAIL because `app/page.jsx` does not yet use `ClassroomShell`.

- [ ] **Step 6: Commit Task 4**

```bash
git add components/classroom
git commit -m "feat: add classroom home components"
```

## Task 5: Wire The Home Page

**Files:**
- Modify: `app/page.jsx`

- [ ] **Step 1: Replace the imports in `app/page.jsx`**

Replace the old visual imports:

```jsx
import Image from "next/image";
import AppNavigation from "../components/AppNavigation.jsx";
import ArmoryView from "../components/ArmoryView.jsx";
import SgguConsultantChat from "../components/SgguConsultantChat.jsx";
import WelcomeScene from "../components/WelcomeScene.jsx";
import { pickSgguThinkingMessage } from "../lib/ui/sgguThinkingMessages.js";
```

with:

```jsx
import ClassroomIntro from "../components/classroom/ClassroomIntro.jsx";
import ClassroomShell from "../components/classroom/ClassroomShell.jsx";
import {
  nextClassroomTheme,
  readStoredClassroomTheme,
  writeStoredClassroomTheme
} from "../lib/ui/classroomTheme.js";
```

Keep the existing imports for:

```jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { resolveAnalysisCharacterName } from "../lib/ui/efficiencyNavigation.js";
import {
  appendAssistantMessage,
  appendErrorMessage,
  appendUserMessage,
  buildConsultRequestBody,
  createInitialConsultMessages,
  getConsultErrorMessage,
  getConsultDisplayText
} from "../lib/ui/sgguConsultantState.js";
```

- [ ] **Step 2: Add theme, input ref, and lookup error state**

Inside `Home`, after existing state declarations, use this state block:

```jsx
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
```

Remove `sgguThoughtMessage` from this page. Thinking copy is local to the classroom shell in this slice.

Add this effect after the existing route-checking effect:

```jsx
useEffect(() => {
  if (typeof window !== "undefined") {
    setClassroomTheme(readStoredClassroomTheme(window.localStorage));
  }
}, []);
```

- [ ] **Step 3: Update `loadCharacter` error handling**

At the start of `loadCharacter`, clear previous lookup errors:

```jsx
setLookupErrorCode("");
```

When a response is not OK, throw an error with code:

```jsx
if (!response.ok) {
  const error = new Error(getApiErrorMessage(data));
  error.code = data?.code || "";
  throw error;
}
```

In the `catch` block, set the new error state:

```jsx
const message = caughtError instanceof Error ? caughtError.message : "캐릭터 정보를 불러오지 못했어.";
setArmory(null);
setSpecUpRecommendation(null);
setLookupErrorCode(caughtError instanceof Error ? caughtError.code || "" : "");
setMessages([{ role: "error", text: message }]);
```

- [ ] **Step 4: Add the theme toggle callback**

Add this callback before `handleSubmit`:

```jsx
const toggleClassroomTheme = useCallback(() => {
  setClassroomTheme((currentTheme) => {
    const nextTheme = nextClassroomTheme(currentTheme);

    if (typeof window !== "undefined") {
      writeStoredClassroomTheme(window.localStorage, nextTheme);
    }

    return nextTheme;
  });
}, []);
```

- [ ] **Step 5: Replace the old JSX return**

Replace the old `WelcomeScene` and `<main className="home">` return block with:

```jsx
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
```

Keep this guard above it:

```jsx
if (isCheckingRoute && !armory) {
  return null;
}
```

- [ ] **Step 6: Run the structure test and verify the CSS failure remains**

Run:

```bash
npm test -- tests/classroomHomeStructure.test.js
```

Expected: FAIL because `app/globals.css` does not yet contain `classroom-home`.

- [ ] **Step 7: Commit Task 5**

```bash
git add app/page.jsx
git commit -m "feat: wire classroom home shell"
```

## Task 6: Classroom Styles

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Append classroom CSS tokens and layout**

Append this block to the end of `app/globals.css`:

```css
.classroom-home {
  --classroom-bg: oklch(96% 0.018 302deg);
  --classroom-surface: oklch(99% 0.008 300deg);
  --classroom-surface-strong: oklch(94% 0.025 302deg);
  --classroom-ink: oklch(24% 0.035 292deg);
  --classroom-muted: oklch(48% 0.035 292deg);
  --classroom-line: oklch(86% 0.026 300deg);
  --classroom-board: oklch(30% 0.083 296deg);
  --classroom-board-deep: oklch(22% 0.066 296deg);
  --classroom-chalk: oklch(96% 0.018 304deg);
  --classroom-accent: oklch(48% 0.145 295deg);
  --classroom-accent-soft: oklch(86% 0.055 300deg);
  --classroom-wood: oklch(54% 0.082 65deg);
  --classroom-error: oklch(55% 0.17 28deg);
  min-height: 100vh;
  min-height: 100dvh;
  padding: 18px;
  color: var(--classroom-ink);
  background:
    radial-gradient(circle at 10% 0%, oklch(78% 0.08 300deg / 0.26), transparent 30%),
    radial-gradient(circle at 88% 4%, oklch(68% 0.09 280deg / 0.16), transparent 28%),
    linear-gradient(180deg, oklch(98% 0.014 302deg), var(--classroom-bg));
}

.classroom-theme-dark {
  --classroom-bg: oklch(18% 0.035 292deg);
  --classroom-surface: oklch(23% 0.04 292deg);
  --classroom-surface-strong: oklch(28% 0.052 292deg);
  --classroom-ink: oklch(93% 0.016 304deg);
  --classroom-muted: oklch(74% 0.031 304deg);
  --classroom-line: oklch(37% 0.05 292deg);
  --classroom-board: oklch(20% 0.058 296deg);
  --classroom-board-deep: oklch(15% 0.044 296deg);
  --classroom-chalk: oklch(94% 0.019 304deg);
  --classroom-accent: oklch(78% 0.083 300deg);
  --classroom-accent-soft: oklch(34% 0.062 296deg);
  --classroom-wood: oklch(48% 0.075 65deg);
  --classroom-error: oklch(70% 0.14 28deg);
  background:
    radial-gradient(circle at 10% 0%, oklch(50% 0.09 300deg / 0.20), transparent 32%),
    radial-gradient(circle at 86% 8%, oklch(64% 0.08 280deg / 0.14), transparent 30%),
    linear-gradient(180deg, oklch(21% 0.04 292deg), var(--classroom-bg));
}

.classroom-topbar,
.classroom-rail,
.classroom-advisor,
.classroom-query {
  border: 1px solid var(--classroom-line);
  border-radius: 16px;
  background: color-mix(in oklch, var(--classroom-surface) 92%, transparent);
  box-shadow: 0 18px 44px oklch(22% 0.055 292deg / 0.10);
}

.classroom-topbar {
  max-width: 1440px;
  min-height: 66px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  margin: 0 auto 18px;
  padding: 10px 12px;
}

.classroom-brand {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  font-weight: 900;
}

.classroom-brand-mark {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--classroom-chalk);
  background: linear-gradient(135deg, var(--classroom-board), var(--classroom-accent));
}

.classroom-brand strong,
.classroom-brand small {
  display: block;
}

.classroom-brand small,
.classroom-topnav,
.classroom-board-description,
.classroom-message-log {
  color: var(--classroom-muted);
}

.classroom-topnav {
  justify-self: center;
  display: inline-flex;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
}

.classroom-theme-toggle {
  display: inline-grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  min-height: 40px;
  padding: 4px;
  border: 1px solid var(--classroom-line);
  border-radius: 12px;
  color: var(--classroom-muted);
  background: var(--classroom-surface-strong);
}

.classroom-theme-toggle span {
  min-width: 58px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 850;
}

.classroom-theme-toggle span.active {
  color: var(--classroom-chalk);
  background: var(--classroom-accent);
}

.classroom-layout {
  max-width: 1440px;
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr) 312px;
  gap: 18px;
  align-items: start;
  margin: 0 auto;
}

.classroom-rail,
.classroom-advisor {
  position: sticky;
  top: 18px;
  padding: 14px;
}

.classroom-rail-profile {
  display: grid;
  gap: 4px;
  padding: 4px 4px 14px;
  border-bottom: 1px solid var(--classroom-line);
}

.classroom-rail-profile span,
.classroom-lesson-list em {
  color: var(--classroom-muted);
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.classroom-lesson-list {
  display: grid;
  gap: 7px;
  padding-top: 12px;
}

.classroom-lesson-list button {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 0;
  border-radius: 11px;
  padding: 8px 10px;
  color: var(--classroom-ink);
  background: transparent;
  font-weight: 850;
  text-align: left;
}

.classroom-lesson-list button.active {
  background: var(--classroom-accent-soft);
}

.classroom-lesson-list button[aria-disabled="true"] {
  opacity: 0.66;
}

.classroom-main {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.classroom-chalkboard {
  min-height: 470px;
  position: relative;
  overflow: hidden;
  border: 10px solid var(--classroom-wood);
  border-radius: 16px;
  color: var(--classroom-chalk);
  background:
    radial-gradient(circle at 22% 28%, oklch(100% 0.01 300deg / 0.08), transparent 23%),
    linear-gradient(135deg, var(--classroom-board), var(--classroom-board-deep));
  box-shadow:
    inset 0 0 0 1px oklch(100% 0.01 300deg / 0.10),
    0 26px 70px oklch(19% 0.045 292deg / 0.18);
}

.classroom-chalk-dust {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(oklch(100% 0.01 300deg / 0.13) 1px, transparent 1px);
  background-size: 18px 18px;
  opacity: 0.28;
}

.classroom-chalkboard-content {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: center;
  min-height: 470px;
  padding: clamp(22px, 4vw, 42px);
}

.classroom-board-kicker {
  width: fit-content;
  margin: 0 0 18px;
  padding: 6px 11px;
  border: 1px solid oklch(94% 0.019 304deg / 0.24);
  border-radius: 999px;
  color: oklch(88% 0.05 302deg);
  font-size: 12px;
  font-weight: 900;
}

.classroom-chalkboard h1 {
  max-width: 720px;
  margin: 0;
  font-size: 52px;
  line-height: 1.05;
  letter-spacing: 0;
  word-break: keep-all;
}

.classroom-board-description {
  max-width: 560px;
  margin: 16px 0 0;
  color: oklch(91% 0.025 304deg / 0.86);
  font-weight: 780;
}

.classroom-board-notes {
  width: min(100%, 720px);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 30px;
}

.classroom-board-note {
  min-height: 86px;
  display: grid;
  gap: 8px;
  align-content: center;
  padding: 14px;
  border: 1px solid oklch(94% 0.019 304deg / 0.14);
  border-radius: 14px;
  background: oklch(18% 0.045 296deg / 0.28);
}

.classroom-board-note span {
  color: oklch(86% 0.048 302deg);
  font-size: 12px;
  font-weight: 850;
}

.classroom-board-note strong {
  min-height: 20px;
  font-size: 16px;
  word-break: keep-all;
}

.classroom-chalkboard.loading .classroom-board-note strong {
  border-radius: 999px;
  color: transparent;
  background: oklch(94% 0.019 304deg / 0.24);
}

.classroom-board-caution {
  max-width: 560px;
  margin: 16px 0 0;
  color: oklch(88% 0.055 80deg);
  font-weight: 820;
}

.classroom-board-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 26px;
}

.classroom-board-primary,
.classroom-board-secondary,
.classroom-query button {
  min-height: 42px;
  border-radius: 11px;
  padding: 10px 14px;
  font-weight: 900;
}

.classroom-board-primary,
.classroom-query button {
  border: 1px solid var(--classroom-accent);
  color: var(--classroom-chalk);
  background: var(--classroom-accent);
}

.classroom-board-secondary {
  border: 1px solid oklch(94% 0.019 304deg / 0.28);
  color: var(--classroom-chalk);
  background: transparent;
}

.classroom-query {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding: 10px;
}

.classroom-query input {
  min-width: 0;
  border: 1px solid var(--classroom-line);
  border-radius: 11px;
  padding: 0 13px;
  color: var(--classroom-ink);
  background: var(--classroom-surface);
  font-weight: 800;
}

.classroom-query input:focus-visible,
.classroom-query button:focus-visible,
.classroom-theme-toggle:focus-visible,
.classroom-board-primary:focus-visible,
.classroom-board-secondary:focus-visible,
.classroom-lesson-list button:focus-visible {
  outline: 3px solid color-mix(in oklch, var(--classroom-accent) 45%, transparent);
  outline-offset: 2px;
}

.classroom-advisor {
  display: grid;
  gap: 12px;
}

.classroom-sggu-card {
  min-height: 220px;
  position: relative;
  display: grid;
  place-items: end center;
  overflow: hidden;
  border: 1px solid var(--classroom-line);
  border-radius: 14px;
  background: linear-gradient(180deg, var(--classroom-surface-strong), var(--classroom-surface));
}

.classroom-sggu-card img {
  width: min(86%, 220px);
  height: auto;
  display: block;
  filter: drop-shadow(0 18px 20px oklch(19% 0.045 292deg / 0.16));
}

.sggu-thought-bubble.classroom {
  top: 16px;
  left: 16px;
}

.classroom-message-log {
  display: grid;
  gap: 9px;
  max-height: 360px;
  overflow: auto;
}

.classroom-message,
.classroom-error-message {
  margin: 0;
  padding: 11px 12px;
  border: 1px solid var(--classroom-line);
  border-radius: 12px;
  background: var(--classroom-surface);
  color: var(--classroom-ink);
  font-size: 13px;
  font-weight: 760;
  line-height: 1.5;
}

.classroom-message.user {
  background: var(--classroom-accent-soft);
}

.classroom-message.error,
.classroom-error-message {
  border-color: color-mix(in oklch, var(--classroom-error) 45%, var(--classroom-line));
  color: var(--classroom-error);
}

.classroom-intro {
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
  display: grid;
  place-items: end center;
  overflow: hidden;
  padding: 28px;
  color: oklch(23% 0.045 292deg);
  background:
    radial-gradient(circle at 18% 72%, oklch(70% 0.11 300deg / 0.34), transparent 23%),
    radial-gradient(circle at 78% 78%, oklch(78% 0.08 300deg / 0.36), transparent 26%),
    linear-gradient(180deg, oklch(96% 0.026 302deg), oklch(88% 0.044 302deg));
  animation: classroomIntroFade 1000ms cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

.classroom-intro-cabin {
  width: min(64vw, 320px);
  height: 170px;
  position: relative;
  z-index: 2;
  margin-bottom: 72px;
  border: 1px solid oklch(46% 0.06 292deg / 0.28);
  border-radius: 18px 18px 10px 10px;
  background: linear-gradient(180deg, oklch(49% 0.055 65deg), oklch(32% 0.044 65deg));
  box-shadow: 0 24px 48px oklch(26% 0.067 292deg / 0.24);
}

.classroom-intro-cabin::before {
  content: "";
  position: absolute;
  left: -22px;
  right: -22px;
  top: -58px;
  height: 72px;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
  background: linear-gradient(135deg, oklch(42% 0.044 65deg), oklch(24% 0.035 65deg));
}

.classroom-intro-door {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 68px;
  height: 116px;
  transform: translateX(-50%);
  border-radius: 12px 12px 0 0;
  background: linear-gradient(90deg, oklch(17% 0.038 292deg) 0 42%, oklch(78% 0.08 300deg) 43% 55%, oklch(22% 0.052 292deg) 56%);
  box-shadow: 0 0 34px oklch(78% 0.08 300deg / 0.62);
}

.classroom-intro-herbs {
  position: absolute;
  z-index: 3;
  left: 8%;
  right: 8%;
  bottom: 42px;
  height: 86px;
  border-radius: 999px 999px 0 0;
  background:
    radial-gradient(ellipse at 14% 72%, oklch(58% 0.19 300deg) 0 8px, transparent 9px),
    radial-gradient(ellipse at 28% 54%, oklch(70% 0.13 300deg) 0 9px, transparent 10px),
    radial-gradient(ellipse at 42% 72%, oklch(52% 0.17 300deg) 0 8px, transparent 9px),
    radial-gradient(ellipse at 58% 58%, oklch(78% 0.08 300deg) 0 9px, transparent 10px),
    radial-gradient(ellipse at 72% 74%, oklch(58% 0.19 300deg) 0 8px, transparent 9px),
    radial-gradient(ellipse at 88% 58%, oklch(70% 0.13 300deg) 0 9px, transparent 10px),
    linear-gradient(180deg, transparent 0 42%, oklch(42% 0.07 145deg / 0.34) 43% 100%);
}

.classroom-intro-title {
  position: absolute;
  left: 24px;
  bottom: 24px;
  z-index: 4;
  margin: 0;
  font-weight: 900;
}

.classroom-intro-skip {
  position: absolute;
  right: 24px;
  bottom: 20px;
  z-index: 4;
  border: 1px solid oklch(46% 0.06 292deg / 0.28);
  border-radius: 11px;
  padding: 10px 13px;
  color: oklch(23% 0.045 292deg);
  background: oklch(99% 0.01 300deg / 0.80);
  font-weight: 850;
}

@keyframes classroomIntroFade {
  0% {
    opacity: 1;
  }

  86% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}

@media (max-width: 1120px) {
  .classroom-layout {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .classroom-advisor {
    position: static;
    grid-column: 1 / -1;
    grid-template-columns: 220px minmax(0, 1fr);
  }
}

@media (max-width: 820px) {
  .classroom-home {
    padding: 10px;
  }

  .classroom-topbar,
  .classroom-layout,
  .classroom-advisor,
  .classroom-query,
  .classroom-board-notes {
    grid-template-columns: 1fr;
  }

  .classroom-topnav {
    justify-self: stretch;
    overflow-x: auto;
  }

  .classroom-rail,
  .classroom-advisor {
    position: static;
  }

  .classroom-chalkboard h1 {
    font-size: 38px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .classroom-intro {
    animation-duration: 150ms;
  }

  .classroom-home *,
  .classroom-intro * {
    transition: none !important;
  }
}
```

- [ ] **Step 2: Run the structure test and verify it passes**

Run:

```bash
npm test -- tests/classroomHomeStructure.test.js
```

Expected: PASS, 3 tests.

- [ ] **Step 3: Commit Task 6**

```bash
git add app/globals.css
git commit -m "style: add lavender classroom shell"
```

## Task 7: Full Verification

**Files:**
- No source modifications

- [ ] **Step 1: Run focused frontend tests**

Run:

```bash
npm test -- tests/classroomTheme.test.js tests/todayChalkboard.test.js tests/classroomHomeStructure.test.js tests/projectStructure.test.js tests/sgguConsultantState.test.js
```

Expected: PASS, no failures.

- [ ] **Step 2: Run full frontend tests**

Run with local server permission if the smoke test needs localhost bind:

```bash
npm test
```

Expected: PASS, all tests.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit code 0.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Run diff whitespace check**

Run:

```bash
git diff --check
```

Expected: no output except possible line-ending warnings from existing files.

## Task 8: Browser Smoke Check

**Files:**
- No source modifications unless a verified issue is found

- [ ] **Step 1: Start or restart both dev servers**

Run:

```bash
npm run dev:backend
```

In another session:

```bash
npm run dev:restart
```

Expected:

- Backend logs `Tomcat started on port 8080`.
- Frontend logs `Local: http://localhost:3000`.

- [ ] **Step 2: Check HTTP health**

Run:

```bash
curl -s http://127.0.0.1:8080/actuator/health
curl -s -o /tmp/lostark-classroom-home.html -w "%{http_code}" http://127.0.0.1:3000/
```

Expected:

- Backend response includes `"status":"UP"`.
- Frontend status prints `200`.

- [ ] **Step 3: Manual UI checks**

Open `http://localhost:3000` and verify:

- Intro lasts about 1 second.
- `바로 입장` skips the intro.
- Light theme is shown by default.
- Theme toggle switches to dark.
- Refresh keeps the selected theme.
- 캐릭터명 입력 submits lookup.
- Loading state shows chalkboard skeleton and thinking Sggu.
- Error state writes an error on the chalkboard.
- Right Sggu panel remains readable on desktop.
- At mobile width, topbar, rail, chalkboard, query, and advisor stack without overlap.

- [ ] **Step 4: Commit final fixes if manual checks required changes**

If no changes were made, do not create a commit.

If changes were made:

```bash
git add app/page.jsx app/globals.css components/classroom lib/ui tests
git commit -m "fix: polish classroom home slice"
```

## Task 9: Development Log And Push

**Files:**
- Modify: `docs/development-log.md`

- [ ] **Step 1: Add a development-log entry**

Append a `2026-06-13` subsection under the existing date entry or add a new date entry if the existing entry is not present. Include:

```md
### 라벤더 강의실 홈 1차 설계/구현

- 003 슥구 분석 강의실 시안을 기준으로 홈을 라벤더 강의실 셸로 전환했다.
- 1초 라벤더 허브 오두막 인트로를 추가했다.
- 기본 light 테마와 dark 테마 토글을 추가하고 선택값을 저장했다.
- 오늘의 칠판 상태를 조회 전, 로딩 중, 분석 완료, 오류로 나눴다.
- 기존 캐릭터 조회와 슥구 상담 API 흐름은 유지했다.

### 검증

- `npm test`
- `npm run lint`
- `npm run build`
- `git diff --check`
```

- [ ] **Step 2: Run final status and log checks**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected:

- Only intentional files are modified.
- Recent commits show the classroom helper/component/style work.

- [ ] **Step 3: Commit development log**

```bash
git add docs/development-log.md
git commit -m "docs: log lavender classroom home work"
```

- [ ] **Step 4: Push when approved**

Run:

```bash
git push origin main
```

Expected:

- Output includes `main -> main`.
