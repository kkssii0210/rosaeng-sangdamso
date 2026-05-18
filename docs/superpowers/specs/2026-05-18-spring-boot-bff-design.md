# Spring Boot BFF Design

Date: 2026-05-18

## Goal

Introduce a Java Spring Boot backend in `backend/` and move the first character lookup BFF capability toward Java without breaking the existing Next.js frontend.

This supersedes the earlier Node BFF stabilization plan as the preferred backend direction. The earlier spec and plan stay in the repository as historical planning artifacts, but implementation should proceed from this Spring Boot design.

## Current State

The app currently uses Next.js API Routes for backend behavior:

- `app/api/characters/[name]/route.js` calls Lostark Open API armory endpoints, normalizes data, runs JavaScript calculation modules, and returns the frontend DTO.
- `app/api/market/snapshot/route.js` calls market and auction endpoints through JavaScript modules.
- Domain parsing and calculations live in `lib/lostark/*` and `lib/spec/*`.

The target direction is a split architecture:

- Next.js remains the frontend.
- Spring Boot becomes the backend BFF.
- Existing Next.js API Routes remain during the transition and are not deleted in this phase.

## Scope

This phase includes:

- Install or verify OpenJDK 21 in the WSL2 Ubuntu 24.04 development environment.
- Create a new `backend/` Spring Boot application.
- Implement `GET /api/characters/{name}` in Spring Boot.
- Implement a Lostark Open API client in Java with auth normalization, timeout, retry, and error mapping.
- Fetch these Lostark armory endpoints:
  - `/armories/characters/{characterName}/profiles`
  - `/armories/characters/{characterName}/equipment`
  - `/armories/characters/{characterName}/avatars`
  - `/armories/characters/{characterName}/arkpassive`
  - `/armories/characters/{characterName}/arkgrid`
  - `/armories/characters/{characterName}/cards`
  - `/armories/characters/{characterName}/combat-skills`
  - `/armories/characters/{characterName}/engravings`
  - `/armories/characters/{characterName}/gems`
- Return a DTO with top-level keys compatible with the current frontend contract.
- Add focused Java tests for client and controller behavior.
- Document how to run the backend locally.

This phase excludes:

- Deleting or replacing existing Next.js API Routes.
- Wiring the Next.js frontend to call Spring Boot.
- Redis, Postgres, persistent lookup history, or durable market snapshot storage.
- Market snapshot API migration.
- Local LLM/Ollama consultation APIs.
- Full Java migration of the current JavaScript calculation models.
- UI redesign.

## Platform Baseline

Local environment observed on 2026-05-18:

- WSL2 Ubuntu 24.04.4 LTS.
- Node `v22.22.2` and npm `10.9.7` are already installed for the frontend.
- `java` and `javac` are not installed.

Target Java baseline:

- OpenJDK 21 LTS.
- Spring Boot 4.x stable.
- Maven Wrapper.

Rationale:

- Spring Boot 4.0.6 requires Java 17 or later and is compatible up to Java 26 according to the official Spring Boot system requirements.
- Ubuntu 24.04 LTS has OpenJDK 21 packages available according to Ubuntu developer documentation.
- Java 21 is an LTS release and is a conservative baseline for a new Spring Boot backend.

Sources:

- Spring Boot System Requirements: https://docs.spring.io/spring-boot/system-requirements.html
- Ubuntu Java availability: https://documentation.ubuntu.com/ubuntu-for-developers/reference/availability/java/

## Architecture

Add a new `backend/` Maven project.

Initial package structure:

```text
backend/
  pom.xml
  mvnw
  mvnw.cmd
  src/main/java/com/rosaeng/sangdamso/
    RosaengSangdamsoBackendApplication.java
    character/
      CharacterController.java
      CharacterService.java
      CharacterResponse.java
    lostark/
      LostarkApiClient.java
      LostarkApiException.java
      LostarkApiErrorCode.java
      LostarkProperties.java
    common/
      ApiErrorResponse.java
      GlobalExceptionHandler.java
  src/test/java/com/rosaeng/sangdamso/
    character/
      CharacterControllerTest.java
      CharacterServiceTest.java
    lostark/
      LostarkApiClientTest.java
```

Dependencies:

- `spring-boot-starter-web`
- `spring-boot-starter-validation`
- `spring-boot-starter-actuator`
- `spring-boot-starter-test`

The backend is a separate process from Next.js. It should run on a non-conflicting port such as `8080`. Frontend integration is deferred, so no CORS or proxy behavior is required for this phase unless manual browser testing needs it.

## Lostark Client Policy

`LostarkApiClient` owns all transport behavior for Lostark Open API.

Request policy:

- Base URL: `https://developer-lostark.game.onstove.com`
- Timeout: 5 seconds per upstream request.
- Retry count: 1 retry after the first failed attempt.
- Retryable failures: network errors, timeout, HTTP `429`, and HTTP `5xx`.
- Non-retryable failures: HTTP `400`, `401`, `403`, and `404`.
- Headers include `accept: application/json` and normalized `authorization`.

Authorization behavior:

- Read `LOSTARK_API_KEY` first.
- Fall back to `LOSTARK_OPEN_API_KEY`.
- Allow property binding through `lostark.api-key` for local Spring configuration.
- Trim whitespace.
- Preserve tokens that already start with `Bearer ` or `bearer `.
- Prefix other tokens as `bearer ${token}`.
- Treat a blank token as missing.

Java implementation should use Spring's blocking `RestClient`. The first version should stay blocking and simple.

