# pi-qwizard

Interactive question tools for [Pi](https://pi.dev) — three tools for gathering user input in the TUI with advanced features like validation, conditional types, and multi-select.

## Tools

### `question`

Ask a single question with selectable options. Supports single or multiple selection, and optionally includes a "Type something..." fallback for custom text.

```typescript
question({
  question: "What's your preferred database?",
  options: [
    { label: "PostgreSQL", description: "Relational, ACID-compliant" },
    { label: "MongoDB", description: "Document-based, flexible schema" },
    { label: "SQLite", description: "Embedded, zero-config" },
  ]
})
```

**Advanced usage:**

```typescript
// Without "Type something..." option
question({
  question: "Choose your plan",
  options: [
    { label: "Free" },
    { label: "Pro" },
  ],
  allowOther: false
})

// Multiple selection
question({
  question: "Select your skills (multiple)",
  options: [
    { label: "JavaScript" },
    { label: "Python" },
    { label: "Go" },
  ],
  type: "multi"
})
```

**Interface:** Options list with ↑↓ navigation, Enter to select/toggle, Esc to cancel (single) or submit selected (multi).

### `questionnaire`

Ask multiple questions in a tabbed wizard with progress tracking. Each question has its own tab with selectable options.

```typescript
questionnaire({
  questions: [
    {
      id: "primary_user",
      label: "User",
      prompt: "Who is the primary user?",
      options: [
        { label: "Developers" },
        { label: "Designers" },
        { label: "Managers" },
      ]
    },
    {
      id: "scope",
      label: "Scope",
      prompt: "What's the project scope?",
      options: [
        { label: "MVP" },
        { label: "Full product" },
        { label: "Exploration" },
      ]
    }
  ]
})
```

**Advanced usage:**

```typescript
// With optional questions and autoAdvance control
questionnaire({
  questions: [
    {
      id: "name",
      prompt: "Your name",
      options: [],
      allowOther: true,
      required: true
    },
    {
      id: "feedback",
      prompt: "Additional comments",
      options: [],
      allowOther: true,
      required: false  // Optional question
    }
  ]
})

// Pre-built question types
questionnaire({
  questions: [
    { id: "satisfaction", prompt: "Rate your experience", type: "rating" },
    { id: "recommend", prompt: "Would you recommend us?", type: "yes_no" }
  ]
})

// Multi-select questions
questionnaire({
  questions: [
    {
      id: "skills",
      prompt: "Select your skills",
      options: [
        { label: "JavaScript" },
        { label: "Python" },
        { label: "Go" },
      ],
      type: "multi"
    }
  ]
})

// Conditional visibility (when field)
questionnaire({
  questions: [
    {
      id: "language",
      prompt: "Choose your language",
      options: [
        { label: "JavaScript" },
        { label: "Python" },
      ]
    },
    {
      id: "framework",
      prompt: "Choose a framework",
      options: [
        { label: "React" },
        { label: "Vue" },
      ],
      when: "language equals JavaScript"
    }
  ]
})
```

**Interface:** Tab bar navigation with progress bar (e.g., `█░ 60% (3/5)`), Tab/→ to switch forward, Shift+Tab/← to switch backward, ↑↓ to select options, Enter to advance, Esc to cancel.

### `question_input`

Ask an open-ended question with free-form text input. Supports validation including length constraints, regex patterns, and type-specific validation.

```typescript
question_input({
  question: "Describe your product in one sentence:",
  placeholder: "e.g., 'An AI assistant for terminal workflows'",
  required: true
})
```

**Advanced usage:**

```typescript
// Email validation
question_input({
  question: "Your email address",
  type: "email",
  required: true
})

// Number input with range
question_input({
  question: "Your age",
  type: "number",
  minLength: 1,
  maxLength: 3
})

// Regex pattern validation
question_input({
  question: "Username (letters, numbers, underscores)",
  pattern: "^[a-zA-Z0-9_]+$",
  minLength: 3,
  maxLength: 20
})
```

**Interface:** Inline text editor with character count, Enter to submit, Esc to cancel. Shows validation errors inline.

## Installation

### From npm registry

```bash
pi install npm:@dohmboy64bit/pi-qwizard
```

Or add to your `settings.json`:

```json
{
  "packages": ["@dohmboy64bit/pi-qwizard"]
}
```

### From local source

```bash
pi install ./path/to/pi-qwizard
```

## API Reference

### `question` Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `question` | string | required | The question text |
| `options` | array | required | Array of `{ label, description? }` objects |
| `allowOther` | boolean | `true` | Include "Type something..." option |
| `type` | `"single"` \| `"multi"` | `"single"` | Selection mode |

### `questionnaire` Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `questions` | array | required | Array of question objects |

**Question object parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `id` | string | required | Unique identifier |
| `label` | string | `"Q{n}"` | Tab bar label |
| `prompt` | string | required | Full question text |
| `options` | array | required | Array of `{ label, description? }` objects |
| `allowOther` | boolean | `true` | Include "Type something..." option |
| `required` | boolean | `true` | Must be answered before submit |
| `autoAdvance` | boolean | `true` | Auto-advance after selection |
| `when` | string | — | Conditional visibility expression |
| `type` | `"single"` \| `"multi"` \| `"yes_no"` \| `"rating"` | `"single"` | Question type |

### `question_input` Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `question` | string | required | The question text |
| `placeholder` | string | — | Placeholder text in input |
| `required` | boolean | `true` | Answer must be non-empty |
| `minLength` | number | — | Minimum character count |
| `maxLength` | number | — | Maximum character count |
| `pattern` | string | — | Regex pattern to match |
| `type` | `"text"` \| `"number"` \| `"email"` \| `"date"` | `"text"` | Input type for validation |

## License

MIT
