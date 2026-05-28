# Backend API Ownership

Date: 2026-05-29

| Browser Path | Active Owner | Target Owner | Migration State |
| --- | --- | --- | --- |
| `/api/characters/{name}` | Spring Boot | Spring Boot | Spring owner active; combat/upgrade summaries are partial |
| `/api/market/snapshot` | Spring Boot | Spring Boot | Spring owner active |
| `/api/consult/sggu` | Next.js | Spring Boot | Not started |

Rules:

- UI code calls browser-facing same-origin paths only.
- One active owner per path.
- Spring Boot becomes active owner only after parity tests and smoke checks pass.
- Replaced Next.js API route is deleted after Spring Boot ownership is active.
