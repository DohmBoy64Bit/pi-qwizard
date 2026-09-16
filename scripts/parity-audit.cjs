const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const archive = process.argv[2];
if (!archive) {
  console.error("Usage: node scripts/parity-audit.cjs <original-pi-qwizard.zip>");
  process.exit(2);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pi-qwizard-parity-"));
try {
  const archivePath = path.resolve(process.cwd(), archive);
  execFileSync("unzip", ["-q", "-o", archivePath, "src/index.ts"], { cwd: temp });
  const original = fs.readFileSync(path.join(temp, "src/index.ts"), "utf8");
  const root = path.join(__dirname, "..");
  const files = [
    "src/index.ts",
    "src/schemas.ts",
    "src/commands.ts",
    "src/events.ts",
    "src/renderers.ts",
    "src/core/branching.ts",
    "src/core/validation.ts",
    "src/core/formatting.ts",
    "src/core/question-options.ts",
    "src/state/throttle.ts",
    "src/state/settings.ts",
    "src/tools/question.ts",
    "src/tools/questionnaire.ts",
    "src/tools/question-input.ts",
    "src/tools/question-throttle.ts",
    "src/tools/question-branch.ts",
  ];
  const refactored = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");

  const requiredFeatures = [
    'name: "question"',
    'name: "questionnaire"',
    'name: "question_input"',
    'name: "question_throttle"',
    'name: "question_branch"',
    'pi.registerCommand("qwizard"',
    'pi.on("session_start"',
    'pi.on("session_shutdown"',
    'pi.on("session_info_changed"',
    'pi.on("tool_call"',
    'pi.on("tool_result"',
    'pi.events.emit("question_answered"',
    "setSessionName",
    "allowOther",
    "autoAdvance",
    "yes_no",
    "rating",
    "is_empty",
    "is_not_empty",
    "not_equals",
    "matches",
    "overlay: true",
    'executionMode: "sequential"',
  ];

  for (const feature of requiredFeatures) {
    assert.equal(original.includes(feature), true, `original baseline missing ${feature}`);
    assert.equal(refactored.includes(feature), true, `refactor missing ${feature}`);
  }

  for (const tool of [
    "Question",
    "Questionnaire",
    "QuestionInput",
    "QuestionThrottle",
    "QuestionBranch",
  ]) {
    assert.equal(
      refactored.includes(`export function register${tool}Tool`),
      true,
      `${tool} is not independently registered`,
    );
  }

  assert.equal((refactored.match(/registerMessageRenderer\(/g) || []).length, 5);
  assert.equal((refactored.match(/prepareArguments\(/g) || []).length, 5);
  assert.equal((refactored.match(/renderCall\(/g) || []).length, 5);
  assert.equal((refactored.match(/renderResult\(/g) || []).length, 5);
  console.log(
    "Feature parity audit passed: all baseline surfaces are present in separated modules.",
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
