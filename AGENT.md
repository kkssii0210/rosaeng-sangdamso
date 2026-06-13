# AGENT.md

이 문서는 AI coding agent가 로생상담소를 수정할 때 지켜야 할 프로젝트 규칙이다.
목표는 기능을 많이 붙이는 것이 아니라, 백엔드 중심 포트폴리오로 일관된 구조를 유지하는 것이다.

## Project Identity

로생상담소는 Spring Boot 기반 Lost Ark 스펙 분석 및 AI 상담 서비스다.

- 포지션은 full-stack 일반론보다 backend-oriented portfolio에 가깝다.
- Next.js는 사용자 화면과 상호작용을 담당한다.
- Spring Boot는 API ownership, Lostark API 연동, 입력 검증, 오류 변환, 도메인 계산, LLM orchestration을 담당한다.
- AI는 추천 수치를 결정하는 주체가 아니라, 계산된 결과를 설명하는 상담 계층이다.

## Architecture Invariants

- 브라우저는 same-origin `/api/*` 경로만 호출한다.
- 활성 API behavior는 Spring Boot가 소유한다.
- Next.js `app/api/*` route handler를 새로 만들지 않는다.
- Spring-owned API 경로를 바꿀 때는 `docs/backend-api-ownership.md`도 함께 확인한다.
- JS `lib/lostark/*`, `lib/spec/*`는 reference/parity-test 또는 UI adapter 용도로만 다룬다.

## Backend Rules

- 새 API, 검증, 오류 매핑, 공식 API 호출은 Spring Boot 쪽에 구현한다.
- 컨트롤러는 요청/응답 경계를 담당하고, 계산 로직은 서비스/도메인 계층에 둔다.
- 외부 API 실패, API key 누락, 캐릭터 없음은 구분 가능한 오류로 유지한다.
- Lostark API key나 민감한 환경값을 브라우저로 노출하지 않는다.

## Frontend Rules

- Next.js는 UI 상태, 화면 구성, same-origin API 호출만 담당한다.
- UI에서 Lostark Open API를 직접 호출하지 않는다.
- UI 컴포넌트 안에 도메인 계산 규칙을 새로 만들지 않는다.
- 복잡한 표시 변환은 `lib/ui/*` adapter를 우선 사용한다.

## Sggu Asset Rules

- 슥구 이미지나 애니메이션을 만들기 전에는 `docs/sggu-character-guide.md`를 먼저 읽는다.
- 이미지 생성, inpaint, ComfyUI 프롬프트를 작성할 때는 `docs/sggu-prompt-rules.md`도 함께 따른다.
- 기준 에셋은 `public/sggu-cutout.png`다.
- 새 슥구를 텍스트 프롬프트만으로 재생성하지 않는다.
- 가능한 경우 기준 컷아웃을 CSS, canvas, transform, mask, overlay로 움직인다.
- 새 프레임이나 파생 이미지를 만들 때도 머리, 눈, 눈썹, 얼굴 비율이 기준 에셋과 같은 캐릭터로 보여야 한다.

## AI Consultation Rules

- LLM은 Spring Boot가 계산한 추천 결과를 사용자에게 설명한다.
- LLM 응답이 malformed, unsupported, ungrounded이면 deterministic fallback을 사용한다.
- LLM이 가격, 상승량, 우선순위를 임의로 만들어내게 하지 않는다.
- 운영 요청 경로는 `Next.js -> Spring Boot -> Ollama`로 유지한다.
- Python은 운영 서비스가 아니라 `tools/llm-lab` 같은 평가/실험 도구로만 고려한다.

## Domain Formula Rules

스펙업 효율, 전투력, 피해량, 장비 강화 공식을 수정하기 전에는 아래 문서를 먼저 읽는다.

- `docs/lostark-damage-formula.md`
- `docs/equipment-honing-efficiency.md`

공식이나 추정 기준을 바꾸면 코드, 테스트, 문서를 같은 변경에서 맞춘다.

## Persistence Scope

현재 로그인은 범위 밖이다.

- 우선순위는 PostgreSQL 기반 익명 분석 리포트 저장이다.
- schema 변경은 Flyway migration으로 관리한다.
- 계정, 결제, 커뮤니티, 소셜 기능은 명확한 필요가 생기기 전까지 추가하지 않는다.

## Documentation Rules

- 현재 방향은 `README.md`, `PRODUCT.md`, `docs/backend-api-ownership.md`를 기준으로 판단한다.
- `docs/superpowers/plans/*`와 과거 spec 문서는 실행 기록 또는 아카이브일 수 있으므로 현재 구조의 source of truth로 보지 않는다.
- 구조나 책임 경계를 바꾸면 관련 문서를 함께 갱신한다.

## Verification Checklist

변경 범위에 맞춰 확인한다.

- Frontend/reference logic: `npm test`
- Frontend lint: `npm run lint`
- Production build: `npm run build`
- Backend: `cd backend && ./mvnw test`
- LLM path 변경: Ollama 사용 가능한 환경에서 Sggu smoke test 확인

검증하지 못한 항목은 완료 보고에 명시한다.

## What Not To Do

- Next.js API route를 되살리지 않는다.
- UI 컴포넌트에 도메인 계산식을 새로 넣지 않는다.
- LLM을 숫자 추천의 source of truth로 만들지 않는다.
- 로그인, 결제, 커뮤니티 기능을 포트폴리오 경쟁력이라는 이유만으로 추가하지 않는다.
- 과거 계획 문서를 현재 요구사항처럼 그대로 따르지 않는다.
