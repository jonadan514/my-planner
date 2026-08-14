import Dexie, { type Table } from 'dexie'

export interface Event {
  id?: number
  title: string
  date: string        // YYYY-MM-DD
  startTime?: string  // HH:mm
  endTime?: string
  color?: string
  memo?: string
  createdAt: number
}

export interface Todo {
  id?: number
  title: string
  notes?: string
  dueDate?: string    // YYYY-MM-DD
  done: boolean
  priority: 'high' | 'medium' | 'low'
  createdAt: number
}

export interface FastingRecord {
  id?: number
  startTime: number   // timestamp ms
  endTime?: number
  goalHours: number
}

export interface InBodyRecord {
  id?: number
  date: string        // YYYY-MM-DD
  weight?: number     // kg
  muscle?: number     // kg
  bodyFatPct?: number // %
  visceral?: number   // 레벨
  protein?: number    // % (앱마다 단위 다름)
  water?: number      // % (앱마다 단위 다름)
  bmr?: number        // kcal
  bmi?: number
  boneDensity?: number // kg
  createdAt: number
  origin?: DataOrigin
  externalRecordId?: string
  sourcePackage?: string
}

export interface LedgerEntry {
  id?: number
  date: string                    // YYYY-MM-DD
  type: 'income' | 'expense'
  amount: number
  category: string
  memo?: string
  createdAt: number
}

export interface ShiftConfig {
  id?: number
  name: string
  pattern: ShiftDay[]  // ordered cycle
  startDate: string    // YYYY-MM-DD — cycle anchor (day 1)
  holidays?: string[]  // YYYY-MM-DD[] — specific off-days overriding rotation
}

export interface ShiftDay {
  label: string    // e.g. "주간", "야간", "비번", "휴무"
  color: string    // hex
}

export interface WorkoutEntry {
  id?: number
  date: string          // YYYY-MM-DD
  name: string          // e.g. "벤치프레스"
  category: string      // 가슴 | 등 | 하체 | 어깨 | 팔 | 유산소 | 기타
  sets?: number
  reps?: number
  weight?: number       // kg
  duration?: number     // minutes (유산소)
  distance?: number     // km (유산소)
  memo?: string
  createdAt: number
  origin?: DataOrigin
  externalRecordId?: string
  sourcePackage?: string
  startTime?: string
  endTime?: string
  caloriesKcal?: number
  averageHeartRate?: number
}

export type ShiftType = 'day' | 'night' | 'off_after_night' | 'holiday'
export type NeuroWarning = 'none' | 'numbness_increased' | 'leg_pain' | 'weakness_or_foot_drag'

export interface DailySymptoms {
  backPain?: number      // 0-10
  footNumbness?: number  // 0-10
  neuroWarning: NeuroWarning
}

export interface DailyBehavior {
  // 핵심 3개 — 매일 확인
  protein: boolean
  fasting: boolean
  activity: boolean
  // 보조 3개 — 여유 있을 때
  carbs: boolean
  vegetables: boolean
  exercise: boolean
}

export interface DailyHealthLog {
  id?: number
  date: string           // YYYY-MM-DD
  cycleNumber: number
  cycleDay: number       // 0-indexed (0=첫째 주간)
  shiftType: ShiftType
  weightKg?: number
  waistCm?: number
  sleepHours?: number
  symptoms: DailySymptoms
  behaviors: DailyBehavior
  behaviorSources?: Partial<Record<keyof DailyBehavior, 'MANUAL' | 'MEAL_LOG' | 'HEALTH_CONNECT'>>
  score: number
  achieved: boolean
  memo?: string
  createdAt: number
  updatedAt: number
}

export interface BodyConfig {
  id?: number
  cycleStartDate: string  // YYYY-MM-DD (8일 주기 첫 번째 주간근무일)
}

export type MealType = 'lunch' | 'dinner' | 'snack' | 'night_snack' | 'other'
export type ProteinSource =
  | 'chicken_breast' | 'pork_shoulder' | 'pork_neck' | 'beef_chuck'
  | 'tofu_only' | 'tofu_chicken' | 'egg' | 'soy_milk' | 'greek_yogurt' | 'other'
export type CookingMethod = 'shabu' | 'hotpot' | 'steam' | 'water_stir_fry' | 'ready_to_eat' | 'other'
export type NutritionSource = 'PRODUCT_LABEL' | 'USER_DEFINED' | 'STANDARD_ESTIMATE'
export type MealQualityType =
  | 'NORMAL_MEAL'
  | 'DEFENSIVE_SNACK'
  | 'ULTRA_PROCESSED_SNACK'
  | 'SUGARY_DRINK'
  | 'UNCLASSIFIED'
