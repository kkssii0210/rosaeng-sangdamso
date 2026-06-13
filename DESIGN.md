---
version: alpha
name: Project Design System
description: AI coding agents를 위한 프로젝트 디자인 시스템

colors:
  primary: "#111827"
  secondary: "#6B7280"
  tertiary: "#2563EB"
  neutral: "#F9FAFB"
  surface: "#FFFFFF"
  on-surface: "#111827"
  error: "#DC2626"

typography:
  headline-lg:
    fontFamily: Pretendard
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Pretendard
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.02em
  body-md:
    fontFamily: Pretendard
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: Pretendard
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  label-md:
    fontFamily: Pretendard
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  section: 64px

rounded:
  sm: 6px
  md: 12px
  lg: 20px
  full: 9999px

components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "#1D4ED8"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 12px
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview
이 디자인 시스템은 차분하고 현대적인 제품 경험을 목표로 한다. 전체 분위기는 깔끔하고 실용적이어야 하며, 불필요한 장식보다 정보 전달의 명확성을 우선한다. 화면은 가볍고 정돈되어 보여야 하고, 타이포그래피와 간격으로 위계를 만든다.

## Colors
색상은 중립적인 바탕 위에 하나의 선명한 액센트 컬러를 사용하는 구조다.

- **Primary (#111827):** 핵심 텍스트와 강한 대비가 필요한 제목에 사용한다.
- **Secondary (#6B7280):** 보조 텍스트, 설명, 메타데이터, 경계 요소에 사용한다.
- **Tertiary (#2563EB):** 주요 CTA와 인터랙션 강조에만 사용한다.
- **Neutral (#F9FAFB):** 전체 페이지 배경의 기본 톤으로 사용한다.
- **Surface (#FFFFFF):** 카드, 입력창, 모달 등 내용 레이어에 사용한다.
- **Error (#DC2626):** 오류 상태와 경고 메시지에만 사용한다.

한 화면에서 강한 포인트 컬러는 남용하지 않는다. 가장 중요한 액션 1개에만 시각적 우선순위를 준다.

## Typography
타이포그래피는 명확한 정보 계층을 만드는 데 집중한다.

- 헤드라인은 굵고 간결해야 하며, 한눈에 구조가 읽혀야 한다.
- 본문은 긴 텍스트를 읽기 편하도록 line-height를 충분히 확보한다.
- 라벨과 버튼 텍스트는 짧고 또렷해야 하며, 본문보다 약간 더 단단한 인상을 준다.

## Layout
레이아웃은 넉넉한 여백과 일정한 리듬을 유지해야 한다.

- 기본 간격 단위는 8px 계열로 운용한다.
- 섹션 간 간격은 충분히 크게 두어 콘텐츠 블록이 명확히 분리되게 한다.
- 모바일에서는 단일 컬럼 중심, 데스크톱에서는 넓은 여백을 활용한 2단 또는 제한된 최대 너비 레이아웃을 사용한다.
- 콘텐츠는 화면 끝까지 붙지 않도록 항상 안전한 좌우 패딩을 유지한다.

## Elevation & Depth
깊이는 과한 그림자보다 배경 톤 차이와 경계선으로 표현한다. 카드와 패널은 흰색 surface 위에 놓이고, 페이지 배경은 더 부드러운 neutral 톤으로 유지한다. 그림자는 필요할 때만 약하게 사용한다.

## Shapes
전반적인 shape language는 부드럽지만 과하게 둥글지 않다. 버튼, 카드, 입력창은 일관된 radius 체계를 따라야 한다. pill 형태는 태그나 상태 표시처럼 제한적인 곳에서만 사용한다.

## Components
버튼, 카드, 입력창은 단순하고 일관되어야 한다.

- **Primary Button:** 가장 중요한 액션에만 사용한다.
- **Secondary Button:** 덜 중요한 액션이나 보조 동작에 사용한다.
- **Card:** 내용을 안정적으로 묶는 기본 컨테이너다.
- **Input:** 읽기 쉽고 충분한 내부 여백을 가져야 하며, 상태 변화는 색상과 경계선으로 분명히 전달한다.

## Character Assets
슥구 캐릭터는 제품 경험의 핵심 시각 자산이다. 새 슥구 이미지나 애니메이션을 만들 때는 `docs/sggu-character-guide.md`를 먼저 따르고, 기준 에셋은 `public/sggu-cutout.png`로 삼는다. 이미지 생성 프롬프트와 ComfyUI/inpaint 작업은 `docs/sggu-prompt-rules.md`를 기준으로 작성한다.

## Do's and Don'ts
- Do 가장 중요한 액션 하나만 강하게 강조한다.
- Do 여백과 타이포그래피로 정보 위계를 만든다.
- Do 중립 배경과 명확한 surface 구분을 유지한다.
- Don't 한 화면에 여러 개의 강한 포인트 컬러를 섞지 않는다.
- Don't radius 스타일을 컴포넌트마다 제각각 쓰지 않는다.
- Don't 작은 텍스트를 과도하게 촘촘하게 배치하지 않는다.
