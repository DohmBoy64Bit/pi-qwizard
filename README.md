# pi-qwizard

Interactive question tools for [Pi](https://pi.dev) — three tools for gathering user input in the TUI.

## Tools

### `question`

Ask a single question with selectable options. Includes a "Type something..." fallback for custom text.

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

**Interface:** Options list with ↑↓ navigation, Enter to select, Esc to cancel.

### `questionnaire`

Ask multiple questions in a tabbed wizard. Each question has its own tab with selectable options.

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

**Interface:** Tab bar navigation (Tab/←→), ↑↓ to select options, Enter to advance, Esc to cancel.

### `question_input`

Ask an open-ended question with free-form text input. The user types their answer in an inline editor.

```typescript
question_input({
  question: "Describe your product in one sentence:",
  placeholder: "e.g., 'An AI assistant for terminal workflows'",
  required: true
})
```

**Interface:** Inline text editor with Enter to submit, Esc to cancel.

## Installation

```bash
pi install pi-qwizard
```

Or add to your `settings.json`:

```json
{
  "packages": ["pi-qwizard@1.0.0"]
}
```

## License

MIT
