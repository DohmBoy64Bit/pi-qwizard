import { Key } from "@earendil-works/pi-tui";

export interface RegisteredTool {
  name: string;
  execute: (...args: any[]) => Promise<any>;
  [key: string]: any;
}

export function createPiHarness() {
  const tools: RegisteredTool[] = [];
  const handlers = new Map<string, (...args: any[]) => unknown>();
  const emitted: Array<{ name: string; data: unknown }> = [];
  const notifications: string[] = [];
  const sessions: string[] = [];
  const pi = {
    registerTool(tool: RegisteredTool) {
      tools.push(tool);
    },
    registerCommand(name: string, command: any) {
      handlers.set(`command:${name}`, command.handler);
    },
    registerMessageRenderer(name: string, renderer: any) {
      handlers.set(`renderer:${name}`, renderer);
    },
    on(name: string, handler: any) {
      handlers.set(`event:${name}`, handler);
    },
    events: {
      emit(name: string, data: unknown) {
        emitted.push({ name, data });
      },
    },
  } as any;
  const theme = {
    fg: (name: string, value: string) => `<${name}>${value}`,
    bg: (_name: string, value: string) => value,
    bold: (value: string) => value,
  };
  const ctx = {
    mode: "tui",
    ui: {
      notify(message: string) {
        notifications.push(message);
      },
      custom<T>(factory: any): Promise<T> {
        return new Promise<T>((resolve) => {
          const editor = {
            value: "",
            onSubmit: undefined as ((value: string) => void) | undefined,
            handleInput() {},
            getText() {
              return this.value;
            },
            setText(value: string) {
              this.value = value;
            },
            render(width: number) {
              return [this.value.slice(0, width)];
            },
          };
          const component = factory(
            { requestRender() {}, rows: 24, columns: 80, width: 80, height: 24, editor },
            theme,
            {},
            resolve,
          );
          component.render(60);
          (ctx as any).lastComponent = component;
        });
      },
    },
    sessionManager: {
      setSessionName(name: string) {
        sessions.push(name);
      },
    },
  } as any;
  return { pi, tools, handlers, emitted, notifications, sessions, ctx, theme, Key };
}
