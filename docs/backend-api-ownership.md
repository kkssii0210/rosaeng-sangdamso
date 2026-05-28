# Backend API Ownership

Date: 2026-05-29

| Browser Path | Active Owner | Target Owner | Migration State |
| --- | --- | --- | --- |
| `/api/characters/{name}` | Next.js | Spring Boot | Spring exists, parity incomplete |
| `/api/market/snapshot` | Next.js | Spring Boot | Not started |
| `/api/consult/sggu` | Next.js | Spring Boot | Not started |

Rules:

- UI code calls browser-facing same-origin paths only.
- One active owner per path.
- Spring Boot becomes active owner only after parity tests and smoke checks pass.
- Replaced Next.js API route is deleted after Spring Boot ownership is active.
