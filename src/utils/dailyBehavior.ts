import type { DailyBehavior } from '../db/database'

export const DAILY_BEHAVIOR_KEYS = ['protein', 'carbs', 'vegetables', 'exercise', 'fasting'] as const
export type BehaviorSource = 'MANUAL' | 'MEAL_LOG' | 'HEALTH_CONNECT'

export function scoreDailyBehaviors(behaviors: DailyBehavior): number {
  return DAILY_BEHAVIOR_KEYS.filter(key => behaviors[key]).length
}

export function mergeAutomaticBehaviors(
  existing: DailyBehavior | undefined,
  existingSources: Partial<Record<keyof DailyBehavior, BehaviorSource>> | undefined,
  automatic: DailyBehavior,
  automaticSources: Partial<Record<keyof DailyBehavior, BehaviorSource>>,
): { behaviors: DailyBehavior; sources: Partial<Record<keyof DailyBehavior, BehaviorSource>> } {
  const behaviors = { ...automatic }
  const sources = { ...automaticSources }
  if (!existing) return { behaviors, sources }

  for (const key of DAILY_BEHAVIOR_KEYS) {
    if (existingSources?.[key] === 'MANUAL') {
      behaviors[key] = existing[key]
      sources[key] = 'MANUAL'
    }
  }
  return { behaviors, sources }
}
