export interface AutoThrottleSettings {
  enabled: boolean;
  cooldown: number;
}

export const autoThrottleSettings: AutoThrottleSettings = { enabled: true, cooldown: 3 };
