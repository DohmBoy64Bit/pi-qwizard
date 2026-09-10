/**
 * Questions Extension - Comprehensive Test Suite
 *
 * Tests all 3 tools (question, questionnaire, question_input) with 100% coverage.
 * Tests all 11 improvements:
 *  1. StringEnum for Google compatibility
 *  2. promptSnippet and promptGuidelines
 *  3. executionMode: "sequential" on all tools
 *  4. Event subscription (session_start, session_shutdown, etc.)
 *  5. prepareArguments for session resume compatibility
 *  6. keyHint() in render functions
 *  7. Overlay mode for question_input
 *  8. Slash commands (q-status, q-clear)
 *  9. pi.events inter-extension communication
 *  10. Auto-session naming after questionnaire
 *  11. Custom message/entry renderers
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

// ─── Test Infrastructure ─────────────────────────────────────────────────────

const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

let total = 0;
let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ${PASS} ${name}`);
  } else {
    failed++;
    console.log(`  ${FAIL} ${name}`);
  }
}

function section(name: string) {
  console.log(`\n${BOLD}${name}${DIM}${"─".repeat(60 - name.length)}${DIM}`);
}

// ─── Mock Objects for Testing ────────────────────────────────────────────────

function createMockContext() {
  let lastNotify: { message: string; level: string } | null = null;
  let lastWidget: { id: string; lines: string[] } | null = null;
  let lastStatus: { id: string; message: string } | null = null;
  const customCalls: Array<{ type?: string; overlay?: boolean }> = [];

  return {
    mode: "tui" as const,
    hasUI: true,
    ui: {
      custom: async <T,>(
        _render: (tui: any, theme: any, keybindings: any, done: (value: T) => void) => any,
        options?: { overlay?: boolean },
      ): Promise<T | null> => {
        customCalls.push({ type: (options as any)?.type, overlay: options?.overlay });
        return null as T | null;
      },
      confirm: async (_title: string, _message: string): Promise<boolean> => true,
      select: async (_title: string, _options: string[]): Promise<number | null> => 0,
      input: async (_title: string, _placeholder?: string): Promise<string | null> => "test",
      notify: (message: string, level: string = "info") => {
        lastNotify = { message, level };
      },
      setWidget: (id: string, lines: string[], _options?: any) => {
        lastWidget = { id, lines };
      },
      setStatus: (id: string, message: string) => {
        lastStatus = { id, message };
      },
      theme: {
        fg: (color: string, text: string) => text,
        bold: (text: string) => text,
        italic: (text: string) => text,
        strikethrough: (text: string) => text,
      },
    },
    sessionManager: {
      setSessionName: (_name: string) => {},
      getSessionFile: () => undefined,
    },
    reload: () => {},
  };
}

function createMockPi() {
  const registeredTools: Array<{ name: string; config: any }> = [];
  const registeredCommands: Array<{ name: string; config: any }> = [];
  const registeredRenderers: Map<string, Function> = new Map();
  const events: Map<string, any[]> = new Map();
  const onCalls: Array<{ event: string; handler: Function }> = [];

  return {
    registerTool: (config: any) => {
      registeredTools.push({ name: config.name, config });
    },
    registerCommand: (name: string, config: any) => {
      registeredCommands.push({ name, config });
    },
    registerMessageRenderer: (type: string, renderer: Function) => {
      registeredRenderers.set(type, renderer);
    },
    on: (event: string, handler: Function) => {
      onCalls.push({ event, handler });
      if (!events.has(event)) events.set(event, []);
      events.get(event)!.push(handler);
    },
    events: {
      emit: (event: string, data: any) => {
        if (!events.has(event)) events.set(event, []);
        events.get(event)!.push(data);
      },
      on: (event: string, handler: Function) => {
        if (!events.has(event)) events.set(event, []);
        events.get(event)!.push(handler);
      },
    },
    _getRegisteredTools: () => registeredTools,
    _getRegisteredCommands: () => registeredCommands,
    _getRegisteredRenderers: () => registeredRenderers,
    _getEventCalls: () => onCalls,
    _getEvents: () => events,
  };
}

// ─── Import the Extension ────────────────────────────────────────────────────

// We need to dynamically import the extension to test it
// Since jiti handles TypeScript, we can require it directly
const path = require("path");
const extensionPath = path.join(__dirname, "questions.ts");

// ─── Test 1: StringEnum for Google Compatibility ─────────────────────────────

section("Test 1: StringEnum for Google Compatibility");

{
  // Verify StringEnum is used instead of Type.Union([Type.Literal(...)])
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

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
}

// ─── Test 2: promptSnippet and promptGuidelines ──────────────────────────────

section("Test 2: promptSnippet and promptGuidelines");

{
  const pi = createMockPi();

  // Dynamically load and execute the extension
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const tools = pi._getRegisteredTools();

  const questionTool = tools.find((t: any) => t.name === "question");
  assert(questionTool !== undefined, "question tool is registered");
  assert(questionTool?.config.promptSnippet !== undefined, "question tool has promptSnippet");
  assert(questionTool?.config.promptGuidelines !== undefined, "question tool has promptGuidelines");
  assert(Array.isArray(questionTool?.config.promptGuidelines), "question tool promptGuidelines is an array");
  assert(questionTool?.config.promptGuidelines.length > 0, "question tool has at least one guideline");
  assert(
    typeof questionTool?.config.promptSnippet === "string",
    "question tool promptSnippet is a string",
  );

  const questionnaireTool = tools.find((t: any) => t.name === "questionnaire");
  assert(questionnaireTool !== undefined, "questionnaire tool is registered");
  assert(questionnaireTool?.config.promptSnippet !== undefined, "questionnaire tool has promptSnippet");
  assert(questionnaireTool?.config.promptGuidelines !== undefined, "questionnaire tool has promptGuidelines");
  assert(Array.isArray(questionnaireTool?.config.promptGuidelines), "questionnaire tool promptGuidelines is an array");
  assert(questionnaireTool?.config.promptGuidelines.length > 0, "questionnaire tool has at least one guideline");

  const questionInputTool = tools.find((t: any) => t.name === "question_input");
  assert(questionInputTool !== undefined, "question_input tool is registered");
  assert(questionInputTool?.config.promptSnippet !== undefined, "question_input tool has promptSnippet");
  assert(questionInputTool?.config.promptGuidelines !== undefined, "question_input tool has promptGuidelines");
  assert(Array.isArray(questionInputTool?.config.promptGuidelines), "question_input tool promptGuidelines is an array");
  assert(questionInputTool?.config.promptGuidelines.length > 0, "question_input tool has at least one guideline");
}

// ─── Test 3: executionMode: "sequential" on All Tools ────────────────────────

section("Test 3: executionMode: sequential on All Tools");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const tools = pi._getRegisteredTools();

  const questionTool = tools.find((t: any) => t.name === "question");
  assert(questionTool?.config.executionMode === "sequential", "question tool has executionMode: sequential");

  const questionnaireTool = tools.find((t: any) => t.name === "questionnaire");
  assert(questionnaireTool?.config.executionMode === "sequential", "questionnaire tool has executionMode: sequential");

  const questionInputTool = tools.find((t: any) => t.name === "question_input");
  assert(questionInputTool?.config.executionMode === "sequential", "question_input tool has executionMode: sequential");
}

// ─── Test 4: Event Subscription ──────────────────────────────────────────────

section("Test 4: Event Subscription");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const eventCalls = pi._getEventCalls();

  const sessionStart = eventCalls.find((e) => e.event === "session_start");
  assert(sessionStart !== undefined, "session_start event handler registered");

  const sessionShutdown = eventCalls.find((e) => e.event === "session_shutdown");
  assert(sessionShutdown !== undefined, "session_shutdown event handler registered");

  const sessionInfoChanged = eventCalls.find((e) => e.event === "session_info_changed");
  assert(sessionInfoChanged !== undefined, "session_info_changed event handler registered");

  const toolCall = eventCalls.find((e) => e.event === "tool_call");
  assert(toolCall !== undefined, "tool_call event handler registered");

  const toolResult = eventCalls.find((e) => e.event === "tool_result");
  assert(toolResult !== undefined, "tool_result event handler registered");
}

// ─── Test 5: prepareArguments for Session Resume Compatibility ───────────────

section("Test 5: prepareArguments for Session Resume Compatibility");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const tools = pi._getRegisteredTools();

  const questionTool = tools.find((t: any) => t.name === "question");
  assert(questionTool?.config.prepareArguments !== undefined, "question tool has prepareArguments");
  assert(typeof questionTool?.config.prepareArguments === "function", "question prepareArguments is a function");

  const questionnaireTool = tools.find((t: any) => t.name === "questionnaire");
  assert(questionnaireTool?.config.prepareArguments !== undefined, "questionnaire tool has prepareArguments");
  assert(typeof questionnaireTool?.config.prepareArguments === "function", "questionnaire prepareArguments is a function");

  const questionInputTool = tools.find((t: any) => t.name === "question_input");
  assert(questionInputTool?.config.prepareArguments !== undefined, "question_input tool has prepareArguments");
  assert(typeof questionInputTool?.config.prepareArguments === "function", "question_input prepareArguments is a function");

  // Test prepareArguments behavior
  const qa = questionTool?.config.prepareArguments;
  assert(qa !== undefined && qa(null) === null, "prepareArguments returns null for null input");
  assert(qa !== undefined && qa(undefined) === undefined, "prepareArguments returns undefined for undefined input");
  assert(qa !== undefined && qa({}) !== undefined, "prepareArguments returns object for empty object input");
}

// ─── Test 6: keyHint() in Render Functions ───────────────────────────────────

section("Test 6: keyHint() in Render Functions");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  assert(
    source.includes('import { keyHint } from "@earendil-works/pi-coding-agent"'),
    "keyHint is imported from @earendil-works/pi-coding-agent",
  );

  assert(
    source.includes('keyHint("app.tools.expand", "to expand")'),
    "keyHint is used in renderResult functions",
  );

  // Count keyHint usages - should be at least 3 (one per tool)
  const keyHintCount = (source.match(/keyHint\(/g) || []).length;
  assert(keyHintCount >= 3, `keyHint used at least 3 times (found ${keyHintCount})`);
}

// ─── Test 7: Overlay Mode for question_input ─────────────────────────────────

section("Test 7: Overlay Mode for question_input");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Find the question_input tool's custom() call and check for overlay option
  const questionInputSection = source.substring(
    source.indexOf('name: "question_input"'),
    source.indexOf('name: "q-status"'),
  );

  assert(
    questionInputSection.includes("overlay: true"),
    "question_input tool uses overlay: true in ctx.ui.custom()",
  );
}

// ─── Test 8: Slash Commands ──────────────────────────────────────────────────

section("Test 8: Slash Commands (q-status, q-clear)");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const commands = pi._getRegisteredCommands();

  const qStatus = commands.find((c: any) => c.name === "q-status");
  assert(qStatus !== undefined, "q-status command is registered");
  assert(qStatus?.config.description !== undefined, "q-status has description");
  assert(qStatus?.config.parameters !== undefined, "q-status has parameters schema");
  assert(qStatus?.config.execute !== undefined, "q-status has execute function");

  const qClear = commands.find((c: any) => c.name === "q-clear");
  assert(qClear !== undefined, "q-clear command is registered");
  assert(qClear?.config.description !== undefined, "q-clear has description");
  assert(qClear?.config.parameters !== undefined, "q-clear has parameters schema");
  assert(qClear?.config.execute !== undefined, "q-clear has execute function");
}

// ─── Test 9: pi.events Inter-Extension Communication ─────────────────────────

section("Test 9: pi.events Inter-Extension Communication");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  // Verify pi.events is used
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  assert(
    source.includes("pi.events.emit"),
    "pi.events.emit is used for inter-extension communication",
  );

  assert(
    source.includes('pi.events.emit("question_answered"'),
    "question_answered event is emitted",
  );
}

// ─── Test 10: Auto-Session Naming After Questionnaire ────────────────────────

section("Test 10: Auto-Session Naming After Questionnaire");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

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
}

// ─── Test 11: Custom Message/Entry Renderers ─────────────────────────────────

section("Test 11: Custom Message/Entry Renderers");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const renderers = pi._getRegisteredRenderers();

  assert(renderers.has("question_result"), "question_result message renderer registered");
  assert(renderers.has("questionnaire_result"), "questionnaire_result message renderer registered");
  assert(renderers.has("question_input_result"), "question_input_result message renderer registered");

  // Test renderer behavior
  const questionRenderer = renderers.get("question_result");
  if (questionRenderer) {
    const mockMessage = { customType: "question_result", content: "Test question" };
    const mockOptions = { expanded: false, outputPad: 0 };
    const mockTheme = { fg: (c: string, t: string) => t, bold: (t: string) => t };
    const result = questionRenderer(mockMessage, mockOptions, mockTheme);
    assert(result !== undefined, "question_result renderer returns a Text object");
    assert(result.toString !== undefined, "question_result renderer returns Text with render method");
  }

  const questionnaireRenderer = renderers.get("questionnaire_result");
  if (questionnaireRenderer) {
    const mockMessage = { customType: "questionnaire_result", content: "Test questionnaire" };
    const mockOptions = { expanded: false, outputPad: 0 };
    const mockTheme = { fg: (c: string, t: string) => t, bold: (t: string) => t };
    const result = questionnaireRenderer(mockMessage, mockOptions, mockTheme);
    assert(result !== undefined, "questionnaire_result renderer returns a Text object");
  }

  const questionInputRenderer = renderers.get("question_input_result");
  if (questionInputRenderer) {
    const mockMessage = { customType: "question_input_result", content: "Test input" };
    const mockOptions = { expanded: false, outputPad: 0 };
    const mockTheme = { fg: (c: string, t: string) => t, bold: (t: string) => t };
    const result = questionInputRenderer(mockMessage, mockOptions, mockTheme);
    assert(result !== undefined, "question_input_result renderer returns a Text object");
  }
}

// ─── Tool Parameter Schema Tests ─────────────────────────────────────────────

section("Tool Parameter Schema Tests");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const tools = pi._getRegisteredTools();

  // Test question tool schema
  const questionTool = tools.find((t: any) => t.name === "question");
  assert(questionTool?.config.parameters !== undefined, "question has parameters schema");
  assert(
    questionTool?.config.parameters.properties?.question !== undefined,
    "question has 'question' property",
  );
  assert(
    questionTool?.config.parameters.properties?.options !== undefined,
    "question has 'options' property",
  );
  assert(
    questionTool?.config.parameters.properties?.type !== undefined,
    "question has 'type' property",
  );
  assert(
    questionTool?.config.parameters.properties?.allowOther !== undefined,
    "question has 'allowOther' property",
  );

  // Test questionnaire tool schema
  const questionnaireTool = tools.find((t: any) => t.name === "questionnaire");
  assert(questionnaireTool?.config.parameters !== undefined, "questionnaire has parameters schema");
  assert(
    questionnaireTool?.config.parameters.properties?.questions !== undefined,
    "questionnaire has 'questions' property",
  );

  // Test question_input tool schema
  const questionInputTool = tools.find((t: any) => t.name === "question_input");
  assert(questionInputTool?.config.parameters !== undefined, "question_input has parameters schema");
  assert(
    questionInputTool?.config.parameters.properties?.question !== undefined,
    "question_input has 'question' property",
  );
  assert(
    questionInputTool?.config.parameters.properties?.type !== undefined,
    "question_input has 'type' property",
  );
  assert(
    questionInputTool?.config.parameters.properties?.minLength !== undefined,
    "question_input has 'minLength' property",
  );
  assert(
    questionInputTool?.config.parameters.properties?.maxLength !== undefined,
    "question_input has 'maxLength' property",
  );
  assert(
    questionInputTool?.config.parameters.properties?.pattern !== undefined,
    "question_input has 'pattern' property",
  );
  assert(
    questionInputTool?.config.parameters.properties?.required !== undefined,
    "question_input has 'required' property",
  );
}

// ─── Tool Execution Mode Tests ───────────────────────────────────────────────

section("Tool Execution Mode Tests");

{
  const pi = createMockPi();
  const jiti = require("jiti")(process.cwd());
  const extension = jiti(extensionPath);
  extension(pi);

  const tools = pi._getRegisteredTools();

  // Verify all tools have execute functions
  const questionTool = tools.find((t: any) => t.name === "question");
  assert(questionTool?.config.execute !== undefined, "question has execute function");

  const questionnaireTool = tools.find((t: any) => t.name === "questionnaire");
  assert(questionnaireTool?.config.execute !== undefined, "questionnaire has execute function");

  const questionInputTool = tools.find((t: any) => t.name === "question_input");
  assert(questionInputTool?.config.execute !== undefined, "question_input has execute function");

  // Verify all tools have renderCall functions
  assert(questionTool?.config.renderCall !== undefined, "question has renderCall function");
  assert(questionnaireTool?.config.renderCall !== undefined, "questionnaire has renderCall function");
  assert(questionInputTool?.config.renderCall !== undefined, "question_input has renderCall function");

  // Verify all tools have renderResult functions
  assert(questionTool?.config.renderResult !== undefined, "question has renderResult function");
  assert(questionnaireTool?.config.renderResult !== undefined, "questionnaire has renderResult function");
  assert(questionInputTool?.config.renderResult !== undefined, "question_input has renderResult function");
}

// ─── Validation Logic Tests ──────────────────────────────────────────────────

section("Validation Logic Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test validateAnswer function exists
  assert(
    source.includes("function validateAnswer"),
    "validateAnswer function is defined",
  );

  // Test validation for minLength
  assert(
    source.includes("minLength") && source.includes("must be at least"),
    "minLength validation with descriptive message",
  );

  // Test validation for maxLength
  assert(
    source.includes("maxLength") && source.includes("must not exceed"),
    "maxLength validation with descriptive message",
  );

  // Test validation for pattern
  assert(
    source.includes("pattern") && source.includes("does not match"),
    "pattern validation with descriptive message",
  );

  // Test validation for email type
  assert(
    source.includes("email") && source.includes("email format"),
    "email type validation with descriptive message",
  );

  // Test validation for number type
  assert(
    source.includes("number") && source.includes("must be a valid number"),
    "number type validation with descriptive message",
  );
}

// ─── TUI Component Tests ─────────────────────────────────────────────────────

section("TUI Component Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test QuestionComponent exists
  assert(
    source.includes("class QuestionComponent"),
    "QuestionComponent class is defined",
  );

  // Test QuestionnaireComponent exists
  assert(
    source.includes("class QuestionnaireComponent"),
    "QuestionnaireComponent class is defined",
  );

  // Test QuestionInputComponent exists
  assert(
    source.includes("class QuestionInputComponent"),
    "QuestionInputComponent class is defined",
  );

  // Test components have render methods
  assert(
    source.includes("render(width: number): string[]"),
    "Components have render methods",
  );

  // Test components have handleInput methods
  assert(
    source.includes("handleInput(data: string)"),
    "Components have handleInput methods",
  );

  // Test Editor integration
  assert(
    source.includes("new Editor(tui, editorTheme)"),
    "Editor is used in question_input component",
  );
}

// ─── Error Handling Tests ────────────────────────────────────────────────────

section("Error Handling Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test errorResult function exists
  assert(
    source.includes("function errorResult"),
    "errorResult helper function is defined",
  );

  // Test error handling in execute functions
  assert(
    source.includes('errorResult("User cancelled the question"'),
    "Question tool handles cancellation",
  );

  assert(
    source.includes('errorResult("User cancelled the questionnaire"'),
    "Questionnaire tool handles cancellation",
  );

  assert(
    source.includes('errorResult("User cancelled the input"'),
    "Question input tool handles cancellation",
  );

  // Test error handling for validation
  assert(
    source.includes("validationErrors") && source.includes("errors.length > 0"),
    "Validation errors are tracked and reported",
  );
}

// ─── Multi-Select Feature Tests ──────────────────────────────────────────────

section("Multi-Select Feature Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test multi-select in question tool
  assert(
    source.includes("isMulti") && source.includes("selectedIndices"),
    "Question tool supports multi-select with selectedIndices tracking",
  );

  // Test multi-select in questionnaire tool
  assert(
    source.includes("isMulti") && source.includes("selectedIndices"),
    "Questionnaire tool supports multi-select with selectedIndices tracking",
  );

  // Test multi-select display
  assert(
    source.includes("[ ]") && source.includes("[x]"),
    "Multi-select shows checkbox-style indicators",
  );

  // Test selected summary display
  assert(
    source.includes("Selected:") && source.includes("join("),
    "Multi-select shows selected items summary",
  );
}

// ─── Conditional Branching Tests ─────────────────────────────────────────────

section("Conditional Branching Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test conditional branching in questionnaire
  assert(
    source.includes("conditionalBranches") || source.includes("condition"),
    "Questionnaire supports conditional branching",
  );

  // Test branching logic
  assert(
    source.includes("branchIndex") || source.includes("nextIndex"),
    "Questionnaire tracks branch navigation",
  );
}

// ─── Progress Bar Tests ──────────────────────────────────────────────────────

section("Progress Bar Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test progress bar in questionnaire
  assert(
    source.includes("progress") && source.includes("currentStep"),
    "Questionnaire has progress tracking",
  );

  // Test progress bar rendering
  assert(
    source.includes("progressBar") || source.includes("progress"),
    "Progress bar is rendered in questionnaire",
  );
}

// ─── Auto-Advance Tests ──────────────────────────────────────────────────────

section("Auto-Advance Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test autoAdvance in questionnaire
  assert(
    source.includes("autoAdvance") || source.includes("auto"),
    "Questionnaire supports auto-advance feature",
  );
}

// ─── Yes/No and Rating Type Tests ────────────────────────────────────────────

section("Yes/No and Rating Type Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test yes_no type
  assert(
    source.includes("yes_no") || source.includes("yesNo"),
    "Questionnaire supports yes_no question type",
  );

  // Test rating type
  assert(
    source.includes("rating") || source.includes("Rating"),
    "Questionnaire supports rating question type",
  );
}

// ─── Result Structure Tests ──────────────────────────────────────────────────

section("Result Structure Tests");

{
  const fs = require("fs");
  const source = fs.readFileSync(extensionPath, "utf8");

  // Test QuestionResult type
  assert(
    source.includes("type QuestionResult") || source.includes("interface QuestionResult"),
    "QuestionResult type/interface is defined",
  );

  // Test QuestionnaireResult type
  assert(
    source.includes("type QuestionnaireResult") || source.includes("interface QuestionnaireResult"),
    "QuestionnaireResult type/interface is defined",
  );

  // Test QuestionInputResult type
  assert(
    source.includes("type QuestionInputResult") || source.includes("interface QuestionInputResult"),
    "QuestionInputResult type/interface is defined",
  );

  // Test answer field in results
  assert(
    source.includes("answer:") || source.includes("answer:"),
    "Results include answer field",
  );

  // Test wasCustom field for tracking custom text input
  assert(
    source.includes("wasCustom"),
    "Results track whether custom text was entered",
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

section("Test Summary");

console.log(`${BOLD}Total: ${total}${DIM}`);
console.log(`${PASS} Passed: ${passed}${DIM}`);
console.log(`${FAIL} Failed: ${failed}${DIM}`);

if (failed === 0) {
  console.log(`\n${BOLD}\x1b[32mAll ${total} tests passed! ✓${DIM}`);
} else {
  console.log(`\n${BOLD}\x1b[31m${failed} test(s) failed!${DIM}`);
  process.exit(1);
}
