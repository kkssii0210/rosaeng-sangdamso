import test from "node:test";
import assert from "node:assert/strict";
import {
  extractUpdateNoticeEntries,
  fetchText,
  isoDateFromTitle
} from "../scripts/fetch-lostark-patch-notes.mjs";

test("resolves Korean title dates to the closest year relative to fetchedAt", () => {
  assert.equal(
    isoDateFromTitle("12월 31일 업데이트 내역 안내", "2027-01-01T01:15:00.000Z"),
    "2026-12-31"
  );
  assert.equal(
    isoDateFromTitle("1월 1일 업데이트 내역 안내", "2026-12-31T01:15:00.000Z"),
    "2027-01-01"
  );
  assert.equal(
    isoDateFromTitle("5월 27일 업데이트 내역 안내", "2026-05-27T01:15:00.000Z"),
    "2026-05-27"
  );
});

test("throws when official notice markup yields no update notices", () => {
  assert.throws(
    () => extractUpdateNoticeEntries("<a href=\"/News/Notice/Views/1\">알려진 문제 안내</a>"),
    /No Lost Ark update notices found/
  );
});

test("fetchText includes timeout context in fetch failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new DOMException("Timed out", "TimeoutError");
  };

  try {
    await assert.rejects(
      () => fetchText("https://lostark.game.onstove.com/News/Notice/List", { timeoutMs: 123 }),
      /Lost Ark notice fetch timed out after 123ms: https:\/\/lostark\.game\.onstove\.com\/News\/Notice\/List/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
