import { extractNoticeEntries, writeFetchedPatchNote } from "../lib/rag/lostarkPatchNotes.js";

const NOTICE_LIST_URL = "https://lostark.game.onstove.com/News/Notice/List";

function isoDateFromTitle(title) {
  const match = String(title || "").match(/(\d+)월\s*(\d+)일/);
  const year = new Date().getUTCFullYear();

  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Lost Ark notice fetch failed ${response.status}: ${url}`);
  }

  return response.text();
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const listHtml = await fetchText(NOTICE_LIST_URL);
  const entries = extractNoticeEntries(listHtml).slice(0, 5);
  const results = [];

  for (const entry of entries) {
    const detailHtml = await fetchText(entry.sourceUrl);
    const result = await writeFetchedPatchNote({
      note: {
        title: entry.title,
        sourceUrl: entry.sourceUrl,
        publishedAt: isoDateFromTitle(entry.title),
        fetchedAt,
        body: detailHtml
      }
    });

    results.push({ ...result, title: entry.title });
  }

  for (const result of results) {
    console.log(`${result.action}: ${result.title}`);
  }

  if (!results.length) {
    console.log("No Lost Ark update notices found.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
