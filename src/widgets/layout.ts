import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { widgetRule } from "./styles.js";

export interface LayoutTheme {
  fg(name: string, value: string): string;
}

export function appendWrapped(lines: string[], text: string, width: number): void {
  lines.push(...wrapTextWithAnsi(text, Math.max(1, width)));
}

export function appendWrappedWithPrefix(
  lines: string[],
  prefix: string,
  text: string,
  width: number,
): void {
  const renderWidth = Math.max(1, width);
  const prefixWidth = visibleWidth(prefix);
  if (prefixWidth >= renderWidth) {
    appendWrapped(lines, prefix + text, renderWidth);
    return;
  }
  const wrapped = wrapTextWithAnsi(text, renderWidth - prefixWidth);
  const continuation = " ".repeat(prefixWidth);
  for (let i = 0; i < wrapped.length; i++) {
    lines.push(`${i === 0 ? prefix : continuation}${wrapped[i]}`);
  }
}

export function beginWidget(theme: LayoutTheme, width: number): string[] {
  return [widgetRule(theme, Math.max(1, width))];
}

export function endWidget(theme: LayoutTheme, width: number, lines: string[]): string[] {
  lines.push(widgetRule(theme, Math.max(1, width)));
  return lines;
}
