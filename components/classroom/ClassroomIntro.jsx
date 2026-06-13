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
    onComplete?.();
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
