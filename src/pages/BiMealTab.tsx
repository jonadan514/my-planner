import { useState, useEffect, useCallback } from 'react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { db, summarizeMeals } from '../db/database'
import type {
  DailyMealSummary, MealLog, MealPreset, MealType, ProteinSource, CookingMethod, ShiftType,
  MealQualityType, NutritionSource, UserNutritionTargets,
} from '../db/database'
import NutritionTargetsSheet from '../components/NutritionTargetsSheet'
import {
  NUTRITION_SOURCE_LABELS,
  QUALITY_LABELS,
  getQualityType,
  isPresetAdjusted,
} from '../utils/nutrition'

// ─── Constants ───────────────────────────────────────────────────────────────

const SHIFT_PATTERN: ShiftType[] = [
  'day', 'day', 'night', 'off_after_night', 'holiday', 'night', 'off_after_night', 'holiday',
]

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  lunch: '점심', dinner: '저녁', snack: '간식', night_snack: '야간간식', other: '기타',
}

const PROTEIN_SOURCE_LABELS: Record<ProteinSource, string> = {
  chicken_breast: '닭가슴살',
  pork_shoulder:  '돼지 앞다리살',
  pork_neck:      '돼지 목살',
  beef_chuck:     '쇠고기 목살',
  tofu_only:      '두부 단독',
  tofu_chicken:   '두부+닭',
  egg:            '달걀',
  soy_milk:       '두유',
  greek_yogurt:   '그릭요거트',
  other:          '기타',
}

const COOKING_METHOD_LABELS: Record<CookingMethod, string> = {
  shabu:          '샤부샤부',
  hotpot:         '전골',
  steam:          '찜',
  water_stir_fry: '물볶음',
  ready_to_eat:   '즉석식',
  other:          '기타',
}

const MEAL_TYPES:       MealType[]      = ['lunch', 'dinner', 'snack', 'night_snack', 'other']
const PROTEIN_SOURCES:  ProteinSource[] = ['chicken_breast', 'pork_shoulder', 'pork_neck', 'beef_chuck', 'tofu_only', 'tofu_chicken', 'egg', 'soy_milk', 'greek_yogurt', 'other']
const COOKING_METHODS:  CookingMethod[] = ['shabu', 'hotpot', 'steam', 'water_stir_fry', 'ready_to_eat', 'other']
const QUALITY_TYPES: MealQualityType[] = [
  'NORMAL_MEAL', 'DEFENSIVE_SNACK', 'ULTRA_PROCESSED_SNACK', 'SUGARY_DRINK', 'UNCLASSIFIED',
]
const NUTRITION_SOURCES: NutritionSource[] = ['PRODUCT_LABEL', 'USER_DEFINED', 'STANDARD_ESTIMATE']

// ─── Summary Helper Components ────────────────────────────────────────────────

function GoalBar({ label, note, current, target, unit, met }: {
  label: string; note: string; current: number; target: number; unit: string; met: boolean;
}) {
  const pct = Math.min((current / target) * 100, 100)
  const remaining = Math.max(0, target - current)
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-semibold text-gray-900 shrink-0">{label}</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
            목표 {target}{unit} {note}
          </span>
        </div>
        <span className={`text-sm font-bold tabular-nums shrink-0 ${met ? 'text-emerald-500' : 'text-gray-900'}`}>
          {current}<span className="text-xs font-normal text-gray-400">{unit}</span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${met ? 'bg-emerald-500' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-[11px] mt-1 font-medium ${met ? 'text-emerald-500' : 'text-amber-500'}`}>
        {met ? '✓ 목표 달성' : `↓ ${remaining}${unit} 더 필요`}
      </p>
    </div>
  )
}

function RiceBar({ rice }: { rice: number }) {
  const SCALE = 300
  const inRange = rice >= 220 && rice <= 250
  const status = rice === 0 ? 'none' : inRange ? 'ok' : rice < 220 ? 'under' : 'over'
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-900">밥</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
            목표 220~250g 조리 후
          </span>
        </div>
        <span className={`text-sm font-bold tabular-nums ${
          status === 'ok' ? 'text-emerald-500' : status === 'none' ? 'text-gray-300' : 'text-amber-500'
        }`}>
          {rice > 0 ? `${rice}g` : '—'}
        </span>
      </div>
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        {/* 목표 범위 (220~250g) */}
        <div
          className="absolute h-full bg-emerald-100"
          style={{ left: `${(220 / SCALE) * 100}%`, width: `${(30 / SCALE) * 100}%` }}
        />
        {rice > 0 && (
          <div
            className={`absolute left-0 h-full rounded-full ${inRange ? 'bg-emerald-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min((rice / SCALE) * 100, 100)}%` }}
          />
        )}
      </div>
      <p className={`text-[11px] mt-1 font-medium ${
        status === 'ok' ? 'text-emerald-500' : status === 'none' ? 'text-gray-300' : 'text-amber-500'
      }`}>
        {status === 'ok'    && '✓ 범위 내'}
        {status === 'under' && `↓ ${220 - rice}g 미달 (220g 이상 권장)`}
        {status === 'over'  && `↑ ${rice - 250}g 초과 (250g 이하 권장, 운동날 300g 허용)`}
        {status === 'none'  && '기록 없음'}
      </p>
    </div>
  )
}

function getShiftForDate(cycleStartDate: string, dateStr: string): ShiftType {
  const diff = differenceInDays(parseISO(dateStr), parseISO(cycleStartDate))
  const idx = ((diff % 8) + 8) % 8
  return SHIFT_PATTERN[idx]
}

// ─── Meal Add Bottom Sheet ────────────────────────────────────────────────────

