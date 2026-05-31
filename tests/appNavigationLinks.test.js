import assert from "node:assert/strict";
import test from "node:test";

import { APP_NAV_LINKS } from "../lib/ui/appNavigationLinks.js";

test("keeps the combat power simulator out of the primary home navigation", () => {
  assert.equal(APP_NAV_LINKS.some((link) => link.href === "/efficiency"), false);
  assert.equal(APP_NAV_LINKS.some((link) => link.label.includes("전투력 효율 시뮬레이터")), false);
});
