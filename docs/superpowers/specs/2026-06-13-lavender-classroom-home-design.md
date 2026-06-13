# Lavender Classroom Home Design

## 1. Feature Summary

로생상담소의 홈을 기존 상담소 화면에서 라벤더 강의실 앱 셸로 재편한다. 사용자는 짧은 라벤더 허브 오두막 인트로 뒤, 슥구가 칠판 앞에서 성장 우선순위를 설명하는 화면으로 진입한다.

1차 구현은 전체 대공사의 첫 단위다. 새 홈 셸과 `오늘의 칠판`을 production-ready 수준으로 만들고, 기존 캐릭터 조회와 슥구 상담 API 흐름은 유지한다.

## 2. Primary User Action

사용자는 홈에 들어오자마자 캐릭터명을 입력하고 `강의 시작`을 누른다.

조회 전에는 칠판이 캐릭터명 입력 행동을 안내하고, 조회 후에는 Spring Boot 계산 결과를 바탕으로 오늘 가장 먼저 볼 성장 우선순위를 요약한다.

## 3. Design Direction

### Color Strategy

- Light 기본값: 절제된 라벤더 강의실
- Dark 보조 테마: 저녁 라벤더 자습실
- 첫 방문 기본값은 `light`
- 사용자가 선택한 테마는 `localStorage`에 저장한다.

라벤더는 장식 색이 아니라 공간의 근거가 된다. 라벤더 허브 오두막, 라벤더빛 칠판, 따뜻한 목재 프레임, 슥구 강의 장면이 색을 정당화한다.

구현 CSS의 새 색상 토큰은 OKLCH로 작성한다. 기존 legacy 색상과 공존할 수 있지만, 이번 홈 셸에서 새로 정의하는 라벤더 light/dark 토큰은 대비 검증이 쉬운 OKLCH 값을 source of truth로 둔다.

### Theme Scene Sentence

로스트아크 유저가 저녁에 성장 방향을 정하려고 들어왔고, 슥구가 라벤더빛 강의실 칠판 앞에서 부담 없이 다음 행동을 정리해준다.

### References

- 기준 시안: `sketches/003-sggu-analytics-classroom`
- 보조 시안: `sketches/002-sggu-classroom-green`
- 캐릭터 기준: `docs/sggu-character-guide.md`

`003-sggu-analytics-classroom`의 좌측 내비게이션, 중앙 칠판 브리핑, 우측 슥구 상담 패널 구조를 유지한다. 색상과 상태 표현은 라벤더 테마로 재해석한다.

## 4. Scope

### Included In 1차

- 기존 `WelcomeScene`을 1초 라벤더 허브 오두막 인트로로 대체
- 새 홈 셸 컴포넌트 설계
  - `ClassroomIntro`
  - `ClassroomShell`
  - `TodayChalkboard`
  - `ClassroomThemeToggle`
- light/dark 테마 토글
- 테마 기본값 `light`
- 테마 선택값 `localStorage` 저장
- 기존 캐릭터 조회 API 흐름 연결
- 기존 슥구 상담 API 흐름 연결
- `오늘의 칠판` 상태별 표시
  - 조회 전
  - 로딩 중
  - 분석 완료
  - 오류
- 반응형 기본 구조
  - desktop: 좌측 목차, 중앙 칠판, 우측 상담
  - tablet/mobile: 상단 요약, 칠판, 상담, 목차 순으로 재배치

### Excluded From 1차

- 장비 탭 완성
- 스펙업 추천 탭 완성
- 각인, 보석, 아크패시브 탭 완성
- 새 backend API
- 새 계산 로직
- 새 이미지 생성 기반 오두막 재제작
- OS 테마 자동 추적
- 라우팅 구조 변경

후속 차수에서 `장비`와 `스펙업 추천` 탭을 깊게 완성한다.

## 5. Layout Strategy

### Overall Shell

홈은 강의실 앱 셸로 구성한다.

- Topbar: 브랜드, 주요 상태, light/dark 토글, 캐릭터 조회 CTA
- Left rail: 강의 목차
- Main: 오늘의 칠판과 캐릭터 입력
- Right panel: 슥구 상담 패널

