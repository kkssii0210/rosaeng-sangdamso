import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const rootDir = process.cwd();

function readText(path) {
  return readFileSync(join(rootDir, path), "utf8");
}

function listFiles(dir) {
  const absoluteDir = join(rootDir, dir);

  if (!existsSync(absoluteDir)) {
    return [];
  }

  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(absoluteDir, entry.name);
    const projectPath = relative(rootDir, path);

    if (entry.isDirectory()) {
      return listFiles(projectPath);
    }

    return statSync(path).isFile() ? [projectPath] : [];
  });
}

test("removed API owners do not leave local route or legacy package directories", () => {
  const removedDirectories = [
    "app/api",
    "backend/src/main/java/com/sggu",
    "backend/src/test/java/com/sggu"
  ];

  for (const directory of removedDirectories) {
    assert.equal(existsSync(join(rootDir, directory)), false, `${directory} should not exist`);
  }
});

test("backend ownership document defines JS domain modules as reference models", () => {
  const ownershipDoc = readText("docs/backend-api-ownership.md");

  assert.match(ownershipDoc, /Java is the source of truth/);
  assert.match(ownershipDoc, /lib\/lostark\/\*/);
  assert.match(ownershipDoc, /lib\/spec\/\*/);
  assert.match(ownershipDoc, /reference and parity-test models/);
});

test("browser UI does not import Lostark or spec reference modules directly", () => {
  const uiFiles = [
    ...listFiles("app"),
    ...listFiles("components")
  ].filter((file) => /\.(?:js|jsx|mjs)$/.test(file));

  for (const file of uiFiles) {
    const source = readText(file);

    assert.doesNotMatch(source, /from\s+["'][^"']*(?:lib\/lostark|\.\.\/lib\/lostark|\.\.\/\.\.\/lib\/lostark)/, file);
    assert.doesNotMatch(source, /from\s+["'][^"']*(?:lib\/spec|\.\.\/lib\/spec|\.\.\/\.\.\/lib\/spec)/, file);
  }
});

test("gitignore explicitly preserves shared agent skill files that are tracked", () => {
  const gitignore = readText(".gitignore");

  assert.doesNotMatch(gitignore, /^\.agents\/$/m);
  assert.match(gitignore, /^\.agents\/\*$/m);
  assert.match(gitignore, /^!\.agents\/skills\/$/m);
  assert.match(gitignore, /^\.agents\/skills\/\*$/m);
  assert.match(gitignore, /^!\.agents\/skills\/deep-interview\/$/m);
  assert.match(gitignore, /^!\.agents\/skills\/deep-interview\/SKILL\.md$/m);
});
