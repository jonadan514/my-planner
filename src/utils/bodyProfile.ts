import type { BodyProfile, UserNutritionTargets } from '../db/database'

export interface RecommendedTargets {
  referenceWeightKg: number
  targets: Pick<
    UserNutritionTargets,
    'proteinMinGrams' | 'proteinMaxGrams' | 'carbohydrateMinGrams' |
    'carbohydrateMaxGrams' | 'vegetableTargetGrams' | 'exerciseMinutes'
  >
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5
}

export function recommendTargets(profile: Pick<
  BodyProfile,
  'heightCm' | 'weightKg' | 'weeklyExerciseSessions' | 'averageDailySteps'
>): RecommendedTargets {
  const heightMeters = profile.heightCm / 100
  const referenceWeightKg = Math.min(profile.weightKg, 25 * heightMeters * heightMeters)
  const isHighlyActive = profile.weeklyExerciseSessions >= 5 || profile.averageDailySteps >= 10_000
  const isModeratelyActive = profile.weeklyExerciseSessions >= 3 || profile.averageDailySteps >= 6_000
  const carbMinMultiplier = isHighlyActive ? 2 : isModeratelyActive ? 1.7 : 1.5
  const carbMaxMultiplier = isHighlyActive ? 2.8 : isModeratelyActive ? 2.4 : 2

  return {
    referenceWeightKg: Math.round(referenceWeightKg * 10) / 10,
    targets: {
      proteinMinGrams: roundToFive(referenceWeightKg * 1.6),
      proteinMaxGrams: roundToFive(referenceWeightKg * 2),
      carbohydrateMinGrams: Math.max(130, roundToFive(referenceWeightKg * carbMinMultiplier)),
      carbohydrateMaxGrams: Math.max(160, roundToFive(referenceWeightKg * carbMaxMultiplier)),
      vegetableTargetGrams: 500,
      exerciseMinutes: 30,
    },
  }
}
