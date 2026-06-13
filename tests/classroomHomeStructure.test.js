import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readText(path) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("classroom home component files exist", () => {
  const files = [
    "components/classroom/ClassroomIntro.jsx",
    "components/classroom/ClassroomShell.jsx",
    "components/classroom/ClassroomThemeToggle.jsx",
    "components/classroom/TodayChalkboard.jsx"
  ];

  for (const file of files) {
    assert.equal(existsSync(join(rootDir, file)), true, `${file} should exist`);
  }
});

test("home page uses the classroom shell and keeps Spring API paths", () => {
  const source = readText("app/page.jsx");

  assert.match(source, /ClassroomIntro/);
  assert.match(source, /ClassroomShell/);
  assert.match(source, /\/api\/characters\/\$\{encodeURIComponent\(characterName\)\}/);
  assert.match(source, /\/api\/consult\/sggu/);
  assert.doesNotMatch(source, /WelcomeScene/);
  assert.doesNotMatch(source, /SgguConsultantChat/);
});

test("classroom styles are present in global css", () => {
  const source = readText("app/globals.css");

  assert.match(source, /classroom-home/);
  assert.match(source, /classroom-theme-light/);
  assert.match(source, /classroom-theme-dark/);
  assert.match(source, /classroom-chalkboard/);
});
