# Pi QWizard Audit and Widget Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit and improve the existing Pi QWizard implementation while preserving all five tools, commands, events, result contracts, and current interaction behavior.

**Architecture:** Keep `src/index.ts` as the composition root. Replace duplicated selection/input rendering with shared widget components and focused policies, while keeping tool registration modules responsible for schemas, execution policy, and result formatting. Test the real registered tool callbacks with deterministic fake Pi/TUI adapters.

**Tech Stack:** TypeScript, Pi extension API, `@earendil-works/pi-tui`, TypeBox, Node test runner, c8, Biome.

**Spec:** `docs/superpowers/plans/2026-09-16-pi-qwizard-refactor.md` plus the approved audit plan in the conversation.

## Global Constraints

- Preserve `question`, `questionnaire`, `question_input`, `question_throttle`, and `question_branch`.
- Preserve `/qwizard`, lifecycle events, `question_answered`, session naming, validation, branching, throttling, cancellation, and result shapes.
- Do not add new user-facing features or change public tool names and schemas.
- Preserve `StringEnum`, `executionMode: "sequential"`, and `prepareArguments` compatibility behavior.
- Improve existing widget states, spacing, progress, hints, selected/answered/skipped states, and narrow-terminal behavior.
- Coverage must include every production module, not only pure helpers.

### Task 1: Add failing characterization and integration tests

**Files:**
- Modify: `test/core.test.ts`, `test/state.test.ts`
- Create: `test/test-harness.ts`, `test/integration.test.ts`, `test/widget-components.test.ts`
- Modify: `package.json`

- [ ] Add tests that execute registered tool definitions through a fake `ExtensionAPI` and fake `ctx.ui.custom` callback.
- [ ] Add tests for shared component input transitions, cancellation, custom input, multi-select, validation, branch skipping, throttling, commands, events, and renderers.
- [ ] Expand coverage globs to all production TypeScript files.
- [ ] Run the new tests before implementation and confirm the intended failures.

### Task 2: Extract shared widget components and render primitives

**Files:**
- Create/modify: `src/widgets/layout.ts`, `src/widgets/selection-widget.ts`, `src/widgets/questionnaire-widget.ts`, `src/widgets/text-input-widget.ts`, `src/widgets/styles.ts`
- Modify: `src/tools/question.ts`, `src/tools/question-throttle.ts`, `src/tools/questionnaire.ts`, `src/tools/question-branch.ts`, `src/tools/question-input.ts`

- [ ] Define focused widget factories that implement Pi’s `{ render, handleInput, invalidate }` component contract.
- [ ] Centralize ANSI-safe wrapping, separators, hints, progress, selection markers, and editor lines.
- [ ] Reuse the selection widget for `question` and `question_throttle`.
- [ ] Reuse the questionnaire widget for `questionnaire` and `question_branch` through explicit branching policy callbacks.
- [ ] Preserve all existing keyboard transitions and result values while improving visible state.

### Task 3: Remove dead code and tighten module boundaries

**Files:**
- Modify: `src/types.ts`, `src/runtime.ts`, `src/events.ts`, `src/commands.ts`, `src/renderers.ts`, `src/tools/*.ts`, `src/env.d.ts`
- Modify: `biome.json`, `package.json`

- [ ] Replace broad runtime-barrel destructuring with focused imports.
- [ ] Remove unused imports, variables, duplicated local helpers, and stale declarations.
- [ ] Make full-project lint the package lint command.
- [ ] Replace unsafe parsing and avoid unnecessary `any` declarations where package types permit.
- [ ] Keep compatibility declarations only where the installed package does not expose usable types.

### Task 4: Strengthen parity and documentation

**Files:**
- Modify: `scripts/parity-audit.cjs`, `README.md`, `PRODUCT.md`

- [ ] Verify registration names, schemas, hooks, lifecycle behavior, result paths, and key interaction markers against the original archive.
- [ ] Correct stale three-tool/version documentation without changing the public feature set.

### Task 5: Verify and review

- [ ] Run `npm test`.
- [ ] Run `npm run test:runtime`.
- [ ] Run `npm run coverage` with all production files included.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run parity`.
- [ ] Inspect the final diff and produce a file-by-file changelog.