1차에서 좌측 목차는 전체 대공사의 방향을 보여주되, 활성 탭은 `오늘의 칠판`만 둔다. 다른 탭은 `다음 강의 준비중` 또는 disabled 상태로 둔다.

### Intro

인트로는 약 1초다.

- 0.0s: 라벤더 허브가 둘러싼 오두막 외부
- 0.3s: 문틈에서 라벤더빛이 번짐
- 0.7s: 강의실 칠판과 슥구 실루엣으로 전환
- 1.0s: 홈 셸 진입 완료

`prefers-reduced-motion`에서는 인트로를 250ms 이내로 줄이거나 즉시 홈 셸로 진입한다.

### Today Chalkboard

칠판은 홈의 중심이다. 서비스 소개문보다 사용자의 다음 행동을 우선한다.

조회 전에는 캐릭터명 입력 행동을 안내한다. 조회 후에는 실제 분석 결과에서 1순위 행동을 가져와 큰 제목으로 보여준다.

## 6. Key States

### 조회 전

- 제목: `캐릭터명을 적으면 오늘의 강의가 시작됩니다.`
- 보조문: `장비, 보석, 각인, 스펙업 후보를 슥구가 칠판에 정리해드립니다.`
- 판서:
  - `1. 캐릭터명 입력`
  - `2. 공식 API 조회`
  - `3. 성장 우선순위 정리`
- CTA: `강의 시작`

### 로딩 중

- 제목: `슥구가 장비창을 펼쳐보는 중입니다.`
- 보조문: `공식 API와 시장 데이터를 확인하고 있습니다.`
- 우측 슥구: `public/sggu-thinking-closed-eyes.png`
- 칠판: skeleton 판서 3줄

### 분석 완료

제목은 추천 후보에 따라 달라진다.

- 예: `오늘은 보석부터 보는 게 좋겠습니다.`
- 예: `악세 교체보다 강화 효율이 앞섭니다.`
- 예: `지금은 가격을 다시 확인하는 편이 좋겠습니다.`

보조문:

- `전투력 상승량과 예상 비용을 함께 본 결과입니다.`

판서:

- 1순위 스펙업 후보
- 예상 비용
- 상승률 또는 효율 점수
- 주의할 점

CTA:

- `스펙업 추천 보기`
- `슥구에게 질문하기`

`스펙업 추천 보기`는 1차에서는 준비중 상태를 보여줄 수 있다.

### 오류

- `CHARACTER_NOT_FOUND`: `출석부에 없는 캐릭터입니다.`
- `MISSING_API_KEY`: `상담소 설정을 먼저 확인해야 합니다.`
- `LOSTARK_API_ERROR`: `공식 API가 잠시 불안정합니다.`
- fallback: `캐릭터 정보를 불러오지 못했습니다.`
- CTA: `다시 조회`

## 7. Interaction Model

### Character Lookup

사용자가 캐릭터명을 입력하고 제출하면 기존 `/api/characters/{name}` 흐름을 사용한다.

- submit 전: input focus와 CTA hover/focus 상태 제공
- submit 중: input과 CTA는 loading 상태
- 성공: `armory`, `upgradeEfficiency` 기반으로 칠판을 업데이트
- 실패: 오류 코드를 칠판에 표시하고 input을 다시 활성화

### Sggu Consultation

기존 `/api/consult/sggu` 흐름을 유지한다.

- 조회 전: 상담 입력은 캐릭터 조회를 유도한다.
- 조회 후: 질문 입력이 활성화된다.
- 상담 중: 슥구 생각중 상태와 말풍선을 보여준다.
- 응답 후: 우측 상담 패널에 답변을 추가한다.

### Theme Toggle

상단 우측에 `Light / Dark` 토글을 둔다.

- 기본값: `light`
- 사용자 선택 시 즉시 전환
- 선택값은 `localStorage`에 저장
- 1차에서는 OS 설정을 자동으로 따르지 않는다.

### Navigation

