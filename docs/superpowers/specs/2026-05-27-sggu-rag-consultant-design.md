# Sggu RAG Consultant Design

## Goal

Add a reviewed local RAG layer to the Sggu consultant so answers can use approved Lost Ark patch notes, glossary entries, and formula-reference notes in addition to the loaded character context.

The first version must keep Sggu grounded and safe:

- Automatically collect weekly Lost Ark patch notes.
- Do not use collected patch notes until a human approves them.
- Keep glossary and formula documents local and reviewed.
- Use approved snippets as supporting evidence, not as a replacement for deterministic character/spec-up data.
- Keep the existing local Ollama consultant path working when no RAG documents exist.

## Sources

Patch notes come from the official Lost Ark notice list:

- `https://lostark.game.onstove.com/News/Notice/List`

The crawler only considers official notice entries whose title includes `업데이트 내역 안내`.

Glossary and formula documents are maintained locally:

- `data/rag/approved/glossary/*.md`
- `data/rag/approved/formulas/*.md`

Formula notes can be derived from existing project documentation such as `docs/lostark-damage-formula.md`, but the RAG version should be concise and reviewed.

## Data Flow

GitHub Actions runs every Wednesday at 10:15 KST. This is 15 minutes after the expected 10:00 KST Lost Ark weekly update publication time.

The workflow:

1. Fetches the official notice list.
2. Finds new or changed `업데이트 내역 안내` posts.
3. Downloads and cleans each candidate post.
4. Stores new fetched documents under `data/rag/inbox/patch-notes/`.
5. Opens a PR from a `rag-fetch/YYYY-MM-DD` branch when inbox files change.

Human review happens in the PR. A reviewer checks title, source URL, date, body cleanup, summary, and change classification. Approved documents are moved from:

- `data/rag/inbox/patch-notes/...md`

to:

- `data/rag/approved/patch-notes/...md`

The runtime RAG retriever reads only `data/rag/approved/**/*.md`. Inbox documents never affect Sggu answers.

## Patch Note Document Format

Each fetched patch note is Markdown with frontmatter:

```md
---
title: "5월 27일(수) 업데이트 내역 안내"
sourceUrl: "https://lostark.game.onstove.com/News/Notice/..."
publishedAt: "2026-05-27"
fetchedAt: "2026-05-27T01:15:00.000Z"
sourceHash: "sha256..."
status: inbox
category: patch-note
changeType: no-update
summary: "단순 오류 수정 중심의 없데이트"
---

정제된 본문...
```

Allowed `changeType` values:

- `major`: new content, balance, class, raid, progression, or major system changes.
- `minor`: convenience changes, numeric tuning, event/reward/UI changes.
- `no-update`: mostly bug fixes, known issue fixes, or no meaningful gameplay changes.

The crawler proposes `changeType` and `summary`; the reviewer can edit both before approval.

When approved, `status` changes to `approved`.

## Duplicate And Revision Rules

The crawler skips documents when the same `sourceUrl` and `sourceHash` already exist.

If the same URL appears with a changed hash:

- If the earlier version is still in inbox, update the inbox file.
- If the earlier version is already approved, create a new inbox revision file so the reviewer can compare and approve the change.

Approved runtime retrieval always uses the latest approved document by `publishedAt` and revision metadata.

## Module Design

### `scripts/fetch-lostark-patch-notes.mjs`

Fetches official patch notes and writes inbox Markdown files.

Responsibilities:

- Fetch official notice list and detail pages.
- Filter to `업데이트 내역 안내`.
- Extract title, URL, published date, and cleaned body text.
- Compute `sourceHash` from cleaned body.
- Propose `changeType` and `summary` from simple keyword rules.
- Write or update inbox Markdown.
- Exit successfully when no changes exist.
- Exit non-zero on network or parse failures that prevent reliable fetch.

### `.github/workflows/fetch-rag-patch-notes.yml`

Runs the fetch script every Wednesday at 01:15 UTC, equal to 10:15 KST.

Responsibilities:

- Install Node dependencies.
- Run the fetch script.
- Create a branch named `rag-fetch/YYYY-MM-DD` when files change.
- Open or update a PR with the fetched inbox files.

### `lib/rag/ragDocuments.js`

Loads approved RAG documents.

Responsibilities:

- Read only `data/rag/approved/**/*.md`.
- Parse frontmatter and body.
- Validate required metadata.
- Skip malformed documents safely.
- Convert documents into chunkable records.

### `lib/rag/retriever.js`

Retrieves relevant approved snippets.

Responsibilities:

- Extract keywords from the user message.
- Add context keywords from class name, skills, engravings, equipment, and spec-up candidate types.
- Chunk documents by headings and paragraphs.
- Score chunks by title, heading, body, category, recency, and question intent.
- Return the top 3 to 5 snippets when their scores are meaningful.
- Return no snippets when evidence is weak.

### `lib/consultant/sgguPrompt.js`

Extends the existing prompt builder.

Responsibilities:

- Accept `references`.
- Add a `[참고 문서]` section after `[캐릭터 데이터]`.
- Tell Sggu to use references only as supporting evidence.
- Tell Sggu to cite short evidence labels such as `근거: 5월 27일 업데이트 내역`.
- Keep current behavior when `references` is empty.

### `app/api/consult/sggu/route.js`

Adds retrieval before local LLM completion.

Flow:

1. Validate message and character context.
2. Normalize conversation.
3. Retrieve references with `retrieveSgguReferences({ message, context })`.
4. Build chat messages with `{ message, conversation, context, references }`.
5. Call the local Ollama client.

If retrieval fails, the route logs the failure and continues without references.

## Retrieval Scoring

First version uses local keyword scoring, not embeddings.

Scoring rules:

- Title matches have high weight.
- Section heading matches have medium weight.
- Body matches have lower weight.
- Recent patch notes receive a small recency bonus.
- `formula` documents receive a bonus for questions containing words such as `효율`, `계산`, `전투력`, `공식`, and `왜`.
- `glossary` documents receive a bonus for questions containing words such as `뭐야`, `뜻`, `설명`, and `용어`.
- `patch-note` documents receive a bonus for questions containing words such as `패치`, `업데이트`, `이번 주`, and `없데이트`.
- `changeType: no-update` documents are boosted for `없데이트` questions.

The retriever caps snippet length per chunk and total reference text before prompt construction.

## Prompt Behavior

The prompt includes:

```text
[캐릭터 데이터]
...

[참고 문서]
1. 제목 / 날짜 / 분류 / changeType
   snippet...

[유저 질문]
...
```

Sggu rules:

- For character-specific advice, prioritize deterministic character/spec-up context.
- For patch, glossary, and formula explanations, use only approved references.
- If no reference supports a patch or glossary claim, say the data is not available.
- If a patch note is `changeType: no-update`, Sggu may say `이번 주는 없데이트에 가까워`.
- Keep answers short and cite at most two evidence labels.

## Error Handling

- GitHub Actions fetch failure fails the workflow and does not affect runtime.
- Malformed approved docs are skipped by the loader.
- Retrieval failure does not fail consultation; Sggu answers from character context only.
- Empty approved directory is valid.
- Inbox documents are ignored by runtime.

## Testing

Required tests:

- Crawler parses official-list fixtures and writes inbox patch-note Markdown.
- Crawler skips already fetched documents by URL and hash.
- Crawler creates a revision inbox file when an approved URL changes.
- `changeType` classifier marks bug-fix-only notes as `no-update`.
- Document loader reads approved docs and ignores inbox docs.
- Retriever returns latest approved patch note for `이번 주 패치 뭐야?`.
- Retriever returns `no-update` patch note for `없데이트야?`.
- Retriever returns formula docs for combat-power formula questions.
- Retriever returns glossary docs for terminology questions.
- Prompt builder includes `[참고 문서]` only when references exist.
- Consult API continues when retrieval returns no snippets.
- Consult API continues without references when retriever throws.

Verification commands:

```bash
npm test -- tests/ragDocuments.test.js tests/ragRetriever.test.js tests/lostarkPatchNotesCrawler.test.js tests/sgguPrompt.test.js tests/sgguConsultApi.test.js
node node_modules/eslint/bin/eslint.js scripts/fetch-lostark-patch-notes.mjs lib/rag/ragDocuments.js lib/rag/retriever.js lib/consultant/sgguPrompt.js app/api/consult/sggu/route.js tests/ragDocuments.test.js tests/ragRetriever.test.js tests/lostarkPatchNotesCrawler.test.js tests/sgguPrompt.test.js tests/sgguConsultApi.test.js
npm run build
npm run smoke:sggu
```

Full `npm run lint` currently scans generated `.worktrees/**/.next` files in this repository, so implementation verification should use touched-file lint unless the lint ignore configuration is fixed separately.

## Out Of Scope

- Vector DB.
- Local embedding model.
- Cloud LLM or cloud embedding API.
- Automatic approval of fetched patch notes.
- Runtime reading from inbox.
- UI for approving documents.
- Long-form source display in the app.
- Crawling non-official patch-note mirrors.

## Open Decisions

No open decisions remain for the first RAG implementation. The first implementation should use GitHub Actions scheduled fetch, human approval, approved-only keyword retrieval, and prompt reference injection.
