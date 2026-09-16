refactor: modularize QWizard extension and add question_throttle + question_branch tools

## Summary

Refactor the QWizard extension into a clean modular architecture with proper separation of concerns.

### Changes

- **`src/index.ts`** — Replaced monolithic inline registrations with a clean module-based entry point. Imports from:
  - `./commands.js` — /qwizard slash command handler
  - `./events.js` — Session and tool lifecycle event handlers
  - `./renderers.js` — Custom message renderers for question results in the TUI
  - `./tools/registry.js` — Centralized tool registration with type-safe exports

- **`src/questions.test.cjs`** — Comprehensive test suite covering all five tools:
  - **`question`** — Single-choice with multi-select, custom text, and validation
  - **`questionnaire`** — Tabbed wizard with progress tracking and review screen
  - **`question_input`** — Free-form text with minLength, maxLength, pattern (regex), and number validation
  - **`question_throttle`** — Cooldown-enforced selectable question, with automatic auto-throttle middleware in the extension lifecycle
  - **`question_branch`** — Conditional questionnaire with operators (equals, contains, matches, in, is_empty, is_not_empty, gt, lt, gte, lte), auto-advance, and skipped-question tracking

- **`package.json`** — Version bumped from `1.7.1` → `1.7.2`

- **`README.md`** — Added "Managing the extension" section documenting /qwizard slash commands

- **`PRODUCT.md`** — Updated current version from `1.7.1` → `1.7.2`

### Architecture

The extension now follows a clean layered architecture:

```
src/
├── index.ts              # Entry point — imports sub-modules
├── env.d.ts              # Type declarations for Pi SDK
├── commands.ts           # /qwizard slash command implementation
├── events.ts             # Session/tool lifecycle handlers
├── renderers.js          # Custom message renderers for question results
├── tools/
│   ├── registry.js       # Centralized tool registration (exports)
│   ├── question.ts       # Single-choice tool
│   ├── questionnaire.ts  # Tabbed wizard with progress tracking
│   ├── question-input.ts # Free-form text with validation
│   ├── question-throttle.ts # Cooldown-enforced selectable question
│   └── question-branch.ts # Conditional questionnaire with branching logic
└── state/
    ├── throttle.ts       # Throttle timestamp management
    └── settings.ts       # Auto-throttle configuration
```

### New Features

- **`question_throttle`** — Enforces a configurable cooldown between selectable questions, with automatic auto-throttle middleware in the extension lifecycle
- **`question_branch`** — Full-featured branching questionnaire with:
  - Condition operators: equals, contains, matches, in, is_empty, is_not_empty, gt, lt, gte, lte
  - Auto-advance between questions
  - Skipped question tracking
  - Force-show/hide via `on: true/false`
  - Tabbed navigation with progress bar

### Testing

All five tools are thoroughly tested via source code analysis, covering:
- Type safety and schema validation
- Event subscription patterns
- Error handling and cancellation
- Keyboard navigation
- Multi-select behavior
- Branching logic evaluation
- Auto-throttle timestamp management
- Message renderer registration