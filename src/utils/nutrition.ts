import type {
  MealLog,
  MealPreset,
  MealQualityType,
  NutritionSource,
  NutritionStatus,
} from '../db/database'

export const QUALITY_LABELS: Record<MealQualityType, string> = {
  NORMAL_MEAL: '정상 식사',
  DEFENSIVE_SNACK: '방어간식',
  ULTRA_PROCESSED_SNACK: '초가공 간식',
  SUGARY_DRINK: '당 음료',
  UNCLASSIFIED: '미분류',
}

export const NUTRITION_SOURCE_LABELS: Record<NutritionSource, string> = {
  PRODUCT_LABEL: '제품 라벨',
  USER_DEFINED: '직접 입력',
  STANDARD_ESTIMATE: '표준 추정',
}

export const STATUS_LABELS: Record<NutritionStatus, string> = {
  BELOW: '부족',
  TARGET: '충분',
  ABOVE: '충분 이상',
  NO_TARGET: '기준 설정 필요',
  UNKNOWN: '정보 부족',
}

export function getQualityType(meal: Pick<MealLog, 'qualityType' | 'isDefenseSnack' | 'isUltraProcessed' | 'isPlannedMeal'>): MealQualityType {
  if (meal.qualityType) return meal.qualityType
  if (meal.isDefenseSnack) return 'DEFENSIVE_SNACK'
  if (meal.isUltraProcessed) return 'ULTRA_PROCESSED_SNACK'
  if (meal.isPlannedMeal) return 'NORMAL_MEAL'
  return 'UNCLASSIFIED'
}

export function presetProteinGrams(preset: MealPreset): number {
  return preset.proteinGrams ?? 0
}

export interface FastingInterval {
  startAt: Date
  endAt: Date
  minutes: number
  band: 'UNDER_12H' | 'H12_TO_14' | 'H14_TO_16' | 'H16_PLUS'
}

export function getFastingBand(minutes: number): FastingInterval['band'] {
  if (minutes < 12 * 60) return 'UNDER_12H'
  if (minutes < 14 * 60) return 'H12_TO_14'
  if (minutes < 16 * 60) return 'H14_TO_16'
  return 'H16_PLUS'
}

export function fastingBandLabel(band: FastingInterval['band']): string {
  if (band === 'UNDER_12H') return '12시간 미만'
  if (band === 'H12_TO_14') return '12~14시간'
  if (band === 'H14_TO_16') return '14~16시간'
  return '16시간 이상'
}

function mealTimestamp(meal: MealLog): number | null {
  if (!meal.time) return null
  const value = new Date(`${meal.date}T${meal.time}:00`).getTime()
  return Number.isFinite(value) ? value : null
}

export function getLatestCompletedFastingInterval(meals: MealLog[]): FastingInterval | null {
  const intervals = getCompletedFastingIntervals(meals)
  return intervals.filter(interval => interval.minutes >= 8 * 60).at(-1) ?? intervals.at(-1) ?? null
}

export function getCompletedFastingIntervals(meals: MealLog[]): FastingInterval[] {
  const caloricTimes = meals
    .filter(meal => meal.containsCalories !== false)
    .map(mealTimestamp)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b)

  return caloricTimes.slice(1).map((end, index) => {
    const start = caloricTimes[index]
    const minutes = Math.max(0, Math.floor((end - start) / 60_000))
    return {
      startAt: new Date(start),
      endAt: new Date(end),
      minutes,
      band: getFastingBand(minutes),
    }
  }).filter(interval => interval.minutes >= 8 * 60)
}

export function isPresetAdjusted(preset: MealPreset, values: {
  proteinGrams?: number
  carbohydrateGrams?: number
  vegetableGrams?: number
  qualityType?: MealQualityType
}): boolean {
  return (preset.proteinGrams ?? 0) !== (values.proteinGrams ?? 0)
    || (preset.carbohydrateGrams ?? 0) !== (values.carbohydrateGrams ?? 0)
    || (preset.vegetableGrams ?? 0) !== (values.vegetableGrams ?? 0)
    || (preset.qualityType ?? 'UNCLASSIFIED') !== (values.qualityType ?? 'UNCLASSIFIED')
}
