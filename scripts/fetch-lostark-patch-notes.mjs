import { pathToFileURL } from "node:url";
import { extractNoticeEntries, writeFetchedPatchNote } from "../lib/rag/lostarkPatchNotes.js";

const NOTICE_LIST_URL = "https://lostark.game.onstove.com/News/Notice/List";
const FETCH_TIMEOUT_MS = 15000;

export function isoDateFromTitle(title, fetchedAt = new Date().toISOString()) {
  const match = String(title || "").match(/(\d+)월\s*(\d+)일/);
  const fetchedDate = new Date(fetchedAt);

  if (!match) {
    return fetchedDate.toISOString().slice(0, 10);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const fetchedYear = fetchedDate.getUTCFullYear();
  const closest = [fetchedYear - 1, fetchedYear, fetchedYear + 1]
    .map((year) => new Date(Date.UTC(year, month - 1, day)))
    .sort((left, right) => Math.abs(left - fetchedDate) - Math.abs(right - fetchedDate))[0];

  return closest.toISOString().slice(0, 10);
}

export function extractUpdateNoticeEntries(html, limit = 5) {
  const entries = extractNoticeEntries(html).slice(0, limit);

  if (!entries.length) {
    throw new Error("No Lost Ark update notices found.");
  }

  return entries;
}

export async function fetchText(url, { timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  let response;

  try {
    response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml"
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new Error(`Lost Ark notice fetch timed out after ${timeoutMs}ms: ${url}`, { cause: error });
    }

    throw new Error(`Lost Ark notice fetch failed before response: ${url}`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`Lost Ark notice fetch failed ${response.status}: ${url}`);
  }

  return response.text();
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const listHtml = await fetchText(NOTICE_LIST_URL);
  const entries = extractUpdateNoticeEntries(listHtml);
  const results = [];

  for (const entry of entries) {
    const detailHtml = await fetchText(entry.sourceUrl);
    const result = await writeFetchedPatchNote({
      note: {
        title: entry.title,
        sourceUrl: entry.sourceUrl,
        publishedAt: isoDateFromTitle(entry.title, fetchedAt),
        fetchedAt,
        body: detailHtml
      }
    });

    results.push({ ...result, title: entry.title });
  }

  for (const result of results) {
    console.log(`${result.action}: ${result.title}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