## Error Codes

Lostark client errors:

- `BAD_REQUEST`: Lostark returned HTTP `400`.
- `AUTH_ERROR`: Lostark returned HTTP `401` or `403`.
- `NOT_FOUND`: Lostark returned HTTP `404`.
- `RATE_LIMITED`: Lostark returned HTTP `429` after retry attempts are exhausted.
- `UPSTREAM_ERROR`: Lostark returned HTTP `5xx` after retry attempts are exhausted.
- `TIMEOUT`: the request exceeded the timeout after retry attempts are exhausted.
- `NETWORK_ERROR`: the client failed for a non-timeout network reason after retry attempts are exhausted.

BFF response codes:

- `INVALID_CHARACTER_NAME`
- `MISSING_API_KEY`
- `CHARACTER_NOT_FOUND`
- `LOSTARK_API_ERROR`

## Character API Flow

`GET /api/characters/{name}` should behave as follows:

1. Trim the character name.
2. If empty, return HTTP `400`:

```json
{
  "code": "INVALID_CHARACTER_NAME",
  "message": "조회할 캐릭터명을 입력해줘."
}
```

3. Resolve Lostark API authorization from environment or Spring properties.
4. If authorization is missing, return HTTP `500`:

```json
{
  "code": "MISSING_API_KEY",
  "message": "잠시 설정을 확인하고 있어요."
}
```

5. Fetch armory endpoints. The first implementation may call them sequentially to keep control flow simple. Parallelization is deferred until the Java client and tests are stable.
6. Convert `NOT_FOUND` to `null` for armory endpoints. The profile payload is the required payload.
7. If profile is `null`, return HTTP `404`:

```json
{
  "code": "CHARACTER_NOT_FOUND",
  "message": "없는 캐릭터입니다."
}
```

8. If any non-404 Lostark client failure occurs, return HTTP `502`:

```json
{
  "code": "LOSTARK_API_ERROR",
  "message": "지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘."
}
```

9. Return a JSON response with these top-level keys:
   - `profile`
   - `equipment`
   - `paradiseOrb`
   - `avatars`
   - `arkPassive`
   - `arkGrid`
   - `cards`
   - `skills`
   - `engravings`
   - `gems`
   - `classIdentityEffects`
   - `criticalStats`
   - `combatPowerAnalysis`
   - `upgradeEfficiency`

For this phase:

- Raw Lostark payloads may be returned for `profile`, `equipment`, `avatars`, `arkPassive`, `arkGrid`, `cards`, `skills`, `engravings`, and `gems`.
- Fields that require JavaScript calculation migration should be explicit `null` values:
  - `paradiseOrb`
  - `classIdentityEffects`
  - `criticalStats`
  - `combatPowerAnalysis`
  - `upgradeEfficiency`

This keeps the top-level frontend contract visible while avoiding a premature rewrite of calculation models.

## Development Commands

Install Java when approved:

```bash
sudo apt-get update
sudo apt-get install -y openjdk-21-jdk
java -version
javac -version
```

Run backend tests:

```bash
cd backend
./mvnw test
```

Run backend dev server:

```bash
cd backend
./mvnw spring-boot:run
```

Manual API check:

```bash
curl http://localhost:8080/api/characters/{characterName}
```

## Testing Strategy

`LostarkApiClientTest` should verify:

- Authorization normalization prefixes raw tokens with `bearer `.
- Authorization normalization preserves an existing bearer prefix.
- Missing or blank authorization is treated as missing.
- HTTP `404` maps to `NOT_FOUND` and does not retry.
- HTTP `500` retries once and can succeed on the second attempt.
- HTTP `429` retries once and can succeed on the second attempt.
- Timeout maps to `TIMEOUT`.
- Network failure maps to `NETWORK_ERROR`.

`CharacterControllerTest` should verify:

- Empty character name returns `INVALID_CHARACTER_NAME` with `조회할 캐릭터명을 입력해줘.`
- Missing API key returns `MISSING_API_KEY` with `잠시 설정을 확인하고 있어요.`
- Profile `NOT_FOUND` returns `CHARACTER_NOT_FOUND` with `없는 캐릭터입니다.`
- Non-404 upstream failure returns `LOSTARK_API_ERROR` with `지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘.`

`CharacterServiceTest` should verify:

- A successful lookup returns all required top-level DTO keys.
- JavaScript-calculation fields are `null` in this phase.
- Optional armory endpoint `NOT_FOUND` values become `null` or empty payloads without failing the profile-backed response.

## Acceptance Criteria

The phase is complete when:

- OpenJDK 21 is installed and `java -version` plus `javac -version` work.
- `backend/` contains a runnable Spring Boot Maven project.
- `GET /api/characters/{name}` exists in Spring Boot.
- Missing character responses return `CHARACTER_NOT_FOUND` with `없는 캐릭터입니다.`
- Missing API key responses return `MISSING_API_KEY` with `잠시 설정을 확인하고 있어요.`
- Lostark upstream failures return `LOSTARK_API_ERROR` with `지금은 캐릭터 정보를 불러오지 못했어요. 잠시 후 다시 조회해줘.`
- The successful response includes the current frontend's expected top-level keys.
- `cd backend && ./mvnw test` passes.
- The existing Next.js app files are not removed or rewritten as part of this phase.

## Open Questions

No design question blocks this phase. The next phase should decide how the Next.js frontend will route API calls to Spring Boot and whether Java should reimplement the existing calculation modules or consume them through a compatibility layer.
