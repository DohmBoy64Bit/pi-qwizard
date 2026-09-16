# pi-qwizard

Interactive question tools for [Pi](https://pi.dev). QWizard lets an agent collect structured choices, free-form text, multi-step answers, and conditional responses through Pi’s terminal UI.

## What it provides

| Tool | Use it when you need to… |
| --- | --- |
| `question` | Ask one selectable question, including optional custom text entry or multi-select. |
| `questionnaire` | Collect answers across several questions in a tabbed wizard. |
| `question_input` | Collect a written answer with optional validation. |
| `question_throttle` | Ask a selectable question while enforcing a cooldown. |
| `question_branch` | Run a questionnaire whose questions can be shown or skipped based on earlier answers. |

QWizard is an extension for Pi, not a standalone application. The tools are intended to be called by the agent; `/qwizard` is the user-facing command for managing extension settings.

## Requirements

- Pi installed and available as `pi`.
- An interactive Pi TUI session for question tools. In non-interactive mode, tools return an error result instead of opening a prompt.

## Installation

Install from npm:

```bash
pi install npm:@dohmboy64bit/pi-qwizard
```

Or add the package to Pi settings:

```json
{"packages": ["npm:@dohmboy64bit/pi-qwizard"]}
```

For a local checkout:

```bash
pi install ./path/to/pi-qwizard
```

You can also add the local path to `settings.json`:

```json
{"packages": ["./path/to/pi-qwizard"]}
```

Restart Pi or start a new session after installing an extension.

## Using QWizard

Describe the interaction you want in your prompt. Pi can then choose the appropriate tool:

```text
Ask me which database I want to use for this project.
```

```text
Walk me through a project setup questionnaire covering the user, scope, and timeline.
```

```text
Ask me to describe the product in one sentence and require an answer.
```

The agent selects the tool and opens the corresponding TUI. Exact parameters and result contracts are documented in [API Reference](docs/API.md).

## Keyboard controls

### Selectable questions

`question` and `question_throttle` use a selectable list:

- `↑` / `↓` move through options.
- `Enter` selects an option.
- `Esc` cancels a single-select prompt.
- In multi-select mode, `Enter` toggles an option; pressing `Enter` again on the same selected option submits the selection.
- When custom text is enabled, selecting **Type something...** opens text entry. `Enter` submits non-empty text and `Esc` returns to the option list.

### Questionnaires

`questionnaire` and `question_branch` use the questionnaire widget:

- `↑` / `↓` move through the current question’s options.
- `Enter` selects or confirms the current option.
- `Tab` or `→` moves forward.
- `←` moves backward.
- `Esc` cancels the questionnaire.
- A review screen appears after the final question.

### Free-form input

`question_input` opens an input overlay. Type the answer and press `Enter` to submit, or press `Esc` to cancel. Validation errors remain visible until corrected.

## Managing the extension

These are user-typed Pi slash commands:

```text
/qwizard help
/qwizard status
/qwizard auto-throttle on
/qwizard auto-throttle off
/qwizard auto-throttle 5
/qwizard clear
```

Automatic throttling is enabled by default with a 3-second cooldown. The `question_throttle` tool has its own default cooldown of 5 seconds. Automatic-throttle commands accept cooldowns from 1 through 60 seconds.

## Choosing a tool

- Use `question` for one decision from a list.
- Use `question_input` when the answer is primarily written text.
- Use `questionnaire` for several related questions without conditional visibility.
- Use `question_branch` when later questions depend on earlier answers.
- Use `question_throttle` when repeated selectable prompts need a minimum interval.

## Troubleshooting

### No prompt appears

Question tools require Pi’s interactive TUI. In non-interactive mode, the tool returns an error result with `answer: null` or a cancelled questionnaire result.

### A questionnaire cannot be submitted

Required visible questions must have answers. Optional questions may remain unanswered. In a branching questionnaire, hidden questions are skipped and do not block submission.

### A custom answer is unavailable

For `question` and `question_throttle`, custom text is enabled by default and can be disabled with `allowOther: false`. Questionnaire schemas accept `allowOther` for compatibility, but the current questionnaire widget only renders supplied options; use `question_input` when a questionnaire step needs written text.

### A prompt is delayed

Automatic throttling or `question_throttle` may be enforcing its cooldown. Use `/qwizard status` to inspect automatic settings and `/qwizard clear` to clear the in-memory throttle timestamp.

### Validation rules

Before opening the TUI, QWizard normalizes carriage returns in user-facing text and rejects invalid questionnaire data, including:

- Empty questionnaires
- Duplicate question IDs
- Empty option lists for regular selectable questions
- Duplicate option labels within one question
- Reserved labels such as `Other` and `Type something...`

Generated `yes_no` and `rating` questions provide their own options automatically.

## API documentation

For exact parameters, defaults, supported question types, branching operators, result shapes, lifecycle events, and development commands, see [docs/API.md](docs/API.md).

## License

MIT
