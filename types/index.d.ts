export type WeekLimit = { percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'weekly-pace': { limit: WeekLimit | null; now: number }
  }
}
