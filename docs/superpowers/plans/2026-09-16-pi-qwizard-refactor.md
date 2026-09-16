# Pi QWizard Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic Pi QWizard extension into focused modules while preserving its five tools, command, events, result contracts, and current feature set.

**Architecture:** Keep `src/index.ts` as the Pi extension entrypoint. Move schemas/types, pure question logic, state, commands/events, tool registration, and shared widgets into focused modules. Tool modules compose shared widgets and return the same Pi tool results.

**Tech Stack:** TypeScript, Pi coding-agent extension API, `@earendil-works/pi-tui`, TypeBox, Biome, Node test runner.

**Spec:** Approved in-chat design on 2026-09-16.

## Global Constraints

- Preserve the five existing tools: `question`, `questionnaire`, `question_input`, `question_throttle`, and `question_branch`.
- Preserve `/qwizard`, lifecycle event subscriptions, inter-extension events, validation, branching, throttling, and session naming.
- Do not add new user-facing features or change the public tool names and result contracts.
- Use `StringEnum` for enum schemas and preserve `executionMode: "sequential"` and `prepareArguments` behavior.
- Reuse shared widget/layout code; do not duplicate complete TUI renderers per tool.

---

### Task 1: Establish characterization tests and module boundaries

**Files:**
- Create: `src/types.ts`, `src/schemas.ts`, `src/core/validation.ts`, `src/core/branching.ts`, `src/core/question-options.ts`, `src/core/formatting.ts`
- Test: `src/core/core.test.cjs`
- Modify: `src/questions.test.cjs`

**Interfaces:**
- Pure helpers expose stable, importable behavior for validation, branching, option generation, and formatting.
- Existing source-analysis tests remain as compatibility checks until registration moves out of `index.ts`, then are rewritten to inspect the assembled extension behavior and module structure.

- [ ] **Step 1: Write failing tests for extracted pure behavior**
- [ ] **Step 2: Run `node src/core/core.test.cjs` and verify the new imports/tests fail for missing modules**
- [ ] **Step 3: Extract the existing pure logic with unchanged behavior**
- [ ] **Step 4: Run the focused tests and then `npm test`**
- [ ] **Step 5: Commit the pure core extraction**

### Task 2: Extract shared widget primitives and improve visual consistency

**Files:**
- Create: `src/widgets/layout.ts`, `src/widgets/selection-widget.ts`, `src/widgets/text-input-widget.ts`, `src/widgets/questionnaire-widget.ts`
- Test: `src/widgets/widgets.test.cjs`
- Modify: `src/core/formatting.ts`

**Interfaces:**
- Shared widgets accept question/options/theme/keybindings and completion callbacks through Pi’s `ctx.ui.custom` component contract.
- Widgets own wrapping, headers, separators, keyboard hints, validation display, and render invalidation.

- [ ] **Step 1: Write failing widget contract tests for narrow-width rendering and shared selection/text behavior**
- [ ] **Step 2: Run the focused widget tests and verify expected failures**
- [ ] **Step 3: Implement minimal shared widget primitives based on the existing UI behavior**
- [ ] **Step 4: Run widget tests, typecheck, and lint**
- [ ] **Step 5: Commit the widget extraction**

### Task 3: Extract extension state, commands, and events

**Files:**
- Create: `src/state/throttle.ts`, `src/state/settings.ts`, `src/commands.ts`, `src/events.ts`
- Test: `src/state/state.test.cjs`

**Interfaces:**
- State modules expose throttle checks/recording/clearing and auto-throttle settings without exposing implementation details.
- `registerCommands(pi)` and `registerEvents(pi)` attach the current command/event behavior to an extension API instance.

- [ ] **Step 1: Write failing tests for throttle lifecycle and command/event registration contracts**
- [ ] **Step 2: Run the focused tests and verify expected failures**
- [ ] **Step 3: Move state, command, and event logic without changing behavior**
- [ ] **Step 4: Run focused tests and typecheck**
- [ ] **Step 5: Commit the state/command/event extraction**

### Task 4: Split the five tool registrations

**Files:**
- Create: `src/tools/question.ts`, `src/tools/questionnaire.ts`, `src/tools/question-input.ts`, `src/tools/question-throttle.ts`, `src/tools/question-branch.ts`, `src/tools/shared.ts`
- Modify: `src/schemas.ts`, `src/types.ts`
- Test: `src/tools/tools.test.cjs`

**Interfaces:**
- Each `registerXTool(pi)` function registers exactly one existing Pi tool.
- `src/tools/shared.ts` contains common result/error/render helpers and question normalization, not tool-specific policy.

- [ ] **Step 1: Write failing registration tests for all five tool names and required hooks**
- [ ] **Step 2: Run the focused tests and verify expected failures**
- [ ] **Step 3: Move each tool implementation to its own module and replace duplicated UI with shared widgets**
- [ ] **Step 4: Run all tests, typecheck, and lint**
- [ ] **Step 5: Commit the tool split**

### Task 5: Reduce `index.ts` to the extension composition root

**Files:**
- Modify: `src/index.ts`
- Modify: `src/questions.test.cjs`
- Modify: `README.md` only if paths or documented behavior require correction

**Interfaces:**
- Default export registers the five tools, commands, and events while containing no tool implementation or widget rendering logic.

- [ ] **Step 1: Add a failing boundary test that rejects tool/UI implementation code in `index.ts` and requires all registrations**
- [ ] **Step 2: Run it and verify it fails against the monolith**
- [ ] **Step 3: Replace the monolith with composition-root wiring**
- [ ] **Step 4: Run `npm test`, `npm run typecheck`, and `npm run lint`**
- [ ] **Step 5: Commit the complete refactor**

### Task 6: Package and verify the deliverable

**Files:**
- Create: `pi-qwizard-refactored.zip` outside the project directory

- [ ] **Step 1: Run the complete verification commands from a clean package tree**
- [ ] **Step 2: Inspect the file tree and archive contents**
- [ ] **Step 3: Ensure no generated artifacts or test fixtures are accidentally included**
- [ ] **Step 4: Create the final ZIP and verify it can be listed/extracted**

