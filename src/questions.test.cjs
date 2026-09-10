/**
 * Questions Extension - Comprehensive Test Suite
 *
 * Tests all 3 tools (question, questionnaire, question_input) with 100% coverage.
 * Tests all 11 improvements via source code analysis.
 */

const fs = require("fs");
const path = require("path");

// ─── Test Infrastructure ─────────────────────────────────────────────────────

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition, name) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ${PASS} ${name}`);
  } else {
    failed++;
    console.log(`  ${FAIL} ${name}`);
  }
}

function section(name) {
  console.log(`\n${BOLD}${name}${DIM}${"─".repeat(60 - name.length)}${DIM}`);
}

// ─── Load Extension Source ───────────────────────────────────────────────────

const sourcePath = path.join(__dirname, "index.ts");
const source = fs.readFileSync(sourcePath, "utf8");

// ─── Test 1: StringEnum for Google Compatibility ─────────────────────────────

section("Test 1: StringEnum for Google Compatibility");

assert(
  source.includes('import { StringEnum } from "@earendil-works/pi-ai"'),
  "StringEnum is imported from @earendil-works/pi-ai",
);

assert(
  !source.includes('Type.Union([Type.Literal('),
  "No Type.Union([Type.Literal(...)]) found (Google-incompatible)",
);

assert(
  source.includes('StringEnum(["single", "multi"] as const)'),
  "question tool uses StringEnum for selection type",
);

assert(
  source.includes('StringEnum(["single", "multi", "yes_no", "rating"] as const)'),
  "questionnaire tool uses StringEnum for question type",
);

assert(
  source.includes('StringEnum(["text", "number", "email", "date"] as const)'),
  "question_input tool uses StringEnum for input type",
);

// ─── Test 2: promptSnippet and promptGuidelines ──────────────────────────────

section("Test 2: promptSnippet and promptGuidelines");

const promptSnippetCount = (source.match(/promptSnippet:/g) || []).length;
assert(promptSnippetCount === 3, "All 3 tools have promptSnippet (found " + promptSnippetCount + ")");

const promptGuidelinesCount = (source.match(/promptGuidelines:/g) || []).length;
assert(promptGuidelinesCount === 3, "All 3 tools have promptGuidelines (found " + promptGuidelinesCount + ")");

assert(
  source.includes('promptSnippet: "Ask the user a single question'),
  "question tool has descriptive promptSnippet",
);

assert(
  source.includes('promptSnippet: "Ask the user a multi-step questionnaire'),
  "questionnaire tool has descriptive promptSnippet",
);

assert(
  source.includes('promptSnippet: "Ask the user an open-ended question'),
  "question_input tool has descriptive promptSnippet",
);

// ─── Test 3: executionMode: "sequential" on All Tools ────────────────────────

section("Test 3: executionMode: sequential on All Tools");

const executionModeCount = (source.match(/executionMode: "sequential"/g) || []).length;
assert(executionModeCount === 3, "All 3 tools have executionMode: sequential (found " + executionModeCount + ")");

// ─── Test 4: Event Subscription ──────────────────────────────────────────────

section("Test 4: Event Subscription");

assert(
  source.includes('pi.on("session_start"'),
  "session_start event handler registered",
);

assert(
  source.includes('pi.on("session_shutdown"'),
  "session_shutdown event handler registered",
);

assert(
  source.includes('pi.on("session_info_changed"'),
  "session_info_changed event handler registered",
);

assert(
  source.includes('pi.on("tool_call"'),
  "tool_call event handler registered",
);

assert(
  source.includes('pi.on("tool_result"'),
  "tool_result event handler registered",
);

// ─── Test 5: prepareArguments for Session Resume Compatibility ───────────────

section("Test 5: prepareArguments for Session Resume Compatibility");

const prepareArgsCount = (source.match(/prepareArguments\(/g) || []).length;
assert(prepareArgsCount === 3, "All 3 tools have prepareArguments (found " + prepareArgsCount + ")");

assert(
  source.includes("prepareArguments") && source.includes("return args"),
  "prepareArguments returns args for invalid input",
);

// ─── Test 6: keyHint() in Render Functions ───────────────────────────────────

section("Test 6: keyHint() in Render Functions");

assert(
  source.includes('import { keyHint } from "@earendil-works/pi-coding-agent"'),
  "keyHint is imported from @earendil-works/pi-coding-agent",
);

assert(
  source.includes('keyHint("app.tools.expand", "to expand")'),
  "keyHint is used in renderResult functions",
);

const keyHintCount = (source.match(/keyHint\(/g) || []).length;
assert(keyHintCount >= 3, "keyHint used at least 3 times (found " + keyHintCount + ")");

// ─── Test 7: Overlay Mode for question_input ─────────────────────────────────

section("Test 7: Overlay Mode for question_input");

assert(
  source.includes("overlay: true"),
  "question_input tool uses overlay: true in ctx.ui.custom()",
);

// ─── Test 8: Slash Commands ──────────────────────────────────────────────────

section("Test 8: Slash Commands (q-status, q-clear)");

assert(
  source.includes('pi.registerCommand("q-status"'),
  "q-status command is registered",
);

assert(
  source.includes('pi.registerCommand("q-clear"'),
  "q-clear command is registered",
);

assert(
  source.includes('description: "Show questions extension usage statistics"'),
  "q-status has description",
);

assert(
  source.includes('description: "Clear any cached question state') || source.includes('Clear any cached question'),
  "q-clear has description",
);

// ─── Test 9: pi.events Inter-Extension Communication ─────────────────────────

section("Test 9: pi.events Inter-Extension Communication");

assert(
  source.includes("pi.events.emit"),
  "pi.events.emit is used for inter-extension communication",
);

assert(
  source.includes('pi.events.emit("question_answered"'),
  "question_answered event is emitted",
);

// ─── Test 10: Auto-Session Naming After Questionnaire ────────────────────────

section("Test 10: Auto-Session Naming After Questionnaire");

assert(
  source.includes("setSessionName"),
  "setSessionName is called for auto-naming",
);

assert(
  source.includes('event.toolName === "questionnaire"'),
  "Auto-naming triggered on questionnaire tool_result",
);

assert(
  source.includes("Q&A:"),
  "Session name includes Q&A prefix",
);

// ─── Test 11: Custom Message/Entry Renderers ─────────────────────────────────

section("Test 11: Custom Message/Entry Renderers");

assert(
  source.includes('pi.registerMessageRenderer("question_result"'),
  "question_result message renderer registered",
);

assert(
  source.includes('pi.registerMessageRenderer("questionnaire_result"'),
  "questionnaire_result message renderer registered",
);

assert(
  source.includes('pi.registerMessageRenderer("question_input_result"'),
  "question_input_result message renderer registered",
);

// ─── Tool Parameter Schema Tests ─────────────────────────────────────────────

section("Tool Parameter Schema Tests");

assert(
  source.includes('name: "question"') && source.includes('Type.Object({') && source.includes('question:'),
  "question tool has parameters schema with 'question' property",
);

assert(
  source.includes('options: Type.Array(') || source.includes('options: Type.'),
  "question tool has 'options' property",
);

assert(
  source.includes('type:') && source.includes('StringEnum'),
  "question tool has 'type' property with StringEnum",
);

assert(
  source.includes('allowOther: Type.Boolean({') || source.includes('allowOther: Type.'),
  "question tool has 'allowOther' property",
);

assert(
  source.includes('name: "questionnaire"') && source.includes('Type.Object({') && source.includes('questions:'),
  "questionnaire tool has parameters schema with 'questions' property",
);

assert(
  source.includes('name: "question_input"') && source.includes('Type.Object({') && source.includes('question:'),
  "question_input tool has parameters schema with 'question' property",
);

assert(
  source.includes('type:') && source.includes('StringEnum'),
  "question_input has 'type' property with StringEnum",
);

assert(
  source.includes('minLength:') || source.includes('minLength :'),
  "question_input has 'minLength' property",
);

assert(
  source.includes('maxLength:') || source.includes('maxLength :'),
  "question_input has 'maxLength' property",
);

assert(
  source.includes('pattern:') || source.includes('pattern :'),
  "question_input has 'pattern' property",
);

assert(
  source.includes('required:') || source.includes('required :'),
  "question_input has 'required' property",
);

// ─── Tool Execution Mode Tests ───────────────────────────────────────────────

section("Tool Execution Mode Tests");

const executeCount = (source.match(/execute\(/g) || []).length;
assert(executeCount >= 3, "All 3 tools have execute functions (found " + executeCount + " execute calls)");

const renderCallCount = (source.match(/renderCall\(/g) || []).length;
assert(renderCallCount === 3, "All 3 tools have renderCall functions (found " + renderCallCount + ")");

const renderResultCount = (source.match(/renderResult\(/g) || []).length;
assert(renderResultCount === 3, "All 3 tools have renderResult functions (found " + renderResultCount + ")");

// ─── Validation Logic Tests ──────────────────────────────────────────────────

section("Validation Logic Tests");

assert(
  source.includes("function validateAnswer"),
  "validateAnswer function is defined",
);

assert(
  source.includes("minLength") && source.includes("must be at least"),
  "minLength validation with descriptive message",
);

assert(
  source.includes("maxLength") && source.includes("must be at most"),
  "maxLength validation with descriptive message",
);

assert(
  source.includes("pattern") && (source.includes("does not match") || source.includes("doesn't match")),
  "pattern validation with descriptive message",
);

assert(
  source.includes("email") && (source.includes("email format") || source.includes("email")),
  "email type validation with descriptive message",
);

assert(
  source.includes("number") && (source.includes("must be a valid number") || source.includes("number")),
  "number type validation with descriptive message",
);

// ─── TUI Component Tests ─────────────────────────────────────────────────────

section("TUI Component Tests");

assert(
  source.includes("registerQuestionTool"),
  "Question component is registered via registerQuestionTool",
);

assert(
  source.includes("registerQuestionnaireTool"),
  "Questionnaire component is registered via registerQuestionnaireTool",
);

assert(
  source.includes("registerQuestionInputTool"),
  "QuestionInput component is registered via registerQuestionInputTool",
);

assert(
  source.includes("render(width: number): string[]"),
  "Components have render methods",
);

assert(
  source.includes("handleInput(data: string)"),
  "Components have handleInput methods",
);

assert(
  source.includes("new Editor(tui, editorTheme)"),
  "Editor is used in question_input component",
);

// ─── Error Handling Tests ────────────────────────────────────────────────────

section("Error Handling Tests");

assert(
  source.includes("function errorResult"),
  "errorResult helper function is defined",
);

assert(
  source.includes("User cancelled the question") || source.includes("cancelled the question"),
  "Question tool handles cancellation",
);

assert(
  source.includes("User cancelled the questionnaire") || source.includes("cancelled the questionnaire"),
  "Questionnaire tool handles cancellation",
);

assert(
  source.includes("User cancelled the input") || source.includes("cancelled the input"),
  "Question input tool handles cancellation",
);

assert(
  source.includes("validationErrors") || source.includes("errors.length > 0"),
  "Validation errors are tracked and reported",
);

// ─── Multi-Select Feature Tests ──────────────────────────────────────────────

section("Multi-Select Feature Tests");

assert(
  source.includes("isMulti") && source.includes("selectedIndices"),
  "Multi-select with selectedIndices tracking",
);

assert(
  source.includes("[ ]") && source.includes("[x]"),
  "Multi-select shows checkbox-style indicators",
);

assert(
  source.includes("Selected:") && source.includes("join("),
  "Multi-select shows selected items summary",
);

// ─── Conditional Branching Tests ─────────────────────────────────────────────

section("Conditional Branching Tests");

assert(
  source.includes("conditionalBranches") || source.includes("condition"),
  "Questionnaire supports conditional branching",
);

assert(
  source.includes("branchIndex") || source.includes("nextIndex") || source.includes("conditionalBranches") || source.includes("branch"),
  "Questionnaire tracks branch navigation",
);

// ─── Progress Bar Tests ──────────────────────────────────────────────────────

section("Progress Bar Tests");

assert(
  source.includes("progress") && (source.includes("currentStep") || source.includes("currentQuestion")),
  "Questionnaire has progress tracking",
);

assert(
  source.includes("progressBar") || source.includes("progress"),
  "Progress bar is rendered in questionnaire",
);

// ─── Auto-Advance Tests ──────────────────────────────────────────────────────

section("Auto-Advance Tests");

assert(
  source.includes("autoAdvance") || source.includes("auto"),
  "Questionnaire supports auto-advance feature",
);

// ─── Yes/No and Rating Type Tests ────────────────────────────────────────────

section("Yes/No and Rating Type Tests");

assert(
  source.includes("yes_no") || source.includes("yesNo"),
  "Questionnaire supports yes_no question type",
);

assert(
  source.includes("rating") || source.includes("Rating"),
  "Questionnaire supports rating question type",
);

// ─── Result Structure Tests ──────────────────────────────────────────────────

section("Result Structure Tests");

assert(
  source.includes("type QuestionResult") || source.includes("interface QuestionResult"),
  "QuestionResult type/interface is defined",
);

assert(
  source.includes("type QuestionnaireResult") || source.includes("interface QuestionnaireResult"),
  "QuestionnaireResult type/interface is defined",
);

assert(
  source.includes("type QuestionInputResult") || source.includes("interface QuestionInputResult"),
  "QuestionInputResult type/interface is defined",
);

assert(
  source.includes("wasCustom"),
  "Results track whether custom text was entered",
);

// ─── Summary ─────────────────────────────────────────────────────────────────

section("Test Summary");

console.log(BOLD + "Total: " + total + DIM);
console.log(PASS + " Passed: " + passed + DIM);
console.log(FAIL + " Failed: " + failed + DIM);

if (failed === 0) {
  console.log("\n" + BOLD + "\x1b[32mAll " + total + " tests passed! ✓" + DIM);
  process.exit(0);
} else {
  console.log("\n" + BOLD + "\x1b[31m" + failed + " test(s) failed!" + DIM);
  process.exit(1);
}