interface MealForm {
  mealType: MealType
  time: string
  proteinSource: ProteinSource | ''
  proteinRawGrams: string
  proteinCookedGrams: string
  riceCookedGrams: string
  vegetableGrams: string
  proteinGrams: string
  carbohydrateGrams: string
  dietaryFiberGrams: string
  caloriesKcal: string
  containsCalories: boolean
  nutritionSource: NutritionSource
  qualityType: MealQualityType
  isDefenseSnack: boolean
  isUltraProcessed: boolean
  isPlannedMeal: boolean
  memo: string
}

const DEFAULT_FORM: MealForm = {
  mealType: 'lunch', time: '', proteinSource: '',
  proteinRawGrams: '', proteinCookedGrams: '',
  riceCookedGrams: '', vegetableGrams: '',
  proteinGrams: '', carbohydrateGrams: '', dietaryFiberGrams: '', caloriesKcal: '',
  containsCalories: true, nutritionSource: 'USER_DEFINED', qualityType: 'NORMAL_MEAL',
  isDefenseSnack: false, isUltraProcessed: false, isPlannedMeal: true, memo: '',
}

interface MealAddSheetProps {
  date: string
  shiftType: ShiftType
  presets: MealPreset[]
  currentSummary: DailyMealSummary | null
  targets: UserNutritionTargets | null
  initial?: MealLog
  onSave: () => void
  onClose: () => void
}

