import test from "node:test";
import assert from "node:assert/strict";
import {
  CLASSROOM_THEME_STORAGE_KEY,
  nextClassroomTheme,
  normalizeClassroomTheme,
  readStoredClassroomTheme,
  themeClassName,
  writeStoredClassroomTheme
} from "../lib/ui/classroomTheme.js";

function createStorage(initialValue) {
  const values = new Map();

  if (initialValue !== undefined) {
    values.set(CLASSROOM_THEME_STORAGE_KEY, initialValue);
  }

  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
    valueOf: (key = CLASSROOM_THEME_STORAGE_KEY) => values.get(key)
  };
}

test("normalizes classroom theme values", () => {
  assert.equal(normalizeClassroomTheme("light"), "light");
  assert.equal(normalizeClassroomTheme("dark"), "dark");
  assert.equal(normalizeClassroomTheme("lavender"), "light");
  assert.equal(normalizeClassroomTheme(null), "light");
});

test("reads the stored classroom theme with light fallback", () => {
  assert.equal(readStoredClassroomTheme(createStorage("dark")), "dark");
  assert.equal(readStoredClassroomTheme(createStorage("broken")), "light");
  assert.equal(readStoredClassroomTheme(null), "light");
});

test("writes only normalized classroom theme values", () => {
  const storage = createStorage();

  assert.equal(writeStoredClassroomTheme(storage, "dark"), "dark");
  assert.equal(storage.valueOf(), "dark");
  assert.equal(writeStoredClassroomTheme(storage, "unknown"), "light");
  assert.equal(storage.valueOf(), "light");
});

test("resolves next classroom theme and class name", () => {
  assert.equal(nextClassroomTheme("light"), "dark");
  assert.equal(nextClassroomTheme("dark"), "light");
  assert.equal(nextClassroomTheme("invalid"), "dark");
  assert.equal(themeClassName("dark"), "classroom-theme-dark");
  assert.equal(themeClassName("invalid"), "classroom-theme-light");
});
