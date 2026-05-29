import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }

    return nextResolve(specifier, context);
  }
});

const { GET: getRecommendation } = await import("../app/api/efficiency/accessories/[name]/route.js");

test("efficiency recommendation route returns JSON for invalid character name", async () => {
  const response = await getRecommendation(new Request("http://localhost/api/efficiency/accessories/%20"), {
    params: Promise.resolve({ name: "%20" })
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.code, "INVALID_CHARACTER_NAME");
});