function MealAddSheet({ date, shiftType, presets, currentSummary, targets, initial, onSave, onClose }: MealAddSheetProps) {
  const [form, setForm] = useState<MealForm>(() => initial ? {
    mealType: initial.mealType,
    time: initial.time ?? '',
    proteinSource: initial.proteinSource ?? '',
    proteinRawGrams: initial.proteinRawGrams?.toString() ?? '',
    proteinCookedGrams: initial.proteinCookedGrams?.toString() ?? '',
    riceCookedGrams: initial.riceCookedGrams?.toString() ?? '',
    vegetableGrams: initial.vegetableGrams?.toString() ?? '',
    proteinGrams: initial.proteinGrams?.toString() ?? '',
    carbohydrateGrams: initial.carbohydrateGrams?.toString() ?? '',
    dietaryFiberGrams: initial.dietaryFiberGrams?.toString() ?? '',
    caloriesKcal: initial.caloriesKcal?.toString() ?? '',
    containsCalories: initial.containsCalories ?? true,
    nutritionSource: initial.nutritionSource ?? 'USER_DEFINED',
    qualityType: initial.qualityType ?? getQualityType(initial),
    isDefenseSnack: initial.isDefenseSnack,
    isUltraProcessed: initial.isUltraProcessed,
    isPlannedMeal: initial.isPlannedMeal,
    memo: initial.memo ?? '',
  } : { ...DEFAULT_FORM })
  const [selectedPreset, setSelectedPreset] = useState<MealPreset | null>(() => presets.find(preset => preset.id === initial?.presetId) ?? null)
  const [saveBackToPreset, setSaveBackToPreset] = useState(false)
  const set = <K extends keyof MealForm>(k: K, v: MealForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const applyPreset = (p: MealPreset) => {
    setSelectedPreset(p)
    setSaveBackToPreset(false)
    setForm(prev => ({
      ...prev,
      mealType: p.mealType ?? prev.mealType,
      proteinSource: p.proteinSource ?? '',
      proteinRawGrams: p.proteinRawGrams?.toString() ?? '',
      proteinCookedGrams: p.proteinCookedGrams?.toString() ?? '',
      riceCookedGrams: p.riceCookedGrams?.toString() ?? '',
      vegetableGrams: p.vegetableGrams?.toString() ?? '',
      proteinGrams: p.proteinGrams?.toString() ?? '',
      carbohydrateGrams: p.carbohydrateGrams?.toString() ?? '',
      dietaryFiberGrams: p.dietaryFiberGrams?.toString() ?? '',
      caloriesKcal: p.caloriesKcal?.toString() ?? '',
      containsCalories: p.containsCalories ?? true,
      nutritionSource: p.nutritionSource ?? 'USER_DEFINED',
      qualityType: p.qualityType ?? 'UNCLASSIFIED',
      isDefenseSnack: p.qualityType === 'DEFENSIVE_SNACK',
      isUltraProcessed: p.qualityType === 'ULTRA_PROCESSED_SNACK',
    }))
  }

  const save = async () => {
    const now = Date.now()
    const log: MealLog = {
      id: initial?.id,
      date,
      time: form.time || undefined,
      mealType: form.mealType,
      shiftType,
      proteinSource: (form.proteinSource || undefined) as ProteinSource | undefined,
      proteinRawGrams: form.proteinRawGrams ? Number(form.proteinRawGrams) : undefined,
      proteinCookedGrams: form.proteinCookedGrams ? Number(form.proteinCookedGrams) : undefined,
      riceCookedGrams: form.riceCookedGrams ? Number(form.riceCookedGrams) : undefined,
      vegetableGrams: form.vegetableGrams ? Number(form.vegetableGrams) : undefined,
      proteinGrams: form.proteinGrams ? Number(form.proteinGrams) : undefined,
      carbohydrateGrams: form.carbohydrateGrams ? Number(form.carbohydrateGrams) : undefined,
      dietaryFiberGrams: form.dietaryFiberGrams ? Number(form.dietaryFiberGrams) : undefined,
      caloriesKcal: form.caloriesKcal ? Number(form.caloriesKcal) : undefined,
      containsCalories: form.containsCalories,
      nutritionSource: form.nutritionSource,
      qualityType: form.qualityType,
      presetId: selectedPreset?.id,
      userAdjusted: selectedPreset ? isPresetAdjusted(selectedPreset, {
        proteinGrams: form.proteinGrams ? Number(form.proteinGrams) : undefined,
        carbohydrateGrams: form.carbohydrateGrams ? Number(form.carbohydrateGrams) : undefined,
        vegetableGrams: form.vegetableGrams ? Number(form.vegetableGrams) : undefined,
        qualityType: form.qualityType,
      }) : false,
      isDefenseSnack: form.qualityType === 'DEFENSIVE_SNACK',
      isUltraProcessed: form.qualityType === 'ULTRA_PROCESSED_SNACK',
      isPlannedMeal: form.isPlannedMeal,
      memo: form.memo.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    }
    if (selectedPreset?.id && saveBackToPreset) {
      await db.mealPresets.update(selectedPreset.id, {
        proteinGrams: log.proteinGrams,
        carbohydrateGrams: log.carbohydrateGrams,
        dietaryFiberGrams: log.dietaryFiberGrams,
        vegetableGrams: log.vegetableGrams,
        caloriesKcal: log.caloriesKcal,
        containsCalories: log.containsCalories,
        nutritionSource: log.nutritionSource,
        qualityType: log.qualityType,
        updatedAt: now,
      })
    }
    if (initial?.id) await db.mealLogs.put(log)
    else await db.mealLogs.add(log)
    onSave()
    onClose()
  }

  const projectedProtein = (currentSummary?.totalProteinGrams ?? 0) + (Number(form.proteinGrams) || 0)
  const reachesMinimum = targets != null
    && (currentSummary?.totalProteinGrams ?? 0) < targets.proteinMinGrams
    && projectedProtein >= targets.proteinMinGrams

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto modal-sheet border-t border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{initial ? '식사 수정' : '식사 추가'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 text-2xl">✕</button>
        </div>

        {/* 식사 유형 */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">식사 유형</label>
          <div className="flex gap-1.5 flex-wrap">
            {MEAL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => set('mealType', t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  form.mealType === t ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {MEAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* 프리셋 빠른 적용 */}
        {presets.length > 0 && (
          <div>
            <label className="text-xs text-gray-400 block mb-2">프리셋 불러오기 · 선택 전 예상</label>
            <div className="space-y-2">
              {presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className={`w-full px-3 py-2.5 rounded-xl text-left border ${
                    selectedPreset?.id === p.id
                      ? 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30'
                      : 'bg-gray-50 text-gray-600 border-gray-100'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{p.favorite ? '★ ' : ''}{p.name}</span>
                    <span className="text-[11px] shrink-0">단백질 {p.proteinGrams ?? '—'}g</span>
                  </span>
                  {p.proteinGrams != null && (
                    <span className="block text-[10px] mt-1 text-gray-400">
                      현재 {currentSummary?.totalProteinGrams ?? 0}g → 추가 후 {(currentSummary?.totalProteinGrams ?? 0) + p.proteinGrams}g
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPreset && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
            <p className="text-xs font-semibold text-indigo-700">{selectedPreset.name} 적용됨</p>
            <p className="text-[11px] text-indigo-500 mt-0.5">아래 실제 섭취량을 바꿔도 이 기록에만 반영됩니다.</p>
          </div>
        )}

        {/* 단백질원 */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">단백질원 (선택)</label>
          <div className="flex gap-1.5 flex-wrap">
            {PROTEIN_SOURCES.map(s => (
              <button
                key={s}
                onClick={() => set('proteinSource', form.proteinSource === s ? '' : s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.proteinSource === s ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {PROTEIN_SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* 단백질 중량 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">단백질 조리 전 (g)</label>
            <input
              type="number" inputMode="decimal"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              placeholder="—" value={form.proteinRawGrams}
              onChange={e => set('proteinRawGrams', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">단백질 조리 후 (g)</label>
            <input
              type="number" inputMode="decimal"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              placeholder="—" value={form.proteinCookedGrams}
              onChange={e => set('proteinCookedGrams', e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 p-3 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-700">실제 영양정보</p>
            <p className="text-[10px] text-gray-400 mt-0.5">식재료 중량과 실제 단백질 g은 다른 값입니다.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['proteinGrams', '단백질 (g)'],
              ['carbohydrateGrams', '탄수화물 (g)'],
              ['dietaryFiberGrams', '식이섬유 (g)'],
              ['caloriesKcal', '열량 (kcal)'],
            ] as Array<[keyof MealForm, string]>).map(([key, label]) => (
              <label key={key} className="text-xs text-gray-400">
                {label}
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={String(form[key])}
                  onChange={event => set(key, event.target.value)}
                  className="mt-1 w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none"
                />
              </label>
            ))}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1.5">영양정보 출처</p>
            <div className="flex gap-1.5 flex-wrap">
              {NUTRITION_SOURCES.map(source => (
                <button key={source} onClick={() => set('nutritionSource', source)} className={`px-2.5 py-1.5 rounded-lg text-xs ${form.nutritionSource === source ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {NUTRITION_SOURCE_LABELS[source]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">식사 품질 분류</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUALITY_TYPES.map(quality => (
              <button key={quality} onClick={() => set('qualityType', quality)} className={`px-2.5 py-2 rounded-lg text-xs ${form.qualityType === quality ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {QUALITY_LABELS[quality]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => set('containsCalories', !form.containsCalories)}
          className={`w-full px-3 py-2 rounded-xl text-xs border ${form.containsCalories ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-sky-50 border-sky-200 text-sky-700'}`}
        >
          {form.containsCalories ? '열량 섭취 · 공복 종료에 반영' : '무열량 · 공복 유지'}
        </button>

        {form.proteinGrams && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-emerald-700">단백질 예상 누적 {projectedProtein}g</p>
            {reachesMinimum ? <p className="text-[11px] font-semibold text-emerald-600 mt-1">이 식사를 추가하면 오늘 최소 목표에 도달합니다.</p> : null}
          </div>
        )}

        {selectedPreset && (
          <button onClick={() => setSaveBackToPreset(value => !value)} className="flex items-center gap-2 text-xs text-gray-500">
            <span className={`w-4 h-4 rounded flex items-center justify-center ${saveBackToPreset ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>{saveBackToPreset ? '✓' : ''}</span>
            수정한 값을 프리셋에도 저장
          </button>
        )}

        {/* 밥 + 채소 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">밥 조리 후 (g)</label>
            <input
              type="number" inputMode="decimal"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              placeholder="—" value={form.riceCookedGrams}
              onChange={e => set('riceCookedGrams', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">채소 (g)</label>
            <input
              type="number" inputMode="decimal"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              placeholder="—" value={form.vegetableGrams}
              onChange={e => set('vegetableGrams', e.target.value)}
            />
          </div>
        </div>

        {/* 시간 */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">시간 (선택)</label>
          <input
            type="time"
            className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
            value={form.time}
            onChange={e => set('time', e.target.value)}
          />
        </div>

        <button
          onClick={() => set('isPlannedMeal', !form.isPlannedMeal)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border ${
            form.isPlannedMeal ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-400'
          }`}
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${form.isPlannedMeal ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}>
            {form.isPlannedMeal ? '✓' : ''}
          </span>
          계획한 식사
        </button>

        {/* 메모 */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">메모 (선택)</label>
          <input
            type="text"
            className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm"
            placeholder="특이사항..."
            value={form.memo}
            onChange={e => set('memo', e.target.value)}
          />
        </div>

        <button
          onClick={save}
          className="w-full py-3.5 rounded-xl bg-indigo-500 text-white font-semibold active:bg-indigo-600"
        >
          저장
        </button>
      </div>
    </div>
  )
}

// ─── Preset Form Bottom Sheet ─────────────────────────────────────────────────

interface PresetForm {
  name: string
  mealType: MealType | ''
  proteinSource: ProteinSource | ''
  proteinRawGrams: string
  proteinCookedGrams: string
  riceCookedGrams: string
  vegetableGrams: string
  proteinGrams: string
  carbohydrateGrams: string
  dietaryFiberGrams: string
  caloriesKcal: string
  containsCalories: boolean
  nutritionSource: NutritionSource
  qualityType: MealQualityType
  favorite: boolean
  cookingMethod: CookingMethod
  memo: string
}

const DEFAULT_PRESET_FORM: PresetForm = {
  name: '', mealType: '', proteinSource: '',
  proteinRawGrams: '', proteinCookedGrams: '',
  riceCookedGrams: '', vegetableGrams: '',
  proteinGrams: '', carbohydrateGrams: '', dietaryFiberGrams: '', caloriesKcal: '',
  containsCalories: true, nutritionSource: 'USER_DEFINED', qualityType: 'NORMAL_MEAL', favorite: false,
  cookingMethod: 'steam', memo: '',
}

interface PresetSheetProps {
  initial?: MealPreset
  onSave: () => void
  onClose: () => void
}

function PresetSheet({ initial, onSave, onClose }: PresetSheetProps) {
  const [form, setForm] = useState<PresetForm>(
    initial
      ? {
          name:               initial.name,
          mealType:           initial.mealType ?? '',
          proteinSource:      initial.proteinSource ?? '',
          proteinRawGrams:    initial.proteinRawGrams?.toString() ?? '',
          proteinCookedGrams: initial.proteinCookedGrams?.toString() ?? '',
          riceCookedGrams:    initial.riceCookedGrams?.toString() ?? '',
          vegetableGrams:     initial.vegetableGrams?.toString() ?? '',
          proteinGrams:       initial.proteinGrams?.toString() ?? '',
          carbohydrateGrams:  initial.carbohydrateGrams?.toString() ?? '',
          dietaryFiberGrams:  initial.dietaryFiberGrams?.toString() ?? '',
          caloriesKcal:       initial.caloriesKcal?.toString() ?? '',
          containsCalories:   initial.containsCalories ?? true,
          nutritionSource:    initial.nutritionSource ?? 'USER_DEFINED',
          qualityType:        initial.qualityType ?? 'UNCLASSIFIED',
          favorite:           initial.favorite ?? false,
          cookingMethod:      initial.cookingMethod,
          memo:               initial.memo ?? '',
        }
      : { ...DEFAULT_PRESET_FORM }
  )
  const set = <K extends keyof PresetForm>(k: K, v: PresetForm[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return
    const preset: MealPreset = {
      name: form.name.trim(),
      mealType: (form.mealType || undefined) as MealType | undefined,
      proteinSource: (form.proteinSource || undefined) as ProteinSource | undefined,
      proteinRawGrams: form.proteinRawGrams ? Number(form.proteinRawGrams) : undefined,
      proteinCookedGrams: form.proteinCookedGrams ? Number(form.proteinCookedGrams) : undefined,
      riceCookedGrams: form.riceCookedGrams ? Number(form.riceCookedGrams) : undefined,
      vegetableGrams: form.vegetableGrams ? Number(form.vegetableGrams) : undefined,
      proteinGrams: form.proteinGrams ? Number(form.proteinGrams) : undefined,
      carbohydrateGrams: form.carbohydrateGrams ? Number(form.carbohydrateGrams) : undefined,
      dietaryFiberGrams: form.dietaryFiberGrams ? Number(form.dietaryFiberGrams) : undefined,
      caloriesKcal: form.caloriesKcal ? Number(form.caloriesKcal) : undefined,
      containsCalories: form.containsCalories,
      nutritionSource: form.nutritionSource,
      qualityType: form.qualityType,
      favorite: form.favorite,
      cookingMethod: form.cookingMethod,
      memo: form.memo.trim() || undefined,
      createdAt: initial?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    if (initial?.id) await db.mealPresets.put({ ...preset, id: initial.id })
    else await db.mealPresets.add(preset)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto modal-sheet border-t border-gray-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{initial ? '프리셋 수정' : '프리셋 추가'}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 text-2xl">✕</button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">프리셋 이름 *</label>
          <input
            autoFocus
            className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm focus:ring-1 ring-indigo-500"
            placeholder="예: 닭가슴살 식단"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">식사 유형 (선택)</label>
          <div className="flex gap-1.5 flex-wrap">
            {MEAL_TYPES.map(t => (
              <button
                key={t}
                onClick={() => set('mealType', form.mealType === t ? '' : t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.mealType === t ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {MEAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">단백질원 (선택)</label>
          <div className="flex gap-1.5 flex-wrap">
            {PROTEIN_SOURCES.map(s => (
              <button
                key={s}
                onClick={() => set('proteinSource', form.proteinSource === s ? '' : s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.proteinSource === s ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {PROTEIN_SOURCE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">단백질 조리 전 (g)</label>
            <input type="number" inputMode="decimal"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              placeholder="—" value={form.proteinRawGrams}
              onChange={e => set('proteinRawGrams', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">단백질 조리 후 (g)</label>
            <input type="number" inputMode="decimal"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              placeholder="—" value={form.proteinCookedGrams}
              onChange={e => set('proteinCookedGrams', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">밥 조리 후 (g)</label>
            <input type="number" inputMode="decimal"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              placeholder="—" value={form.riceCookedGrams}
              onChange={e => set('riceCookedGrams', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">채소 (g)</label>
            <input type="number" inputMode="decimal"
              className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm"
              placeholder="—" value={form.vegetableGrams}
              onChange={e => set('vegetableGrams', e.target.value)} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-700">1회 섭취 영양정보</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['proteinGrams', '단백질 (g)'],
              ['carbohydrateGrams', '탄수화물 (g)'],
              ['dietaryFiberGrams', '식이섬유 (g)'],
              ['caloriesKcal', '열량 (kcal)'],
            ] as Array<[keyof PresetForm, string]>).map(([key, label]) => (
              <label key={key} className="text-xs text-gray-400">
                {label}
                <input type="number" min="0" inputMode="decimal" value={String(form[key])}
                  onChange={event => set(key, event.target.value)}
                  className="mt-1 w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none" />
              </label>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {NUTRITION_SOURCES.map(source => (
              <button key={source} onClick={() => set('nutritionSource', source)} className={`px-2.5 py-1.5 rounded-lg text-xs ${form.nutritionSource === source ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {NUTRITION_SOURCE_LABELS[source]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">식사 품질 분류</label>
          <div className="grid grid-cols-2 gap-1.5">
            {QUALITY_TYPES.map(quality => (
              <button key={quality} onClick={() => set('qualityType', quality)} className={`px-2.5 py-2 rounded-lg text-xs ${form.qualityType === quality ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {QUALITY_LABELS[quality]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => set('favorite', !form.favorite)} className={`flex-1 px-3 py-2 rounded-xl text-xs border ${form.favorite ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
            {form.favorite ? '★ 즐겨찾기' : '☆ 즐겨찾기'}
          </button>
          <button onClick={() => set('containsCalories', !form.containsCalories)} className={`flex-1 px-3 py-2 rounded-xl text-xs border ${form.containsCalories ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-sky-50 border-sky-200 text-sky-700'}`}>
            {form.containsCalories ? '열량 있음' : '무열량'}
          </button>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">조리법</label>
          <div className="flex gap-1.5 flex-wrap">
            {COOKING_METHODS.map(m => (
              <button
                key={m}
                onClick={() => set('cookingMethod', m)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.cookingMethod === m ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {COOKING_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">메모 (선택)</label>
          <input type="text"
            className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm"
            placeholder="특이사항..."
            value={form.memo} onChange={e => set('memo', e.target.value)} />
        </div>

        <button
          onClick={save}
          className="w-full py-3.5 rounded-xl bg-indigo-500 text-white font-semibold active:bg-indigo-600"
        >
          저장
        </button>
      </div>
    </div>
  )
}

// ─── Record Tab ───────────────────────────────────────────────────────────────

function RecordTab() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate]         = useState(todayStr)
  const [meals, setMeals]       = useState<MealLog[]>([])
  const [presets, setPresets]   = useState<MealPreset[]>([])
  const [shiftType, setShiftType] = useState<ShiftType>('holiday')
  const [showAdd, setShowAdd]   = useState(false)
  const [targets, setTargets]   = useState<UserNutritionTargets | null>(null)
  const [showTargets, setShowTargets] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MealLog | undefined>()

  const loadMeals = useCallback(async () => {
    const list = await db.mealLogs.where('date').equals(date).sortBy('createdAt')
    setMeals(list)
  }, [date])

  const loadPresets = useCallback(async () => {
    const list = await db.mealPresets.orderBy('name').toArray()
    list.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name))
    setPresets(list)
  }, [])

  useEffect(() => {
    (async () => {
      const cfg = await db.bodyConfigs.toCollection().last()
      if (cfg) setShiftType(getShiftForDate(cfg.cycleStartDate, date))
    })()
  }, [date])

  useEffect(() => { loadMeals() },  [loadMeals])
  useEffect(() => { loadPresets() }, [loadPresets])
  useEffect(() => {
    db.nutritionTargets.toCollection().last().then(value => setTargets(value ?? null))
  }, [])

  const deleteMeal = async (id: number) => {
    await db.mealLogs.delete(id)
    loadMeals()
  }

  const summary = summarizeMeals(meals, targets)

  return (
    <div className="space-y-4">
      {/* 날짜 선택 */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 outline-none text-sm"
          value={date}
          onChange={e => setDate(e.target.value)}
        />
        {date !== todayStr && (
          <button
            onClick={() => setDate(todayStr)}
            className="text-xs text-indigo-500 border border-indigo-400/30 px-3 py-2 rounded-xl"
          >
            오늘
          </button>
        )}
        <button onClick={() => setShowTargets(true)} className="text-xs text-gray-500 border border-gray-200 px-3 py-2 rounded-xl">
          목표
        </button>
      </div>

      {/* 일간 요약 */}
      {summary ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500">오늘 식단 현황</p>

          {/* 단백질 */}
          {targets ? (
            <GoalBar
              label="단백질"
              note={targets.proteinMaxGrams ? `${targets.proteinMinGrams}~${targets.proteinMaxGrams}g 밴드` : '최소 목표'}
              current={summary.totalProteinGrams}
              target={targets.proteinMinGrams}
              unit="g"
              met={summary.proteinGramsGoalMet}
            />
          ) : (
            <GoalBar
              label="단백질"
              note="식사 횟수 기준 (g 기록 시 자동 전환)"
              current={summary.proteinMealCount}
              target={2}
              unit="회"
              met={summary.proteinGoalMet}
            />
          )}

          {/* 채소 */}
          <GoalBar
            label="채소"
            note={targets?.vegetableTargetGrams ? '이상 목표' : '기준 설정 필요'}
            current={summary.totalVegetableGrams}
            target={targets?.vegetableTargetGrams ?? 1}
            unit="g"
            met={summary.vegetableGoalMet}
          />

          {targets?.carbohydrateMinGrams != null ? (
            <GoalBar
              label="탄수화물"
              note={targets.carbohydrateMaxGrams ? `${targets.carbohydrateMinGrams}~${targets.carbohydrateMaxGrams}g 범위` : '최소 목표'}
              current={summary.totalCarbohydrateGrams}
              target={targets.carbohydrateMinGrams}
              unit="g"
              met={summary.carbRangeMet}
            />
          ) : <RiceBar rice={summary.totalRiceCookedGrams} />}

          {/* 기타 체크 */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
            <span className={`text-[11px] px-2.5 py-1 rounded-lg font-medium ${
              summary.mealQualityMet
                ? 'bg-emerald-500/10 text-emerald-600'
                : 'bg-amber-500/10 text-amber-600'
            }`}>
              {summary.mealQualityMet ? '✓ 이가공식품 없음' : `⚠ 이가공식품 ${summary.ultraProcessedCount}회`}
            </span>
            {summary.defenseSnackCount > 0 && (
              <span className="text-[11px] px-2.5 py-1 rounded-lg font-medium bg-emerald-500/10 text-emerald-600">
                방어간식 {summary.defenseSnackCount}회
              </span>
            )}
            <span className="text-[11px] px-2.5 py-1 rounded-lg font-medium bg-gray-100 text-gray-500">
              정상식사 {summary.normalMealCount}회 · 당 음료 {summary.sugaryDrinkCount}회
            </span>
            {summary.hasEstimatedValues ? <span className="text-[11px] px-2.5 py-1 rounded-lg bg-sky-50 text-sky-600">일부 추정</span> : null}
            {summary.hasNightSnackAfter1am && (
              <span className="text-[11px] px-2.5 py-1 rounded-lg font-medium bg-amber-500/10 text-amber-600">
                ⚠ 야간 1시 이후 섭취
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500">일일 기준</p>
            {!targets ? <button onClick={() => setShowTargets(true)} className="text-xs text-indigo-500">기준 설정</button> : null}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: '단백질', val: targets ? `${targets.proteinMinGrams}~${targets.proteinMaxGrams ?? '∞'}g` : '미설정', note: '실제 영양량' },
              { label: '채소', val: targets?.vegetableTargetGrams ? `${targets.vegetableTargetGrams}g+` : '미설정', note: '하루 누적' },
              { label: '탄수화물', val: targets?.carbohydrateMinGrams ? `${targets.carbohydrateMinGrams}~${targets.carbohydrateMaxGrams ?? '∞'}g` : '미설정', note: '적정 범위' },
            ]).map(({ label, val, note }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-400 mb-1">{label}</p>
                <p className="text-sm font-bold text-gray-700">{val}</p>
                <p className="text-[10px] text-gray-300 mt-0.5">{note}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-300 text-xs mt-3">식사를 추가하면 진행 상황이 표시됩니다</p>
        </div>
      )}

      {/* 식사 목록 */}
      {meals.length > 0 && (
        <ul className="space-y-2">
          {meals.map(m => (
            <li key={m.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-md font-medium shrink-0">
                    {MEAL_TYPE_LABELS[m.mealType]}
                  </span>
                  {m.time && <span className="text-xs text-gray-400">{m.time}</span>}
              <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{QUALITY_LABELS[getQualityType(m)]}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                  {m.proteinSource && <span>{PROTEIN_SOURCE_LABELS[m.proteinSource]}</span>}
                  {m.proteinGrams != null && <span>단백질 {m.proteinGrams}g</span>}
                  {m.carbohydrateGrams != null && <span>탄수화물 {m.carbohydrateGrams}g</span>}
                  {m.proteinGrams == null && m.proteinCookedGrams && <span>단백질원 {m.proteinCookedGrams}g</span>}
                  {m.riceCookedGrams && <span>밥 {m.riceCookedGrams}g</span>}
                  {m.vegetableGrams && <span>채소 {m.vegetableGrams}g</span>}
                  {m.memo && <span className="text-gray-400">— {m.memo}</span>}
                </div>
              </div>
              <button
                onClick={() => { setEditingMeal(m); setShowAdd(true) }}
                className="text-xs text-indigo-400 shrink-0 px-1 py-1"
              >수정</button>
              <button
                onClick={() => m.id && deleteMeal(m.id)}
                className="text-gray-300 text-xl active:text-red-400 shrink-0"
              >×</button>
            </li>
          ))}
        </ul>
      )}

      {/* 추가 버튼 */}
      <button
        onClick={() => { setEditingMeal(undefined); setShowAdd(true) }}
        className="w-full py-3 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600"
      >
        + 식사 추가
      </button>

      {showAdd && (
        <MealAddSheet
          date={date}
          shiftType={shiftType}
          presets={presets}
          currentSummary={summary}
          targets={targets}
          initial={editingMeal}
          onSave={loadMeals}
          onClose={() => { setShowAdd(false); setEditingMeal(undefined) }}
        />
      )}
      {showTargets && (
        <NutritionTargetsSheet current={targets} onClose={() => setShowTargets(false)} onSaved={setTargets} />
      )}
    </div>
  )
}

// ─── Reference Tab (기존 참고 자료) ──────────────────────────────────────────

const PROTEINS_REF = [
  { id: 'chicken_breast', name: '닭가슴살',     raw: '200~220g', cooked: '150~170g', protein: '약 46~50g' },
  { id: 'pork_shoulder',  name: '돼지 앞다리살', raw: '220~250g', cooked: '165~185g', protein: '약 40~45g' },
  { id: 'pork_neck',      name: '돼지 목살',     raw: '180~200g', cooked: '140~155g', protein: '약 29~32g' },
  { id: 'beef_chuck',     name: '쇠고기 목살',   raw: '190~220g', cooked: '145~165g', protein: '약 32~37g' },
  { id: 'tofu_only',      name: '두부 단독',      raw: '400~450g', cooked: '거의 동일',  protein: '약 32~36g' },
  { id: 'tofu_chicken',   name: '두부+닭',        raw: '두부 300g + 닭 100g', cooked: '두부 300g + 닭 약 75g', protein: '약 47g' },
]

const DEFENSE_SNACKS = [
  { name: '무가당 두유 1팩 (190~200ml)', protein: '약 7~8g' },
  { name: '삶은 달걀 1~2개',            protein: '약 6~12g' },
  { name: '그릭요거트 100g (무가당)',   protein: '약 9~10g' },
  { name: '단백질 팝칩 1봉',           protein: '약 10g' },
  { name: '기타 (상황에 맞게)',         protein: '—' },
]

const TIMING_REF = [
  {
    shift: '주간 근무', color: '#f59e0b',
    items: [
      { time: '11:20', label: '점심 (권장 마감)' },
      { time: '14:00', label: '카페인 마감' },
      { time: '19:50', label: '저녁 (마지막 식사)' },
      { time: '21:00', label: '일일 체크 알림' },
    ],
  },
  {
    shift: '야간 근무', color: '#6366f1',
    items: [
      { time: '18:50', label: '주 식사 (근무 전)' },
      { time: '근무 중', label: '카페인: 이탈 전 금지' },
      { time: '23:20', label: '배고프면 단백질 간식만' },
      { time: '00:50', label: '큰 식사 마감' },
    ],
  },
  {
    shift: '비번', color: '#a855f7',
    items: [
      { time: '늦은 아침', label: '취침 후 가볍게' },
      { time: '오후',     label: '수분 충분히 보충' },
      { time: '저녁',     label: '단백질 위주 식사' },
    ],
  },
  {
    shift: '휴무', color: '#10b981',
    items: [
      { time: '아침', label: '단백질 식사 (평소 패턴)' },
      { time: '점심', label: '채소 + 단백질 조합' },
      { time: '저녁', label: '식사 타이밍 일정하게' },
    ],
  },
]

const COOKING_REF = [
  { method: '샤부샤부', icon: '♨️', desc: '끓는 물에 살짝 데침. 가장 부드러운 식감.', tip: '5~10초 기준. 너무 오래 데치면 퍽퍽해짐.' },
  { method: '전골',    icon: '🍲', desc: '다양한 채소와 함께 끓임.', tip: '채소는 나중에 넣어 아삭함 유지. 간 없이 담백하게.' },
  { method: '찜',      icon: '🥦', desc: '수분을 유지해 촉촉한 식감. 영양 손실 적음.', tip: '닭가슴살: 중불 20~25분. 뚜껑 열지 말 것.' },
  { method: '물볶음',  icon: '🥄', desc: '기름 없이 물로 볶음. 칼로리 최소화.', tip: '팬 먼저 달구고 물 2~3스푼. 눌어붙으면 물 추가.' },
]

type RefSubTab = 'protein' | 'timing' | 'cooking'

function ReferenceTab() {
  const [sub, setSub] = useState<RefSubTab>('protein')
  const REF_TABS: Array<{ id: RefSubTab; label: string }> = [
    { id: 'protein', label: '단백질' },
    { id: 'timing',  label: '식사시간' },
    { id: 'cooking', label: '조리법' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {REF_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
              sub === id ? 'bg-indigo-500 text-white' : 'text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'protein' && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-400">조리 후 중량은 조리법·두께에 따라 달라질 수 있습니다. 단백질 함량은 1회분 기준 추정값입니다.</p>
          {PROTEINS_REF.map(p => (
            <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-3.5">
              <p className="text-gray-900 font-semibold text-sm mb-1.5">{p.name}</p>
              <div className="flex gap-4 text-xs flex-wrap">
                <div>
                  <span className="text-gray-400 block mb-0.5">조리 전</span>
                  <span className="text-gray-700">{p.raw}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">예상 조리 후</span>
                  <span className="text-emerald-600">{p.cooked}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">단백질 함량</span>
                  <span className="text-indigo-600 font-medium">{p.protein}</span>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-white border border-gray-100 rounded-xl p-3.5 mt-1">
            <p className="text-gray-900 font-semibold text-sm mb-2">방어간식 5종</p>
            <p className="text-[10px] text-gray-400 mb-2">허기·피로 유발 상황에서 큰 식사 대신 선택</p>
            <div className="space-y-1.5">
              {DEFENSE_SNACKS.map(s => (
                <div key={s.name} className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-gray-700">{s.name}</span>
                  <span className="text-[11px] text-indigo-600 font-medium shrink-0">{s.protein}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === 'timing' && (
        <div className="space-y-3">
          {TIMING_REF.map(t => (
            <div key={t.shift} className="bg-white border border-gray-100 rounded-xl p-3.5">
              <p className="font-semibold text-sm mb-2.5" style={{ color: t.color }}>{t.shift}</p>
              <div className="space-y-2">
                {t.items.map(item => (
                  <div key={item.time} className="flex items-baseline gap-3">
                    <span className="text-[11px] font-mono text-gray-400 w-16 shrink-0">{item.time}</span>
                    <span className="text-sm text-gray-700">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === 'cooking' && (
        <div className="space-y-3">
          {COOKING_REF.map(c => (
            <div key={c.method} className="bg-white border border-gray-100 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{c.icon}</span>
                <p className="text-gray-900 font-semibold text-sm">{c.method}</p>
              </div>
              <p className="text-gray-500 text-xs mb-1.5">{c.desc}</p>
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                <p className="text-indigo-600 text-xs">💡 {c.tip}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Preset Tab ───────────────────────────────────────────────────────────────

function PresetTab() {
  const [presets, setPresets]     = useState<MealPreset[]>([])
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState<MealPreset | undefined>()
  const [query, setQuery]         = useState('')

  const load = useCallback(async () => {
    const list = await db.mealPresets.orderBy('name').toArray()
    list.sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.name.localeCompare(b.name))
    setPresets(list)
  }, [])

  useEffect(() => { load() }, [load])

  const del = async (id: number) => {
    await db.mealPresets.delete(id)
    load()
  }
  const visiblePresets = presets.filter(preset => preset.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  return (
    <div className="space-y-3">
      <button
        onClick={() => { setEditing(undefined); setShowAdd(true) }}
        className="w-full py-3 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600"
      >
        + 프리셋 추가
      </button>

      <input
        type="search"
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="프리셋 검색"
        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 outline-none"
      />

      {visiblePresets.length === 0 ? (
        <p className="text-center text-gray-300 text-sm py-6">
          저장된 프리셋이 없습니다<br />
          <span className="text-xs">자주 먹는 식단을 프리셋으로 저장하면 기록이 빨라져요</span>
        </p>
      ) : (
        <ul className="space-y-2">
          {visiblePresets.map(p => (
            <li key={p.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-gray-900">{p.favorite ? '★ ' : ''}{p.name}</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setEditing(p); setShowAdd(true) }}
                    className="text-xs text-indigo-500 border border-indigo-400/30 px-2.5 py-1 rounded-lg"
                  >수정</button>
                  <button
                    onClick={() => p.id && del(p.id)}
                    className="text-xs text-gray-300 border border-gray-200 px-2.5 py-1 rounded-lg active:text-red-400"
                  >삭제</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                {p.mealType && <span>{MEAL_TYPE_LABELS[p.mealType]}</span>}
                {p.proteinSource && <span>{PROTEIN_SOURCE_LABELS[p.proteinSource]}</span>}
                {p.proteinGrams != null && <span>단백질 {p.proteinGrams}g</span>}
                {p.carbohydrateGrams != null && <span>탄수화물 {p.carbohydrateGrams}g</span>}
                {p.proteinGrams == null && p.proteinCookedGrams && <span>단백질원 {p.proteinCookedGrams}g</span>}
                {p.riceCookedGrams && <span>밥 {p.riceCookedGrams}g</span>}
                {p.vegetableGrams && <span>채소 {p.vegetableGrams}g</span>}
                <span className="text-gray-300">{COOKING_METHOD_LABELS[p.cookingMethod]}</span>
                <span className="text-indigo-400">{QUALITY_LABELS[p.qualityType ?? 'UNCLASSIFIED']}</span>
                <span className="text-sky-500">{NUTRITION_SOURCE_LABELS[p.nutritionSource ?? 'USER_DEFINED']}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <PresetSheet
          initial={editing}
          onSave={load}
          onClose={() => { setShowAdd(false); setEditing(undefined) }}
        />
      )}
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

type MealSubTab = 'record' | 'reference' | 'preset'

export default function BiMealTab() {
  const [sub, setSub] = useState<MealSubTab>('record')

  const TABS: Array<{ id: MealSubTab; label: string }> = [
    { id: 'record',    label: '📝 기록' },
    { id: 'reference', label: '📖 참고' },
    { id: 'preset',    label: '⭐ 프리셋' },
  ]

  return (
    <div className="px-4 pt-4 pb-8">
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`flex-1 py-2.5 text-xs rounded-xl font-medium transition-colors ${
              sub === id ? 'bg-indigo-500 text-white' : 'text-gray-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'record'    && <RecordTab />}
      {sub === 'reference' && <ReferenceTab />}
      {sub === 'preset'    && <PresetTab />}
    </div>
  )
}
