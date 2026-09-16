# QWizard API Reference

This document describes the tool schemas, result details, commands, events, and development interfaces implemented by `pi-qwizard`.

## Tool registration

QWizard registers five sequential Pi tools from `src/index.ts`: `question`, `questionnaire`, `question_input`, `question_throttle`, and `question_branch`. Each exposes Pi `prepareArguments`, `execute`, `renderCall`, and `renderResult` handlers. Schemas are defined in `src/schemas.ts`.

## Shared option shape

```ts
type Option = { label: string; description?: string };
```

## `question`

| Parameter | Type | Required | Default |
| --- | --- | ---: | --- |
| `question` | `string` | Yes | — |
| `options` | `Option[]` | Yes | — |
| `allowOther` | `boolean` | No | `true` |
| `type` | `"single" \| "multi"` | No | `"single"` |

When enabled, `allowOther` adds `Type something...`. Empty option arrays return an error result.

```ts
interface QuestionResult {
  question: string;
  options: string[];
  answer: string | string[] | null;
  wasCustom: boolean;
  index?: number;
}
```

`index` is included for regular selectable answers. Cancellation and invalid requests use `answer: null` in `details`.

## `questionnaire`

```ts
interface QuestionnaireQuestion {
  id: string;
  label?: string;
  prompt: string;
  options: Option[];
  allowOther?: boolean;
  required?: boolean;
  autoAdvance?: boolean;
  type?: "single" | "multi" | "yes_no" | "rating";
}
```

| Parameter | Type | Required |
| --- | --- | ---: |
| `questions` | `QuestionnaireQuestion[]` | Yes |

Defaults are `label: Q1, Q2…`, `required: true`, `autoAdvance: true`, and regular single-select behavior. `yes_no` generates `Yes` and `No`; `rating` generates `1`–`5` with descriptions from `Poor` to `Excellent`.

The schema accepts `allowOther`, but the current questionnaire widget renders supplied options and does not add a custom-text option. Use `question_input` for written questionnaire answers.

```ts
interface QuestionnaireResult {
  questions: Array<{ id: string; label: string; prompt: string }>;
  answers: Array<{
    id: string;
    value: string | string[];
    label: string | string[];
    wasCustom: boolean;
    index?: number;
  }>;
  cancelled: boolean;
}
```

Empty question lists and non-TUI execution return error results with `cancelled: true`.

## `question_input`

| Parameter | Type | Required | Default |
| --- | --- | ---: | --- |
| `question` | `string` | Yes | — |
| `placeholder` | `string` | No | — |
| `required` | `boolean` | No | `true` |
| `minLength` | `number` | No | — |
| `maxLength` | `number` | No | — |
| `pattern` | `string` | No | — |
| `type` | `"text" \| "number" \| "email" \| "date"` | No | `"text"` |

```ts
interface QuestionInputResult {
  question: string;
  answer: string | null;
  validationErrors?: string[];
}
```

Length and pattern checks apply to the trimmed answer. `email` checks a basic email shape and `number` requires a numeric value. `date` is accepted by the schema but has no additional date-format validation in the current implementation.

## `question_throttle`

| Parameter | Type | Required | Default |
| --- | --- | ---: | --- |
| `question` | `string` | Yes | — |
| `options` | `Option[]` | Yes | — |
| `cooldown` | `number` | No | `5` seconds |
| `allowOther` | `boolean` | No | `true` |
| `type` | `"single" \| "multi"` | No | `"single"` |

The tool uses an in-memory global timestamp and does not persist across restarts.

```ts
interface QuestionThrottleResult extends QuestionResult {
  throttled: boolean;
}
```

`throttled` is true when the tool waited before displaying the prompt.

## `question_branch`

Branch questions use the questionnaire fields plus:

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `when` | `string \| object \| array` | — | Condition evaluated against earlier answers. |
| `on` | `boolean` | — | `true` always shows; `false` always hides and overrides `when`. |

String conditions use `field_id operator value`. Supported operators:

| Operator | Behavior |
| --- | --- |
| `equals`, `not_equals` | Exact match or mismatch. |
| `contains` | Case-insensitive substring match. |
| `matches` | Case-insensitive regular-expression match; invalid expressions are false. |
| `in` | String value appears in a comma-and-space-separated list. |
| `is_empty`, `is_not_empty` | Checks empty or `(no response)` values. |
| `gt`, `lt`, `gte`, `lte` | Numeric comparison. |

Object conditions use `{ field: string, operator?: string, value?: unknown }`; the default operator is `equals`. Array conditions are combined with logical AND. An unanswered referenced field evaluates false. Invalid string condition syntax passes through as visible.

```ts
interface QuestionBranchResult extends QuestionnaireResult {
  skipped: string[];
}
```

`skipped` contains IDs hidden while navigating.

## Validation rules

Before a prompt opens, QWizard normalizes carriage returns in question IDs, labels, prompts, option labels, option descriptions, and string branch conditions. It then rejects:

- Empty questionnaires.
- More than four questions in one questionnaire.
- Duplicate question IDs or question prompts within one questionnaire.
- Fewer than two options for regular `single` and `multi` questions.
- Reserved option labels: `Other` and `Type something...`.
- The `Next` label, which is reserved for protocol rows.
- Duplicate option labels within one question.

The generated `yes_no` and `rating` question types are exempt from the minimum supplied-options rule because their options are generated by the tool. Validation failures include a stable `error` category in tool details. Invalid branch strings and unknown operators evaluate false rather than silently showing the question.

## Commands

| Command | Behavior |
| --- | --- |
| `/qwizard` or `/qwizard help` | Display help. |
| `/qwizard status` | Display tools and automatic-throttle settings. |
| `/qwizard auto-throttle` | Display automatic-throttle settings and usage. |
| `/qwizard auto-throttle on` | Enable automatic throttling. |
| `/qwizard auto-throttle off` | Disable automatic throttling. |
| `/qwizard auto-throttle <N>` | Set cooldown to an integer from 1 through 60 seconds. |
| `/qwizard clear` | Clear the in-memory throttle timestamp. |

Automatic throttling defaults to enabled with a 3-second in-memory cooldown. Change it with the slash commands; the current implementation does not load these settings from `settings.json`.

## Events

- `session_start`: notifies when a new or resumed session loads the extension.
- `session_shutdown`: reserved for in-memory cleanup.
- `session_info_changed`: reserved for session-name changes.
- `tool_call`: applies automatic throttling to all five tools when enabled.
- `tool_result`: emits `question_answered` when details contain an `answer`, and names a questionnaire session `Q&A: <first answer>` when its result contains at least one answer.

## Development

```bash
npm test
npm run test:runtime
npm run coverage
npm run parity
npm run typecheck
npm run lint
npm run test:all
```

Runtime tests use deterministic Pi/TUI test doubles; they do not launch the Pi application itself. Run a local Pi smoke test separately when validating a specific Pi installation.

## License

MIT