export type NutritionStatus = 'BELOW' | 'TARGET' | 'ABOVE' | 'NO_TARGET' | 'UNKNOWN'
export type DataOrigin = 'MANUAL' | 'HEALTH_CONNECT'
export type HealthDataType = 'EXERCISE' | 'STEPS' | 'SLEEP' | 'WEIGHT' | 'BODY_FAT'
export type HealthSyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'PARTIAL' | 'ERROR' | 'PERMISSION_REQUIRED' | 'UNAVAILABLE'

export interface HealthRecord {
  id?: number
  externalKey?: string
  externalRecordId: string
  sourcePackage?: string
  dataType: HealthDataType
  date: string
  startTime: string
  endTime?: string
  lastModifiedTime?: string
  value?: number
  unit?: string
  durationMinutes?: number
  distanceKm?: number
  caloriesKcal?: number
  averageHeartRate?: number
  createdAt: number
  updatedAt: number
}

export interface HealthSyncState {
  dataType: HealthDataType
  lastSuccessfulSyncAt?: string
  lastRecordCount?: number
  sourcePackages?: string[]
  changeToken?: string
  status: HealthSyncStatus
  errorCode?: string
  updatedAt: number
}

export interface UserNutritionTargets {
  id?: number
  proteinMinGrams: number
  proteinMaxGrams?: number
  carbohydrateMinGrams?: number
  carbohydrateMaxGrams?: number
  vegetableTargetGrams?: number
  exerciseMinutes?: number
  createdAt: number
  updatedAt: number
}

export interface MealLog {
  id?: number
  date: string           // YYYY-MM-DD
  time?: string          // HH:mm
  mealType: MealType
  shiftType: ShiftType
  riceCookedGrams?: number
  vegetableGrams?: number
  proteinSource?: ProteinSource
  proteinRawGrams?: number
  proteinCookedGrams?: number
  proteinGrams?: number
  carbohydrateGrams?: number
  dietaryFiberGrams?: number
  caloriesKcal?: number
  containsCalories?: boolean
  nutritionSource?: NutritionSource
  qualityType?: MealQualityType
  presetId?: number
  userAdjusted?: boolean
  isDefenseSnack: boolean
  isUltraProcessed: boolean
  isPlannedMeal: boolean
  memo?: string
  createdAt: number
  updatedAt: number
}

export interface MealPreset {
  id?: number
  name: string
  mealType?: MealType
  proteinSource?: ProteinSource
  proteinRawGrams?: number
  proteinCookedGrams?: number
  riceCookedGrams?: number
  vegetableGrams?: number
  proteinGrams?: number
  carbohydrateGrams?: number
  dietaryFiberGrams?: number
  caloriesKcal?: number
  containsCalories?: boolean
  nutritionSource?: NutritionSource
  qualityType?: MealQualityType
  favorite?: boolean
  cookingMethod: CookingMethod
  memo?: string
  createdAt: number
  updatedAt?: number
}

export interface WeeklyMeasurement {
  id?: number
  date: string        // YYYY-MM-DD
  weightKg?: number   // kg
  waistCm?: number    // cm
  note?: string
  createdAt: number
  origin?: DataOrigin
  externalRecordId?: string
  sourcePackage?: string
}

export interface DailyMealSummary {
  date: string
  totalRiceCookedGrams: number
  totalVegetableGrams: number
  totalProteinCookedGrams: number   // 기록된 경우에만 합산 (0이면 미기록)
  totalProteinGrams: number
  totalCarbohydrateGrams: number
  totalDietaryFiberGrams: number
  proteinMealCount: number
  defenseSnackCount: number
  ultraProcessedCount: number
  hasLunch: boolean
  hasDinner: boolean
  hasNightSnackAfter1am: boolean
  proteinGoalMet: boolean           // 단백질 2회 이상 (횟수 기준)
  proteinGramsGoalMet: boolean      // 단백질 300g 이상 (g 기준)
  vegetableGoalMet: boolean
  carbRangeMet: boolean
  mealQualityMet: boolean
  fastingGoalMet: boolean           // 01시 이후 야식 없음
  sugaryDrinkCount: number
  normalMealCount: number
  unclassifiedCount: number
  hasEstimatedValues: boolean
  proteinStatus: NutritionStatus
  carbohydrateStatus: NutritionStatus
  vegetableStatus: NutritionStatus
}

