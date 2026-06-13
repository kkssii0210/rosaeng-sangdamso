import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readText(path) {
  return readFileSync(join(rootDir, path), "utf8");
}

function isFile(path) {
  return statSync(join(rootDir, path), { throwIfNoEntry: false })?.isFile() === true;
}

test("classroom home component files exist", () => {
  const files = [
    "components/classroom/ClassroomIntro.jsx",
    "components/classroom/ClassroomShell.jsx",
    "components/classroom/ClassroomThemeToggle.jsx",
    "components/classroom/TodayChalkboard.jsx"
  ];

  for (const file of files) {
    assert.equal(isFile(file), true, `${file} should exist`);
  }
});

test("home page uses the classroom shell and keeps Spring API paths", () => {
  const source = readText("app/page.jsx");

  assert.match(source, /<ClassroomIntro\b/);
  assert.match(source, /<ClassroomShell\b/);
  assert.match(source, /\/api\/characters\//);
  assert.match(source, /encodeURIComponent\(/);
  assert.match(source, /\/api\/consult\/sggu/);
  assert.doesNotMatch(source, /WelcomeScene/);
  assert.doesNotMatch(source, /SgguConsultantChat/);
});

test("home page keeps unknown lookup failures on the error chalkboard", () => {
  const source = readText("app/page.jsx");

  assert.match(source, /caughtError\.code \|\| "UNKNOWN"/);
  assert.match(source, /: "UNKNOWN"\)/);
});

test("classroom styles are present in global css", () => {
  const source = readText("app/globals.css");

  assert.match(source, /\.classroom-home\b/);
  assert.match(source, /\.classroom-theme-light\b/);
  assert.match(source, /\.classroom-theme-dark\b/);
  assert.match(source, /\.classroom-chalkboard\b/);
});

test("classroom intro controls stack on narrow screens", () => {
  const source = readText("app/globals.css");

  assert.match(source, /@media \(max-width: 520px\)/);
  assert.match(source, /\.classroom-intro-title\s*\{[^}]*bottom: 72px/s);
  assert.match(source, /\.classroom-intro-skip\s*\{[^}]*left: 24px/s);
});
