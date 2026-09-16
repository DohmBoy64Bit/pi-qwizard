import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";

export function registerRenderers(pi: ExtensionAPI) {
  // Register custom renderer for question results in chat transcript
  pi.registerMessageRenderer("question_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Question] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

  pi.registerMessageRenderer("questionnaire_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Questionnaire] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

  pi.registerMessageRenderer("question_input_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Question Input] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

  pi.registerMessageRenderer("question_throttle_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Question Throttle] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });

  pi.registerMessageRenderer("question_branch_result", (message, options, theme) => {
    const { expanded, outputPad } = options;
    let text = theme.fg("accent", "[Question Branch] ") + message.content;
    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }
    return new Text(text, outputPad, 0);
  });
}
