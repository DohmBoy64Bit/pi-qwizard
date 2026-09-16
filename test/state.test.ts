import assert from "node:assert/strict";
import { test } from "node:test";
import { autoThrottleSettings } from "../src/state/settings.js";
import { checkThrottle, clearQuestionTime, recordQuestionTime } from "../src/state/throttle.js";

test("throttle records, blocks, and clears state", () => {
  clearQuestionTime();
  assert.equal(checkThrottle(5).waited, false);
  assert.equal(checkThrottle(5).waited, true);
  recordQuestionTime();
  assert.equal(checkThrottle(0).waited, false);
  clearQuestionTime();
  assert.equal(checkThrottle(5).waited, false);
});

test("auto-throttle settings retain safe defaults", () => {
  assert.deepEqual(autoThrottleSettings, { enabled: true, cooldown: 3 });
});
