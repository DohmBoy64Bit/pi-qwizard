export interface WidgetTheme {
  fg(name: string, value: string): string;
}

export function widgetRule(theme: WidgetTheme, width: number): string {
  return theme.fg("accent", "─".repeat(Math.max(1, width)));
}

export function widgetHint(theme: WidgetTheme, text: string): string {
  return theme.fg("dim", text);
}
