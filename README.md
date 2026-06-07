# 로생상담소

Spring Boot 기반 Lost Ark 스펙 분석 및 AI 상담 서비스

로생상담소는 Lost Ark 캐릭터명을 입력하면 공식 API와 시장가 데이터를 바탕으로 장비, 보석, 각인, 아크 패시브, 아바타 상태를 정리하고, 골드 대비 스펙업 우선순위를 계산한 뒤 로컬 LLM 상담사 "슥구"가 다음 행동을 설명해주는 백엔드 중심 웹 서비스입니다.

Next.js는 사용자가 분석 결과를 읽고 상담을 요청하는 UI 계층으로 두고, Spring Boot가 브라우저-facing API, 공식 API 연동, 데이터 정규화, 스펙업 계산, 로컬 LLM 오케스트레이션을 소유합니다.

## Portfolio Focus

- **Backend-oriented architecture:** Spring Boot BFF가 API ownership, 입력 검증, 오류 변환, 응답 DTO 조립을 담당합니다.
- **Domain analysis engine:** Lost Ark 공식 API 응답을 장비/보석/각인/아크 패시브 중심으로 정규화하고 성장 우선순위를 계산합니다.
- **AI consultation orchestration:** Ollama 기반 로컬 LLM을 호출하되, 응답 schema 검증과 deterministic fallback으로 상담 API 안정성을 유지합니다.
- **Migration discipline:** Next.js API route에서 Spring Boot BFF로 API 소유권을 이관하고, 남은 JS 계산 모델은 reference/parity-test 역할로 제한했습니다.
- **Verification-first workflow:** Node test, Spring Boot test, lint, production build, LLM smoke test로 회귀를 확인합니다.

## What It Solves

Lost Ark 성장 고민은 단순히 "아이템 레벨을 올릴까?"로 끝나지 않습니다. 장비 강화, 악세 옵션, 보석 레벨, 각인, 아바타, 시장가가 동시에 얽히기 때문에 유저는 어떤 선택이 비용 대비 효율적인지 판단하기 어렵습니다.

이 프로젝트는 그 판단 과정을 다음 흐름으로 줄입니다.

1. 캐릭터명을 입력해 공식 API 기반 데이터를 조회합니다.
2. 장비와 성장 요소를 UI에서 읽기 쉬운 형태로 정규화합니다.
3. 시장가와 전투력 추정 모델을 기반으로 스펙업 후보를 비교합니다.
4. 상위 추천 후보를 구조화된 상담 문장으로 설명합니다.
5. 로컬 LLM이 실패하거나 근거 없는 답변을 만들면 안정적인 fallback 상담으로 응답합니다.

## Architecture

![로생상담소 목표 아키텍처](./docs/architecture-local-llm.png)

```text
Browser
  -> Next.js UI
  -> /api/* same-origin requests
  -> Spring Boot BFF
      -> Lostark Open API
      -> Market snapshot and spec-up analysis
      -> Ollama local LLM
      -> Deterministic fallback
```

### Current Responsibilities

| Layer | Responsibility |
| --- | --- |
| Next.js | UI rendering, character search flow, consultation panels |
| Spring Boot | API ownership, Lostark API client, validation, error mapping |
| Analysis services | Equipment normalization, combat-power context, spec-up recommendation |
| Local LLM layer | Prompt building, Ollama call, structured response parsing, grounding check |
| JS reference models | Formula review and parity-test reference for migrated backend behavior |

API ownership details are documented in [docs/backend-api-ownership.md](./docs/backend-api-ownership.md).

## Implemented Features

- Character armory lookup through Spring-owned `/api/characters/{name}`
- Equipment, cards, engravings, gems, avatars, ark passive, ark grid normalization
- Market snapshot endpoint for growth-cost inputs
- Spec-up efficiency endpoint for top candidate recommendations
- Accessory recovery estimation endpoint
- Sggu consultation API with structured response fields
- Local LLM smoke test that requires `Source=llm`
- Fallback counseling when Ollama is unavailable, malformed, or not grounded
- Frontend and backend regression tests

## AI Design

The LLM is intentionally not the source of truth for numeric recommendations.

Spring Boot computes the recommendation candidates first. The LLM receives a compact context and turns the result into user-facing counseling. If the model output is malformed, missing required fields, or contradicts the top recommendation in efficiency-summary mode, the service falls back to deterministic counseling.

This keeps the AI layer useful for explanation while preventing it from inventing prices, gains, or unsupported priorities.

## 기술적 결정

### Spring Boot가 API를 소유하는 이유

이 프로젝트는 처음에 Next.js route handler로 API를 구현했지만, 입력 검증, 공식 API 호출, 오류 변환, 도메인 서비스, 향후 저장소 연동을 한곳에서 관리하기 위해 API 소유권을 Spring Boot로 옮겼습니다. 현재 Next.js는 사용자 경험을 렌더링하는 UI 계층에 집중합니다.

### 아직 로그인을 넣지 않는 이유