function qualityOf(meal: MealLog): MealQualityType {
  if (meal.qualityType) return meal.qualityType
  if (meal.isDefenseSnack) return 'DEFENSIVE_SNACK'
  if (meal.isUltraProcessed) return 'ULTRA_PROCESSED_SNACK'
  if (meal.isPlannedMeal) return 'NORMAL_MEAL'
  return 'UNCLASSIFIED'
}

function bandStatus(value: number, min?: number, max?: number): NutritionStatus {
  if (min == null) return 'NO_TARGET'
  if (value < min) return 'BELOW'
  if (max != null && value > max) return 'ABOVE'
  return 'TARGET'
}

export function summarizeMeals(
  meals: MealLog[],
  targets?: UserNutritionTargets | null,
): DailyMealSummary | null {
  if (meals.length === 0) return null
  const totalRice         = meals.reduce((s, m) => s + (m.riceCookedGrams ?? 0), 0)
  const totalVeg          = meals.reduce((s, m) => s + (m.vegetableGrams ?? 0), 0)
  const totalProteinCook  = meals.reduce((s, m) => s + (m.proteinCookedGrams ?? 0), 0)
  const totalProtein      = meals.reduce((s, m) => s + (m.proteinGrams ?? 0), 0)
  const totalCarbs        = meals.reduce((s, m) => s + (m.carbohydrateGrams ?? 0), 0)
  const totalFiber        = meals.reduce((s, m) => s + (m.dietaryFiberGrams ?? 0), 0)
  const proteinMeals      = meals.filter(m => m.proteinSource || m.proteinRawGrams || m.proteinCookedGrams).length
  const defenseSnacks     = meals.filter(m => m.isDefenseSnack).length
  const ultraProcessed    = meals.filter(m => m.isUltraProcessed).length
  const nightAfter1am     = meals.some(m => m.mealType === 'night_snack' && !!m.time && m.time >= '01:00')
  const qualities         = meals.map(qualityOf)
  const proteinStatus     = bandStatus(totalProtein, targets?.proteinMinGrams, targets?.proteinMaxGrams)
  const carbohydrateStatus = bandStatus(totalCarbs, targets?.carbohydrateMinGrams, targets?.carbohydrateMaxGrams)
  const vegetableStatus   = targets?.vegetableTargetGrams == null
    ? 'NO_TARGET'
    : totalVeg >= targets.vegetableTargetGrams ? 'TARGET' : 'BELOW'
  return {
    date: meals[0].date,
    totalRiceCookedGrams:    totalRice,
    totalVegetableGrams:     totalVeg,
    totalProteinCookedGrams: totalProteinCook,
    totalProteinGrams:       totalProtein,
    totalCarbohydrateGrams:  totalCarbs,
    totalDietaryFiberGrams:  totalFiber,
    proteinMealCount:        proteinMeals,
    defenseSnackCount:       defenseSnacks,
    ultraProcessedCount:     ultraProcessed,
    hasLunch:   meals.some(m => m.mealType === 'lunch'),
    hasDinner:  meals.some(m => m.mealType === 'dinner'),
    hasNightSnackAfter1am: nightAfter1am,
    proteinGoalMet:      targets ? proteinStatus === 'TARGET' || proteinStatus === 'ABOVE' : proteinMeals >= 2,
    proteinGramsGoalMet: targets ? proteinStatus === 'TARGET' || proteinStatus === 'ABOVE' : false,
    vegetableGoalMet:    targets?.vegetableTargetGrams != null ? vegetableStatus === 'TARGET' : false,
    carbRangeMet:        targets?.carbohydrateMinGrams != null ? carbohydrateStatus === 'TARGET' : false,
    mealQualityMet:      ultraProcessed === 0,
    fastingGoalMet:      !nightAfter1am,
    sugaryDrinkCount:    qualities.filter(q => q === 'SUGARY_DRINK').length,
    normalMealCount:     qualities.filter(q => q === 'NORMAL_MEAL').length,
    unclassifiedCount:   qualities.filter(q => q === 'UNCLASSIFIED').length,
    hasEstimatedValues:  meals.some(m => m.nutritionSource === 'STANDARD_ESTIMATE'),
    proteinStatus,
    carbohydrateStatus,
    vegetableStatus,
  }
}

export class PlannerDB extends Dexie {
  events!: Table<Event>
  todos!: Table<Todo>
  fastingRecords!: Table<FastingRecord>
  inBodyRecords!: Table<InBodyRecord>
  shiftConfigs!: Table<ShiftConfig>
  ledger!: Table<LedgerEntry>
  workoutLogs!: Table<WorkoutEntry>
  bodyConfigs!: Table<BodyConfig>
  dailyHealthLogs!: Table<DailyHealthLog>
  mealLogs!: Table<MealLog>
  mealPresets!: Table<MealPreset>
  weeklyMeasurements!: Table<WeeklyMeasurement>
  nutritionTargets!: Table<UserNutritionTargets>
  healthRecords!: Table<HealthRecord>
  healthSyncStates!: Table<HealthSyncState>

