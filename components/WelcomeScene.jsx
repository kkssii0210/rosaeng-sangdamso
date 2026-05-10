"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
const DOOR_OPEN_DELAY_MS = 3100;
const INTRO_DURATION_MS = 7200;

function playTone(context, output, { frequency, start, duration, volume, type = "sine" }) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
}

function playCricket(context, output) {
  const now = context.currentTime;

  playTone(context, output, { frequency: 4200, start: now, duration: 0.06, volume: 0.045, type: "square" });
  playTone(context, output, { frequency: 3700, start: now + 0.08, duration: 0.055, volume: 0.034, type: "square" });
}

function playOwl(context, output) {
  const now = context.currentTime;

  playTone(context, output, { frequency: 390, start: now, duration: 0.42, volume: 0.055 });
  playTone(context, output, { frequency: 300, start: now + 0.42, duration: 0.58, volume: 0.045 });
}

function playDoorCreak(context, output) {
  const now = context.currentTime;
  const creakGain = context.createGain();
  const filter = context.createBiquadFilter();
  const oscillator = context.createOscillator();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(780, now);
  filter.frequency.exponentialRampToValueAtTime(260, now + 0.95);

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(190, now);
  oscillator.frequency.exponentialRampToValueAtTime(76, now + 1.05);

  creakGain.gain.setValueAtTime(0.001, now);
  creakGain.gain.linearRampToValueAtTime(0.12, now + 0.08);
  creakGain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

  oscillator.connect(filter);
  filter.connect(creakGain);
  creakGain.connect(output);
  oscillator.start(now);
  oscillator.stop(now + 1.2);
}

function createAudioEnvironment() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  const context = new AudioContextConstructor();
  const master = context.createGain();
  const ambient = context.createGain();
  const timers = [];

  master.gain.value = 0.14;
  ambient.gain.value = 0.8;
  ambient.connect(master);
  master.connect(context.destination);

  function startAmbient() {
    context.resume();
    playCricket(context, ambient);
    timers.push(window.setInterval(() => playCricket(context, ambient), 640));
    timers.push(window.setInterval(() => playOwl(context, ambient), 4800));
  }

  function stop() {
    timers.forEach((timer) => window.clearInterval(timer));
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0.001, context.currentTime, 0.18);
    window.setTimeout(() => context.close(), 420);
  }

  startAmbient();

  return {
    playCreak: () => playDoorCreak(context, master),
    stop
  };
}

export default function WelcomeScene({ onComplete }) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef(null);
  const completedRef = useRef(false);
  const doorOpenedRef = useRef(false);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.stop();
      audioRef.current = null;
    }
  }, []);

  const finishIntro = useCallback(() => {
    if (completedRef.current) {
      return;
    }

    completedRef.current = true;
    stopAudio();
    onComplete();
  }, [onComplete, stopAudio]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      const reducedMotionTimer = window.setTimeout(finishIntro, 250);
      return () => window.clearTimeout(reducedMotionTimer);
    }

    const doorTimer = window.setTimeout(() => {
      doorOpenedRef.current = true;
      audioRef.current?.playCreak();
    }, DOOR_OPEN_DELAY_MS);
    const finishTimer = window.setTimeout(finishIntro, INTRO_DURATION_MS);

    return () => {
      window.clearTimeout(doorTimer);
      window.clearTimeout(finishTimer);
      stopAudio();
    };
  }, [finishIntro, stopAudio]);

  function enableSound() {
    if (soundEnabled || audioRef.current) {
      return;
    }

    const audio = createAudioEnvironment();

    if (!audio) {
      return;
    }

    audioRef.current = audio;
    setSoundEnabled(true);

    if (doorOpenedRef.current) {
      audio.playCreak();
    }
  }

  return (
    <section className="welcome-scene" aria-label="로생상담소 입장">
      <div className="welcome-backdrop welcome-exterior" aria-hidden="true" />
      <div className="welcome-door-bloom" aria-hidden="true" />
      <div className="welcome-backdrop welcome-interior" aria-hidden="true">
        <Image
          src="/sggu-seated.png"
          alt=""
          width={720}
          height={1080}
          className="seated-sggu-asset"
          priority
        />
      </div>

      <div className="welcome-vignette" aria-hidden="true" />

      <div className="welcome-title">
        <p>로생상담소</p>
        <h1>숲 끝의 상담소</h1>
      </div>

      <div className="welcome-controls">
        <button type="button" className="welcome-control" onClick={enableSound} disabled={soundEnabled}>
          {soundEnabled ? "소리 켜짐" : "소리 켜기"}
        </button>
        <button type="button" className="welcome-control ghost" onClick={finishIntro}>
          건너뛰기
        </button>
      </div>
    </section>
  );
}
