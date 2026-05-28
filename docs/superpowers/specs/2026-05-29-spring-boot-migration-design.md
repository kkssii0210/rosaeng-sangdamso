# Spring Boot Migration Design

Date: 2026-05-29

## Decision

Spring Boot becomes the long-term backend BFF for Rosaeng Sangdamso. Next.js remains the frontend and should eventually stop owning application API behavior.

The migration uses a strangler approach. Keep the current Next.js API routes while Spring Boot reaches response parity, then move frontend traffic to Spring Boot-backed routes, then delete the replaced Next.js API routes.

## Goals

- Make backend boundaries clear: Next.js renders UI; Spring Boot owns API behavior.
- Keep Lostark API keys, retry policy, timeout policy, upstream error mapping, cache, and server-side integrations in Spring Boot.
- Move domain normalization and calculation logic into Spring Boot without losing the accuracy already captured in JavaScript fixtures.
- Keep the visible frontend experience stable while the backend changes.
- Finish with no production-critical `app/api/*` route left in Next.js.

## Current State

Next.js currently owns most backend behavior:

- `app/api/characters/[name]/route.js` fetches Lostark armory data, normalizes equipment/cards/gems/engravings, runs combat-power and upgrade-efficiency calculations, and returns the UI DTO.
- `app/api/market/snapshot/route.js` calls Lostark market and auction endpoints through JavaScript modules.
- `app/api/consult/sggu/route.js` builds Sggu prompt context and calls the local Ollama client.
- `lib/lostark/*`, `lib/spec/*`, `lib/consultant/*`, and `lib/llm/*` contain the strongest domain behavior and test assets.

Spring Boot currently owns the first backend BFF slice:

- `GET /api/characters/{name}`
- Lostark authorization normalization.
- Lostark timeout/retry/error mapping.
- BFF error response mapping.
- Raw armory response assembly for the frontend-compatible top-level keys.

## Target Architecture

```text
Browser
  -> Next.js UI
      -> /api/* routed to Spring Boot BFF
          -> Lostark Open API
          -> cache/store
          -> local LLM/RAG runtime
```

Final responsibility split:

- `app/`, `components/`, `lib/ui/`: frontend state, layout, navigation, display components.
- `backend/.../lostark`: Lostark API clients, auth, retry, timeout, upstream error mapping.
- `backend/.../character`: character lookup orchestration and response DTO assembly.
- `backend/.../market`: market/auction API access, snapshot cache, price DTOs.
- `backend/.../spec`: equipment, card, gem, engraving, combat-power, and upgrade-efficiency calculations.
- `backend/.../consultant`: Sggu context builder, prompt builder, local LLM client, RAG retrieval.
- `app/api/*`: removed after replacement.

## Routing Strategy

During migration, keep browser-facing paths stable:

- UI continues calling `/api/characters/{name}`, `/api/market/snapshot`, and `/api/consult/sggu`.
- Maintain an endpoint ownership table: each `/api/*` path is owned by either Next.js or Spring Boot, never both for active traffic.
- Before a Spring endpoint reaches parity, keep the existing Next.js API route as the active owner.
- After parity, switch that endpoint with a `beforeFiles` rewrite in `next.config.mjs` during local development so the browser still calls same-origin `/api/*` while Next proxies to Spring Boot.
- In production-like deployment, route migrated `/api/*` paths to Spring Boot at the edge or reverse proxy layer.
- Delete the replaced Next.js API route after the Spring route is active and verified.

This avoids changing UI components every time a backend module moves.

## Migration Phases

### Phase 1: Contract And Routing Foundation

Define the internal API contract before moving more behavior.

Deliverables:

- Capture canonical DTO shape for `GET /api/characters/{name}` from the current Next.js response.
- Add Spring-side contract tests for top-level keys, error codes, and nullable fields.
- Add the endpoint ownership table for `/api/characters`, `/api/market/snapshot`, and `/api/consult/sggu`.
- Add frontend API base/routing strategy that can send a ready endpoint to Spring Boot without changing UI components.
- Add a backend smoke command for Spring Boot character lookup.

Done when:

- Spring and Next character responses can be compared from fixtures or controlled fake data.
- Frontend can be configured to use Spring Boot for a ready endpoint.

### Phase 2: Character Lookup Complete Migration

Move character endpoint behavior from Next.js to Spring Boot.

Deliverables:

