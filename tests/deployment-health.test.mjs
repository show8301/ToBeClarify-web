import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../app/api/health/route.ts";

test("deployment health reports the runtime commit and disables caching", async () => {
  const previousSha = process.env.DEPLOYMENT_SHA;
  process.env.DEPLOYMENT_SHA = "0123456789abcdef0123456789abcdef01234567";

  try {
    const response = GET();
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "ok");
    assert.equal(payload.deploymentSha, process.env.DEPLOYMENT_SHA);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  } finally {
    if (previousSha === undefined) delete process.env.DEPLOYMENT_SHA;
    else process.env.DEPLOYMENT_SHA = previousSha;
  }
});
