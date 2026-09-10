// Stub type declarations for peer dependencies not available on npm
declare module "@earendil-works/pi-coding-agent" {
  export interface ToolExecuteContext {
    mode: string;
    ui: {
      custom<T>(
        factory: (...args: any[]) => void,
        options?: { overlay?: boolean },
      ): Promise<T>;
    };
    sessionManager: { setSessionName(name: string): void };
  }

  export interface ToolDefinition {
    name: string;
    label: string;
    description: string;
    promptSnippet?: string;
    promptGuidelines?: string[];
    parameters: unknown;
    executionMode: string;
    prepareArguments?: (args: unknown) => unknown;
    execute: (
      toolCallId: string,
      params: any,
      signal: unknown,
      onUpdate: unknown,
      ctx: ToolExecuteContext,
    ) => Promise<unknown>;
    renderCall?: (args: any, theme: any, context: any) => any;
    renderResult?: (result: any, options: any, theme: any, context: any) => any;
  }

  export interface ExtensionAPI {
    registerTool(tool: ToolDefinition): void;
    registerMessageRenderer(name: string, renderer: (...args: any[]) => any): void;
    registerCommand(name: string, command: unknown): void;
    on(event: string, handler: (...args: any[]) => void): void;
    events: { emit(event: string, data: unknown): void };
  }
  export function keyHint(key: string, label: string): string;
}

declare module "@earendil-works/pi-tui" {
  export interface EditorTheme {
    borderColor: (s: string) => string;
    selectList: {
      selectedPrefix: (t: string) => string;
      selectedText: (t: string) => string;
      description: (t: string) => string;
      scrollInfo: (t: string) => string;
      noMatch: (t: string) => string;
    };
  }
  export class Editor {
    constructor(tui: any, theme: EditorTheme);
    handleInput(data: string): void;
    render(width: number): string[];
    getText(): string;
    setText(text: string): void;
    onSubmit?: (value: string) => void;
  }
  export const Key: {
    up: string;
    down: string;
    enter: string;
    escape: string;
    tab: string;
    left: string;
    right: string;
    shift(key: string): string;
  };
  export function matchesKey(data: string, key: string): boolean;
  export class Text {
    constructor(text: string, pad: number, offset: number);
  }
  export function visibleWidth(text: string): number;
  export function wrapTextWithAnsi(text: string, width: number): string[];
}

declare module "@earendil-works/pi-ai" {
  export function StringEnum(values: readonly string[]): unknown;
}

declare module "typebox" {
  export const Type: {
    Object(properties: Record<string, unknown>, options?: unknown): unknown;
    String(options?: unknown): unknown;
    Number(options?: unknown): unknown;
    Boolean(options?: unknown): unknown;
    Array(items: unknown, options?: unknown): unknown;
    Optional(schema: unknown, options?: unknown): unknown;
  };
}
