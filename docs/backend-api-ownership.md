# Backend API Ownership

Date: 2026-05-31

| Browser Path | Active Owner | Target Owner | Migration State |
| --- | --- | --- | --- |
| `/api/characters/{name}` | Spring Boot | Spring Boot | Spring owner active |
| `/api/market/snapshot` | Spring Boot | Spring Boot | Spring owner active |
| `/api/consult/sggu` | Spring Boot | Spring Boot | Spring owner active |
| `/api/efficiency/spec-up/{name}` | Spring Boot | Spring Boot | Spring owner active; Next route removed |
| `/api/efficiency/accessories/recovery` | Spring Boot | Spring Boot | Spring owner active; Next route removed |

Rules:

- UI code calls browser-facing same-origin paths only.
- One active owner per path.
- Spring Boot becomes active owner only after parity tests and smoke checks pass.
- Replaced Next.js API route files are deleted after Spring Boot ownership is active.
- Next.js currently owns no API route behavior; it renders the UI and proxies Spring-owned API paths in local development.

## JS Reference Models

Java is the source of truth for browser-facing API behavior. The modules under `lib/lostark/*` and `lib/spec/*` are reference and parity-test models kept for formula review, focused UI display adapters, and regression comparison while the Spring Boot implementation owns the API responses.

Rules:

- Do not add Next.js API route handlers for Spring-owned browser paths.
- Do not call Lostark Open API directly from browser UI code.
- UI components should import calculation/display helpers through `lib/ui/*` adapters, not directly from `lib/lostark/*` or `lib/spec/*`.
- When Java behavior changes, update parity/reference tests or remove obsolete JS reference code in the same change.
