# pi-qwizard

Interactive question tools for [Pi](https://pi.dev), built for gathering user input directly in the TUI.

`pi-qwizard` provides five focused tools for selectable prompts, multi-step questionnaires, validated free-form input, rate-limited questions, and branching logic — with support for multi-select, conditional question types, validation, custom text entry, and more.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
  - [From the npm registry](#from-the-npm-registry)
  - [From local source](#from-local-source)
- [Tools](#tools)
  - [`question`](#question)
  - [`questionnaire`](#questionnaire)
  - [`question_input`](#question_input)
  - [`question_throttle`](#question_throttle)
  - [`question_branch`](#question_branch)
- [API Reference](#api-reference)
  - [`question` Parameters](#question-parameters)
  - [`questionnaire` Parameters](#questionnaire-parameters)
  - [`question_input` Parameters](#question_input-parameters)
  - [`question_throttle` Parameters](#question_throttle-parameters)
  - [`question_branch` Parameters](#question_branch-parameters)
- [License](#license)

## Overview

`pi-qwizard` includes five tools for common interactive input workflows in Pi:

| Tool | Best for | Key capabilities |
| --- | --- | --- |
| [`question`](#question) | A single selectable prompt | Single-select, multi-select, optional custom text entry |
| [`questionnaire`](#questionnaire) | Multi-step question flows | Tabbed wizard, progress tracking, optional questions, multi-select, pre-built question types, conditional visibility |
| [`question_input`](#question_input) | Free-form text input | Required/optional input, length constraints, regex validation, type-specific validation |
| [`question_throttle`](#question_throttle) | Rate-limited questions | Cooldown between prompts, global timestamp tracking |
| [`question_branch`](#question_branch) | Conditional question flows | Branching logic, skip questions, operators (equals, contains, matches, in, etc.) |

## Installation

### From the npm registry

Install the package with Pi:

```bash
pi install npm:@dohmboy64bit/pi-qwizard
```

Or add it to your `settings.json`:

```json
{
  "packages": ["npm:@dohmboy64bit/pi-qwizard"]
}
```

### From local source

Install directly from a local checkout or project directory:

```bash
pi install ./path/to/pi-qwizard
```

Or add the local path to your `settings.json`:

```json
{
  "packages": ["./path/to/pi-qwizard"]
}
```

## Tools

### `question`

Ask a single question with selectable options. It supports single or multiple selection and can optionally include a **"Type something..."** fallback for custom text.

#### Basic usage

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

#### Advanced usage

Disable the **"Type something..."** option:

```typescript
question({
  question: "Choose your plan",
  options: [
    { label: "Free" },
    { label: "Pro" },
  ],
  allowOther: false
})
```

Enable multiple selection:

```typescript
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

#### Interface

Use **↑ / ↓** to navigate the options. Press **Enter** to select or toggle an option. Press **Esc** to cancel in single-select mode or submit the selected options in multi-select mode.

---

### `questionnaire`

Ask multiple questions in a tabbed wizard with progress tracking. Each question has its own tab with selectable options.

#### Basic usage

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

#### Advanced usage

##### Optional questions and auto-advance control

Questions can be required or optional, and `autoAdvance` can be controlled per question through the questionnaire API.

```typescript
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
```

##### Pre-built question types

```typescript
questionnaire({
  questions: [
    { id: "satisfaction", prompt: "Rate your experience", type: "rating" },
    { id: "recommend", prompt: "Would you recommend us?", type: "yes_no" }
  ]
})
```

##### Multi-select questions

```typescript
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
```

##### Conditional visibility with `when`

```typescript
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

#### Interface

The questionnaire uses a tab bar with a progress indicator, for example `█░ 60% (3/5)`.

- **Tab / →**: switch forward
- **Shift+Tab / ←**: switch backward
- **↑ / ↓**: select options
- **Enter**: advance
- **Esc**: cancel

---

### `question_input`

Ask an open-ended question with free-form text input. It supports validation including length constraints, regex patterns, and type-specific validation.

#### Basic usage

```typescript
question_input({
  question: "Describe your product in one sentence:",
  placeholder: "e.g., 'An AI assistant for terminal workflows'",
  required: true
})
```

#### Advanced usage

##### Email validation

```typescript
question_input({
  question: "Your email address",
  type: "email",
  required: true
})
```

##### Number input with range

```typescript
question_input({
  question: "Your age",
  type: "number",
  minLength: 1,
  maxLength: 3
})
```

##### Regex pattern validation

```typescript
question_input({
  question: "Username (letters, numbers, underscores)",
  pattern: "^[a-zA-Z0-9_]+$",
  minLength: 3,
  maxLength: 20
})
```

#### Interface

The tool uses an inline text editor with a character count. Press **Enter** to submit or **Esc** to cancel. Validation errors are shown inline.

---

### `question_throttle`

Ask a question with rate limiting. Ensures a minimum cooldown period between questions to prevent spam. Tracks timestamps globally across all question tools.

#### Basic usage

```typescript
question_throttle({
  question: "What's your favorite color?",
  options: [
    { label: "Red" },
    { label: "Blue" },
    { label: "Green" },
  ]
})
```

#### Custom cooldown

Set a longer cooldown between questions:

```typescript
question_throttle({
  question: "What's your preferred framework?",
  options: [
    { label: "React" },
    { label: "Vue" },
    { label: "Svelte" },
  ],
  cooldown: 15  // 15 seconds minimum between questions
})
```

#### Interface

Same as `question` — use **↑ / ↓** to navigate, **Enter** to select, **Esc** to cancel. The cooldown is enforced silently before the question appears.

---

### `question_branch`

Multi-question wizard with advanced branching logic. Questions can be conditionally shown or hidden based on previous answers using a variety of comparison operators.

#### Basic usage

```typescript
question_branch({
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
      id: "frontend",
      prompt: "Choose a frontend framework",
      options: [
        { label: "React" },
        { label: "Vue" },
      ],
      when: "language equals JavaScript"
    },
    {
      id: "backend",
      prompt: "Choose a backend framework",
      options: [
        { label: "Django" },
        { label: "Flask" },
      ],
      when: "language equals Python"
    }
  ]
})
```

#### Advanced branching operators

The `when` field supports multiple operators:

| Operator | Description | Example |
| --- | --- | --- |
| `equals` | Exact match (default) | `"language equals JavaScript"` |
| `not_equals` | Not equal | `"role not_equals admin"` |
| `contains` | Substring match | `"name contains John"` |
| `matches` | Regex match | `"email matches @gmail.com"` |
| `in` | Value in comma-separated list | `"tags in React, Vue"` |
| `is_empty` | Answer is empty | `"feedback is_empty"` |
| `is_not_empty` | Answer is not empty | `"comments is_not_empty"` |
| `gt` | Greater than | `"score gt 80"` |
| `lt` | Less than | `"age lt 18"` |
| `gte` | Greater than or equal | `"level gte 5"` |
| `lte` | Less than or equal | `"score lte 100"` |

#### Object syntax for complex conditions

```typescript
question_branch({
  questions: [
    {
      id: "experience",
      prompt: "Years of experience",
      options: [
        { label: "Junior" },
        { label: "Mid-level" },
        { label: "Senior" },
      ]
    },
    {
      id: "senior_roles",
      prompt: "Preferred senior role",
      options: [
        { label: "Architect" },
        { label: "Tech Lead" },
        { label: "Principal" },
      ],
      when: {
        field: "experience",
        operator: "equals",
        value: "Senior"
      }
    }
  ]
})
```

#### Always show or hide

Use the `on` property to force visibility regardless of conditions:

```typescript
question_branch({
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
      id: "deprecated_tool",
      prompt: "Use legacy tool?",
      options: [
        { label: "Yes" },
        { label: "No" },
      ],
      on: false  // Always hidden
    }
  ]
})
```

#### Interface

Same as `questionnaire` — tab bar with progress indicator, **Tab / →** to switch forward, **Shift+Tab / ←** to switch backward, **↑ / ↓** to select, **Enter** to advance, **Esc** to cancel. Questions that don't match their branch condition are skipped.

## API Reference

### `question` Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `question` | `string` | required | The question text |
| `options` | `array` | required | Array of `{ label, description? }` objects |
| `allowOther` | `boolean` | `true` | Include the **"Type something..."** option |
| `type` | `"single" \| "multi"` | `"single"` | Selection mode |

### `questionnaire` Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `questions` | `array` | required | Array of question objects |

#### Question object parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Unique identifier |
| `label` | `string` | `"Q{n}"` | Tab bar label |
| `prompt` | `string` | required | Full question text |
| `options` | `array` | required | Array of `{ label, description? }` objects |
| `allowOther` | `boolean` | `true` | Include the **"Type something..."** option |
| `required` | `boolean` | `true` | Must be answered before submit |
| `autoAdvance` | `boolean` | `true` | Auto-advance after selection |
| `when` | `string` | — | Conditional visibility expression |
| `type` | `"single" \| "multi" \| "yes_no" \| "rating"` | `"single"` | Question type |

### `question_input` Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `question` | `string` | required | The question text |
| `placeholder` | `string` | — | Placeholder text in input |
| `required` | `boolean` | `true` | Answer must be non-empty |
| `minLength` | `number` | — | Minimum character count |
| `maxLength` | `number` | — | Maximum character count |
| `pattern` | `string` | — | Regex pattern to match |
| `type` | `"text" \| "number" \| "email" \| "date"` | `"text"` | Input type for validation |

### `question_throttle` Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `question` | `string` | required | The question text |
| `options` | `array` | required | Array of `{ label, description? }` objects |
| `cooldown` | `number` | `5` | Minimum seconds between questions |
| `allowOther` | `boolean` | `true` | Include the **"Type something..."** option |
| `type` | `"single" \| "multi"` | `"single"` | Selection mode |

### `question_branch` Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `questions` | `array` | required | Array of question objects |

#### Question object parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | required | Unique identifier |
| `label` | `string` | `"Q{n}"` | Tab bar label |
| `prompt` | `string` | required | Full question text |
| `options` | `array` | required | Array of `{ label, description? }` objects |
| `allowOther` | `boolean` | `true` | Include the **"Type something..."** option |
| `required` | `boolean` | `true` | Must be answered before submit |
| `autoAdvance` | `boolean` | `true` | Auto-advance after selection |
| `branch` | `object` | — | Conditional visibility: `{ when, on }` |
| `branch.when` | `string \| object` | — | Condition expression (see operators below) |
| `branch.on` | `boolean` | — | Force show (`true`) or hide (`false`) |
| `type` | `"single" \| "multi" \| "yes_no" \| "rating"` | `"single"` | Question type |

## Auto-Throttle

The extension includes automatic throttling between question tools to prevent rapid-fire prompts. This is enabled by default.

### Configuration

Auto-throttle settings are managed via slash commands:

```
/qwizard auto-throttle on     # Enable auto-throttle
/qwizard auto-throttle off    # Disable auto-throttle
/qwizard auto-throttle 5      # Set cooldown to 5 seconds
/qwizard status               # Show current settings
/qwizard clear                # Clear throttle state
```

### Settings via settings.json

You can also configure auto-throttle in your `settings.json`:

```json
{
  "qwizard": {
    "autoThrottle": {
      "enabled": true,
      "cooldown": 3
    }
  }
}
```

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `qwizard.autoThrottle.enabled` | `boolean` | `true` | Enable/disable auto-throttle |
| `qwizard.autoThrottle.cooldown` | `number` | `3` | Cooldown in seconds (1-60) |

## License

MIT