좌측 목차는 1차에서 다음 상태를 가진다.

- `오늘의 칠판`: active
- `장비`: disabled 또는 준비중
- `스펙업 추천`: disabled 또는 준비중
- `각인`, `보석`, `아크패시브`: 후속 차수

disabled 탭을 누르면 짧은 준비중 안내를 보여준다. 모달은 쓰지 않는다.

## 8. Content Requirements

### Topbar

- 브랜드: `로생상담소`
- 보조 라벨: `슥구의 성장 강의실`
- 테마 토글: `Light`, `Dark`
- CTA: `강의 시작`

### Left Rail

- `오늘의 칠판`
- `장비`
- `스펙업 추천`
- `각인`
- `보석`
- `아크패시브`

후속 차수 탭은 `준비중` 또는 `다음 강의` 라벨을 붙인다.

### Right Sggu Panel

- 조회 전: `캐릭터를 불러오면 질문을 받을 수 있습니다.`
- 로딩 중: `슥구가 자료를 읽고 있습니다.`
- 조회 후: `궁금한 점을 물어보세요. 계산 결과를 기준으로 답합니다.`
- 오류: `먼저 조회 문제를 해결해야 합니다.`

### Input

- placeholder: `캐릭터명을 입력하세요`
- CTA: `강의 시작`
- loading CTA: `불러오는 중`

## 9. Testing Requirements

### Unit Tests

Theme helper:

- 기본값은 `light`
- 저장된 값이 `dark`이면 복원
- 잘못된 저장값은 `light`로 fallback
- 토글하면 `localStorage`에 저장

Chalkboard helper:

- 조회 전 문구를 반환한다.
- 로딩 문구를 반환한다.
- 분석 완료 시 추천 후보 기반 제목을 반환한다.
- 오류 코드별 문구를 반환한다.

### Structure Tests

- 홈이 새 classroom 컴포넌트를 사용한다.
- production frontend가 `lib/spec` 또는 `lib/lostark`를 직접 import하지 않는다.
- 기존 API 경로 문자열은 유지된다.

### Manual Checks

- `http://localhost:3000`
- light/dark 전환
- 새로고침 후 테마 유지
- 캐릭터명 입력과 조회 흐름
- 상담 질문 흐름
- 모바일 폭에서 목차, 칠판, 상담 패널이 겹치지 않음
- `prefers-reduced-motion`에서 인트로가 즉시 지나감

## 10. Recommended Implementation References

- `impeccable/reference/product.md`: 제품 UI 안정성
- `impeccable/reference/shape.md`: 확정된 디자인 brief 유지
- `impeccable/reference/color-and-contrast.md`: 라벤더 light/dark 대비
- `impeccable/reference/motion-design.md`: 1초 인트로와 reduced motion
- `impeccable/reference/responsive-design.md`: 목차, 칠판, 상담 패널 재배치
- `impeccable/reference/interaction-design.md`: 테마 토글, disabled 탭, input 상태

## 11. Open Questions

1차 구현을 막는 미정 항목은 없다.

후속 결정:

- 실제 라벤더 오두막 bitmap asset이 필요하면 `docs/sggu-prompt-rules.md` 기준으로 별도 생성한다. 1차는 CSS 기반 장면으로 처리한다.
- 후속 차수에서 장비 탭과 스펙업 추천 탭 중 어느 쪽을 먼저 완성할지는 1차 구현 후 결정한다.
- dark theme의 최종 OKLCH 토큰은 구현 중 WCAG AA contrast check를 기준으로 확정한다.

## 12. Confirmed Decisions

- 기준 시안은 `sketches/003-sggu-analytics-classroom`.
- 전체 홈을 강의실 앱 셸로 재편한다.
- 1차 구현은 `인트로 + 강의실 셸 + 오늘의 칠판`.
- 기본 테마는 `light`.
- `dark`는 버튼으로 전환한다.
- 사용자의 테마 선택은 저장한다.
- 인트로는 약 1초다.
- 상세 분석은 후속 차수에서 좌측 목차 탭 전환 방식으로 확장한다.