현재 핵심 흐름은 캐릭터 조회, 스펙 분석, 추천 상담이므로 계정이 없어도 문제를 해결할 수 있습니다. 로그인은 세션 보안, 계정 복구, 데이터 삭제, 정책 대응을 함께 요구하므로 사용자 필요가 명확해지기 전까지는 범위를 늘리지 않습니다. 저장 기능은 먼저 익명 분석 리포트와 공유 가능한 URL 중심으로 확장할 계획입니다.

### PostgreSQL을 계획하는 이유

분석 리포트는 캐릭터명, 직업, 아이템 레벨, 전투력처럼 안정적인 컬럼과 추천 후보, 상담 결과, 시장가 스냅샷처럼 구조가 변할 수 있는 중첩 데이터를 함께 다룹니다. PostgreSQL의 `jsonb`는 모든 게임 응답을 과도하게 정규화하지 않고도 "중요 필드는 컬럼, 변화가 잦은 리포트는 JSON"으로 저장하기에 적합합니다.

### Python은 LLM 실험 도구로만 계획하는 이유

운영 경로는 단순하게 유지합니다.

```text
Next.js -> Spring Boot -> Ollama
```

Python은 오프라인 LLM 평가, 프롬프트 비교, 모델 벤치마킹, RAG 인덱싱에 적합합니다. 하지만 운영 요청 경로에 Python 서비스를 추가하면 배포 단위, 장애 지점, timeout 처리, health check, API 계약이 늘어나므로 현재 제품 범위에서는 Spring Boot가 Ollama를 직접 호출하는 구조를 유지합니다.

## Tech Stack

| Area | Stack |
| --- | --- |
| Frontend UI | Next.js 16, React 19 |
| Backend API | Java 21, Spring Boot 4, Spring WebMVC |
| Validation and operations | Spring Validation, Spring Actuator |
| Local AI runtime | Ollama, local chat model |
| Testing | Node test runner, JUnit/Spring Boot tests |
| Planned persistence | PostgreSQL, Flyway |
| Planned AI tooling | Python `tools/llm-lab` for eval and benchmarking |

## Key API Paths

| Method | Path | Owner |
| --- | --- | --- |
| `GET` | `/api/characters/{name}` | Spring Boot |
| `GET` | `/api/market/snapshot` | Spring Boot |
| `POST` | `/api/consult/sggu` | Spring Boot |
| `GET` | `/api/efficiency/spec-up/{name}` | Spring Boot |
| `POST` | `/api/efficiency/accessories/recovery` | Spring Boot |

Next.js proxies these same-origin browser paths to Spring Boot during local development.

## Local Setup

Create `.env.local` from `.env.example`.

```bash
LOSTARK_API_KEY=your_lostark_open_api_jwt
LOCAL_LLM_PROVIDER=ollama
LOCAL_LLM_BASE_URL=http://localhost:11434
LOCAL_LLM_MODEL=qwen2.5:7b
LOCAL_LLM_TIMEOUT_MS=30000
```

Run the backend and frontend in separate terminals.

```bash
npm run dev:backend
npm run dev
```

The Spring Boot backend runs on `http://127.0.0.1:8080`. Next.js runs on `http://127.0.0.1:3000` and proxies migrated API paths to the backend.

## Local LLM Smoke Test

`npm run smoke:sggu` calls the running Next.js server at `POST /api/consult/sggu` and verifies that the request reaches Spring Boot, returns the structured consultation shape, and uses the local LLM path instead of fallback.

```bash
ollama serve
ollama pull qwen2.5:7b
npm run dev:backend
npm run dev
npm run smoke:sggu
```

If Next.js runs on a different port:

```bash
SGGU_CONSULT_BASE_URL=http://127.0.0.1:3001 npm run smoke:sggu
```

WSL users who run Ollama on Windows should set `LOCAL_LLM_BASE_URL` to the Windows host address before starting Spring Boot.

## Verification

```bash
npm test
npm run lint
npm run build

cd backend
./mvnw test
```

The smoke test requires running Next.js, Spring Boot, and Ollama:

```bash
npm run smoke:sggu
```

## Documents

- [Backend API ownership](./docs/backend-api-ownership.md)
- [Development log](./docs/development-log.md)
- [Lost Ark damage formula notes](./docs/lostark-damage-formula.md)
- [Equipment honing efficiency notes](./docs/equipment-honing-efficiency.md)
- [Next task notes](./NEXT_TASKS.md)

## Roadmap

The next improvements are scoped to strengthen the backend portfolio story without expanding into unrelated product areas.

- Add PostgreSQL report persistence for anonymous analysis reports.
- Manage schema changes through Flyway migrations.
- Add shareable report URLs without login.
- Add `tools/llm-lab` for prompt evaluation, model comparison, and grounding regression checks.
- Add demo mode with fixture data so reviewers can inspect the app without a private Lostark API key.

## Scope Boundaries

This project intentionally avoids login, payment, community features, and broad social functionality for now. The goal is to keep the portfolio focus on backend API design, domain analysis, AI response control, and verifiable service behavior.