- Port equipment normalization and paradise orb extraction.
- Port avatar, card, engraving, gem, and skill normalization.
- Port `classIdentityEffects`, `criticalStats`, `combatPowerAnalysis`, and `upgradeEfficiency` in small slices.
- Reuse or mirror existing JavaScript fixtures as Java test fixtures.
- Keep raw Lostark payload assumptions documented.

Done when:

- Spring `GET /api/characters/{name}` returns the same frontend DTO shape as current Next route.
- Core calculation fixture results match the existing JavaScript tests within explicit tolerances.
- Home page works against Spring Boot character endpoint.

### Phase 3: Market Snapshot And Cache Migration

Move market and auction API behavior to Spring Boot.

Deliverables:

- Add Spring market/auction client for current market snapshot queries.
- Move snapshot grouping, cache TTL, force refresh, and concurrent refresh deduplication.
- Expose `GET /api/market/snapshot` from Spring Boot.
- Use backend snapshot inside character upgrade-efficiency calculation.

Done when:

- Existing market snapshot tests have Java equivalents.
- Frontend efficiency views and character recommendation data use Spring market snapshot.

### Phase 4: Spec-Up Calculation Migration

Move remaining spec-up and combat calculation behavior into Java services.

Deliverables:

- Port `lib/spec/*` behavior into focused Java services.
- Keep formula docs synchronized with implementation.
- Add regression cases for known measured characters and edge classes.
- Make calculation services independent from controller and HTTP concerns.

Done when:

- Combat power, accessory contribution, engraving contribution, avatar stats, and upgrade-efficiency Java tests cover the current JS test matrix.
- Next.js no longer imports calculation modules for runtime API responses.

### Phase 5: Sggu Consultant And RAG Migration

Move consultation backend behavior to Spring Boot.

Deliverables:

- Port compact character context builder.
- Port Sggu prompt builder and conversation normalization.
- Add Spring local LLM client for Ollama.
- Add approved-document RAG loader/retriever when RAG data exists.
- Preserve behavior when local LLM or references are unavailable.

Done when:

- `POST /api/consult/sggu` runs through Spring Boot.
- Existing consult API tests have Java equivalents or contract tests.
- Next.js only renders chat UI and sends messages.

### Phase 6: Remove Next.js API Routes

Delete replaced Next.js API routes and server-only JavaScript modules that no longer serve runtime behavior.

Deliverables:

- Remove `app/api/characters`, `app/api/market`, and `app/api/consult` after their Spring replacements are active.
- Remove or archive JS backend/domain modules that have Java equivalents and no frontend/runtime test use.
- Keep frontend-only helpers under `lib/ui/*`.
- Update README and development commands to describe the two-process architecture.

Done when:

- Next.js build works with no app API routes for migrated features.
- Spring Boot owns all application API behavior.
- Tests, lint, build, backend tests, and smoke checks pass.

## Error Handling Policy

Spring Boot should be the only layer translating backend errors into application API errors.

Stable API error codes:

- `INVALID_CHARACTER_NAME`
- `MISSING_API_KEY`
- `CHARACTER_NOT_FOUND`
- `LOSTARK_API_ERROR`
- `INVALID_MESSAGE`
- `INVALID_ARMORY`
- `LOCAL_LLM_UNAVAILABLE`
- `LOCAL_LLM_ERROR`

Frontend should map these codes to user-facing messages and avoid interpreting Lostark transport details directly.

## Testing Strategy

Each migration phase needs both focused tests and contract checks.

Required verification layers:

- Java unit tests for parsers, calculators, clients, and services.
- Spring controller tests for API status codes and response DTO shape.
- Fixture parity tests against existing JavaScript examples while both implementations exist.
- Frontend tests for UI state and error message mapping.
- Build checks for both processes.

Standard commands:

```bash
npm test
npm run lint
npm run build
cd backend && ./mvnw test
git diff --check
```

Smoke checks should be added per endpoint once routing points to Spring Boot.

## Risks

- Calculation drift: combat-power and spec-up formulas may change during Java port.
  - Mitigation: port by module, preserve fixtures, compare outputs before deleting JS.
- DTO drift: frontend expects existing field names and nullable shapes.
  - Mitigation: contract tests before routing changes.
- Long migration period: Next and Spring may both implement similar behavior for a while.
  - Mitigation: endpoint ownership table and phase-based deletion.
- Local development friction: frontend and backend run as two processes.
  - Mitigation: document commands and add restart/smoke scripts.

## Out Of Scope

- User accounts.
- Cloud LLM migration.
- Vector database.
- Full production deployment topology.
- Public API versioning beyond the internal BFF contract.