  constructor() {
    super('plannerDB')
    this.version(1).stores({
      events: '++id, date, createdAt',
      todos: '++id, dueDate, done, createdAt',
      fastingRecords: '++id, startTime',
      inBodyRecords: '++id, date, createdAt',
      shiftConfigs: '++id',
    })
    this.version(2).stores({
      events: '++id, date, createdAt',
      todos: '++id, dueDate, done, createdAt',
      fastingRecords: '++id, startTime',
      inBodyRecords: '++id, date, createdAt',
      shiftConfigs: '++id',
      ledger: '++id, date, type, createdAt',
    })
    this.version(3).stores({
      events: '++id, date, createdAt',
      todos: '++id, dueDate, done, createdAt',
      fastingRecords: '++id, startTime',
      inBodyRecords: '++id, date, createdAt',
      shiftConfigs: '++id',
      ledger: '++id, date, type, createdAt',
      workoutLogs: '++id, date, name, category, createdAt',
    })
    this.version(4).stores({
      events: '++id, date, createdAt',
      todos: '++id, dueDate, done, createdAt',
      fastingRecords: '++id, startTime',
      inBodyRecords: '++id, date, createdAt',
      shiftConfigs: '++id',
      ledger: '++id, date, type, createdAt',
      workoutLogs: '++id, date, name, category, createdAt',
      bodyConfigs: '++id',
      dailyHealthLogs: '++id, date, createdAt',
    })
    this.version(5).stores({
      events: '++id, date, createdAt',
      todos: '++id, dueDate, done, createdAt',
      fastingRecords: '++id, startTime',
      inBodyRecords: '++id, date, createdAt',
      shiftConfigs: '++id',
      ledger: '++id, date, type, createdAt',
      workoutLogs: '++id, date, name, category, createdAt',
      bodyConfigs: '++id',
      dailyHealthLogs: '++id, date, createdAt',
      mealLogs: '++id, date, createdAt',
      mealPresets: '++id, name, createdAt',
    })
    this.version(6).stores({
      events: '++id, date, createdAt',
      todos: '++id, dueDate, done, createdAt',
      fastingRecords: '++id, startTime',
      inBodyRecords: '++id, date, createdAt',
      shiftConfigs: '++id',
      ledger: '++id, date, type, createdAt',
      workoutLogs: '++id, date, name, category, createdAt',
      bodyConfigs: '++id',
      dailyHealthLogs: '++id, date, createdAt',
      mealLogs: '++id, date, createdAt',
      mealPresets: '++id, name, createdAt',
      weeklyMeasurements: '++id, date, createdAt',
    })
    this.version(7).stores({
      events: '++id, date, createdAt',
      todos: '++id, dueDate, done, createdAt',
      fastingRecords: '++id, startTime',
      inBodyRecords: '++id, date, createdAt',
      shiftConfigs: '++id',
      ledger: '++id, date, type, createdAt',
      workoutLogs: '++id, date, name, category, createdAt',
      bodyConfigs: '++id',
      dailyHealthLogs: '++id, date, createdAt',
      mealLogs: '++id, date, qualityType, presetId, createdAt',
      mealPresets: '++id, name, favorite, createdAt',
      weeklyMeasurements: '++id, date, createdAt',
      nutritionTargets: '++id, updatedAt',
    })
    this.version(8).stores({
      events: '++id, date, createdAt',
      todos: '++id, dueDate, done, createdAt',
      fastingRecords: '++id, startTime',
      inBodyRecords: '++id, date, externalRecordId, createdAt',
      shiftConfigs: '++id',
      ledger: '++id, date, type, createdAt',
      workoutLogs: '++id, date, name, category, externalRecordId, origin, createdAt',
      bodyConfigs: '++id',
      dailyHealthLogs: '++id, date, createdAt',
      mealLogs: '++id, date, qualityType, presetId, createdAt',
      mealPresets: '++id, name, favorite, createdAt',
      weeklyMeasurements: '++id, date, externalRecordId, origin, createdAt',
      nutritionTargets: '++id, updatedAt',
      healthRecords: '++id, &externalKey, externalRecordId, dataType, date, startTime, updatedAt',
      healthSyncStates: '&dataType, status, updatedAt',
    })
  }
}

export const db = new PlannerDB()
