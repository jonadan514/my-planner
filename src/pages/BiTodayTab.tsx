import { useState, useEffect, useCallback } from 'react'
import { format, differenceInDays, parseISO, subDays } from 'date-fns'
import { db, summarizeMeals } from '../db/database'
import type { BodyProfile, DailyBehavior, ShiftType, DailyMealSummary, UserNutritionTargets } from '../db/database'
import NutritionTargetsSheet from '../components/NutritionTargetsSheet'
import { fastingBandLabel, getLatestCompletedFastingInterval, STATUS_LABELS } from '../utils/nutrition'
import type { FastingInterval } from '../utils/nutrition'
import { getDailyExerciseProgress } from '../utils/exercise'
import HealthConnectCard from '../components/HealthConnectCard'
import BodyProfileSheet from '../components/BodyProfileSheet'
import HealthSnapshotCard from '../components/HealthSnapshotCard'
import { mergeAutomaticBehaviors, scoreDailyBehaviors } from '../utils/dailyBehavior'

const SHIFT_PATTERN: ShiftType[] = [
  'day', 'day', 'night', 'off_after_night', 'holiday', 'night', 'off_after_night', 'holiday',
]

const SHIFT_LABELS: Record<ShiftType, string> = {
  day: '주간',
  night: '야간',
  off_after_night: '비번',
  holiday: '휴무',
}

const SHIFT_COLORS: Record<ShiftType, string> = {
  day: '#f59e0b',
  night: '#0f766e',
  off_after_night: '#a855f7',
  holiday: '#10b981',
}

type MealGuideConfig = {
  title: string
  items: Array<{ label: string; time?: string; desc: string }>
  portionNote: string[]
  focus: string
}

const MEAL_GUIDES: Record<ShiftType, MealGuideConfig> = {
  day: {
    title: '주간 근무',
    items: [
      { label: '점심', time: '11:30 이전', desc: '단백질 + 채소 + 밥 130~150g' },
      { label: '저녁', time: '20:00 이전', desc: '단백질 + 채소 + 밥 100~130g' },
      { label: '간식', desc: '저녁 후 허기질 때만 방어간식 1회' },
    ],
    portionNote: ['밥: 눈대중 공기 1개 (과식 없게)', '단백질: 손바닥 크기 1회분', '채소: 한 가지 이상 챙기기'],
    focus: '점심을 충분히 먹어 저녁 과식을 예방한다. 저녁은 점심보다 조금 적게.',
  },
  night: {
    title: '야간 근무',
    items: [
      { label: '점심', time: '11:30~12:00', desc: '단백질 + 채소 + 밥 130~150g' },
      { label: '저녁', time: '19:00 이전', desc: '단백질 + 채소 + 밥 100~130g' },
      { label: '방어간식', time: '23:30~00:30', desc: '필요할 때만 1회 (무가당 두유·구이닭·그릭요거트)' },
    ],
    portionNote: ['밥: 저녁은 점심보다 조금 적게', '단백질: 점심·저녁 각 1회분', '채소: 의식적으로 챙기기'],
    focus: '새벽에 배고픔이 올 수 있으니, 출근 전에 방어간식 1개를 미리 챙겨둔다.',
  },
  off_after_night: {
    title: '비번 (야간 후 회복)',
    items: [
      { label: '점심', desc: '수면 후 몸이 회복된 다음 진행' },
      { label: '저녁', desc: '평소 저녁 기준으로 가볍게 정리' },
      { label: '간식', desc: '피곤함에서 오는 식욕이면 방어간식으로 대체' },
    ],
    portionNote: ['밥: 무리 말고 평소 수준으로', '단백질: 하루 2회 확보', '채소: 가능하면 챙기기'],
    focus: '비번일은 회복이 먼저다. 식사는 거르지 말고, 부담 적은 방식으로 먹는다.',
  },
  holiday: {
    title: '휴무일',
    items: [
      { label: '점심', desc: '평소 식사 시간대로' },
      { label: '저녁', desc: '너무 늦지 않게 마무리' },
      { label: '운동', desc: '걷기, 스트레칭, 근력 중 컨디션에 맞게 선택' },
    ],
    portionNote: ['밥: 눈대중 공기 1개 (과식 없게)', '단백질: 끼니당 1회분', '채소: 한 가지 이상 챙기기'],
    focus: '가장 기록하기 좋은 날. 운동 습관 만들기에 가장 적합하다. 가볍게 30분 걷기부터.',
  },
}

const TODAY_BEHAVIORS: Array<{ key: keyof DailyBehavior; label: string; sublabel: string }> = [
  { key: 'protein', label: '단백질 목표', sublabel: '식단 자동 판정' },
  { key: 'carbs', label: '탄수화물 범위', sublabel: '식단 자동 판정' },
  { key: 'vegetables', label: '채소·식이섬유', sublabel: '식단 자동 판정' },
  { key: 'exercise', label: '운동 완료', sublabel: '자동 또는 수동' },
  { key: 'fasting', label: '공복시간 확인', sublabel: '섭취 시각 기준' },
]

const DEFAULT_BEHAVIORS: DailyBehavior = {
  protein: false, fasting: false, carbs: false, vegetables: false, exercise: false,
}

const DEFAULT_SYMPTOMS = { backPain: 0, footNumbness: 0, neuroWarning: 'none' as const }

function computeCycleInfo(cycleStartDate: string, todayStr: string) {
  const anchor = parseISO(cycleStartDate)
  const today = parseISO(todayStr)
  const diff = differenceInDays(today, anchor)
  const cycleDay = ((diff % 8) + 8) % 8
  const cycleNumber = Math.floor(diff < 0 ? 0 : diff / 8) + 1
  const shiftType = SHIFT_PATTERN[cycleDay]
  return { cycleDay, cycleNumber, shiftType }
}

function currentTimestamp(): number {
  return Date.now()
}

interface Props {
  onOpenMeals?: () => void
}

export default function BiTodayTab({ onOpenMeals }: Props) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [configId, setConfigId] = useState<number | undefined>()
  const [cycleStartDate, setCycleStartDate] = useState('')
  const [logId, setLogId] = useState<number | undefined>()
  const [behaviors, setBehaviors] = useState<DailyBehavior>({ ...DEFAULT_BEHAVIORS })
  const [memo, setMemo] = useState('')
  const [editCycleStart, setEditCycleStart] = useState('')
  const [showCycleEdit, setShowCycleEdit] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [mealSummary, setMealSummary] = useState<DailyMealSummary | null>(null)
  const [targets, setTargets] = useState<UserNutritionTargets | null>(null)
  const [showTargets, setShowTargets] = useState(false)
  const [profile, setProfile] = useState<BodyProfile | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [fastingInterval, setFastingInterval] = useState<FastingInterval | null>(null)
  const [exerciseProgress, setExerciseProgress] = useState(() => getDailyExerciseProgress([], undefined))
  const [exerciseWorkoutCount, setExerciseWorkoutCount] = useState(0)
  const [behaviorSources, setBehaviorSources] = useState<Partial<Record<keyof DailyBehavior, 'MANUAL' | 'MEAL_LOG' | 'HEALTH_CONNECT'>>>({})
  const [automaticBehaviors, setAutomaticBehaviors] = useState<DailyBehavior>({ ...DEFAULT_BEHAVIORS })
  const [automaticSources, setAutomaticSources] = useState<Partial<Record<keyof DailyBehavior, 'MANUAL' | 'MEAL_LOG' | 'HEALTH_CONNECT'>>>({})

  const load = useCallback(async () => {
    const recentStart = format(subDays(parseISO(todayStr), 2), 'yyyy-MM-dd')
    const [cfg, existing, todayMeals, recentMeals, nutritionTargets, workouts, bodyProfile] = await Promise.all([
      db.bodyConfigs.toCollection().last(),
      db.dailyHealthLogs.where('date').equals(todayStr).first(),
      db.mealLogs.where('date').equals(todayStr).toArray(),
      db.mealLogs.where('date').between(recentStart, todayStr, true, true).toArray(),
      db.nutritionTargets.toCollection().last(),
      db.workoutLogs.where('date').equals(todayStr).toArray(),
      db.bodyProfiles.toCollection().last(),
    ])
    if (cfg) {
      setConfigId(cfg.id)
      setCycleStartDate(cfg.cycleStartDate)
      setEditCycleStart(cfg.cycleStartDate)
    }
    const summary = summarizeMeals(todayMeals, nutritionTargets)
    const latestFasting = getLatestCompletedFastingInterval(recentMeals)
    setTargets(nutritionTargets ?? null)
    setProfile(bodyProfile ?? null)
    setMealSummary(summary)
    setFastingInterval(latestFasting)
    const nextExerciseProgress = getDailyExerciseProgress(workouts, nutritionTargets?.exerciseMinutes)
    const exerciseComplete = nextExerciseProgress.complete
    setExerciseProgress(nextExerciseProgress)
    setExerciseWorkoutCount(workouts.length)
    const exerciseSource = workouts.some(workout => workout.origin === 'HEALTH_CONNECT')
      ? 'HEALTH_CONNECT' as const
      : 'MANUAL' as const
    const nextAutomaticBehaviors: DailyBehavior = {
      protein: summary?.proteinGoalMet ?? false,
      carbs: summary?.carbRangeMet ?? false,
      vegetables: summary?.vegetableGoalMet ?? false,
      exercise: exerciseComplete,
      fasting: latestFasting != null,
    }
    const nextAutomaticSources: Partial<Record<keyof DailyBehavior, 'MANUAL' | 'MEAL_LOG' | 'HEALTH_CONNECT'>> = {
      protein: 'MEAL_LOG', carbs: 'MEAL_LOG', vegetables: 'MEAL_LOG', fasting: 'MEAL_LOG',
      ...(workouts.length > 0 ? { exercise: exerciseSource } : {}),
    }
    const merged = mergeAutomaticBehaviors(
      existing ? { ...DEFAULT_BEHAVIORS, ...existing.behaviors } : undefined,
      existing?.behaviorSources,
      nextAutomaticBehaviors,
      nextAutomaticSources,
    )
    setAutomaticBehaviors(nextAutomaticBehaviors)
    setAutomaticSources(nextAutomaticSources)
    setBehaviors(merged.behaviors)
    setBehaviorSources(merged.sources)
    if (existing) {
      setLogId(existing.id)
      setMemo(existing.memo ?? '')
    }

    if (cfg) {
      const { cycleDay, cycleNumber, shiftType } = computeCycleInfo(cfg.cycleStartDate, todayStr)
      const score = scoreDailyBehaviors(merged.behaviors)
      const now = Date.now()
      const record = {
        date: todayStr, cycleNumber, cycleDay, shiftType,
        behaviors: merged.behaviors, behaviorSources: merged.sources,
        symptoms: existing?.symptoms ?? DEFAULT_SYMPTOMS,
        score, achieved: score === TODAY_BEHAVIORS.length,
        memo: existing?.memo,
        createdAt: existing?.createdAt ?? now, updatedAt: now,
      }
      const id = await db.dailyHealthLogs.put({ ...record, id: existing?.id }) as number
      setLogId(id)
    }
    setLoading(false)
  }, [todayStr])

  useEffect(() => {
    queueMicrotask(() => { void load() })
    const reloadAfterHealthSync = () => { void load() }
    window.addEventListener('health-connect-synced', reloadAfterHealthSync)
    return () => window.removeEventListener('health-connect-synced', reloadAfterHealthSync)
  }, [load])

  const saveConfig = async () => {
    if (!editCycleStart) return
    if (configId) {
      await db.bodyConfigs.update(configId, { cycleStartDate: editCycleStart })
    } else {
      const id = await db.bodyConfigs.add({ cycleStartDate: editCycleStart })
      setConfigId(id as number)
    }
    setCycleStartDate(editCycleStart)
    setShowCycleEdit(false)
  }

  const completedCount = TODAY_BEHAVIORS.filter(({ key }) => behaviors[key]).length
  const score = completedCount
  const achieved = completedCount === TODAY_BEHAVIORS.length

  const { cycleDay, cycleNumber, shiftType } = cycleStartDate
    ? computeCycleInfo(cycleStartDate, todayStr)
    : { cycleDay: 0, cycleNumber: 1, shiftType: 'holiday' as ShiftType }

  const persistBehaviors = async (
    nextBehaviors: DailyBehavior,
    nextSources: Partial<Record<keyof DailyBehavior, 'MANUAL' | 'MEAL_LOG' | 'HEALTH_CONNECT'>>,
  ) => {
    if (!cycleStartDate) return
    const info = computeCycleInfo(cycleStartDate, todayStr)
    const nextScore = scoreDailyBehaviors(nextBehaviors)
    const now = currentTimestamp()
    const record = {
      date: todayStr, ...info, behaviors: nextBehaviors, behaviorSources: nextSources,
      symptoms: DEFAULT_SYMPTOMS, score: nextScore,
      achieved: nextScore === TODAY_BEHAVIORS.length,
      memo: memo.trim() || undefined, updatedAt: now,
    }
    if (logId) await db.dailyHealthLogs.update(logId, record)
    else setLogId(await db.dailyHealthLogs.add({ ...record, createdAt: now }) as number)
  }

  const restoreAutomaticValues = () => {
    setBehaviors(automaticBehaviors)
    setBehaviorSources(automaticSources)
    void persistBehaviors(automaticBehaviors, automaticSources)
  }

  const toggleBehavior = (key: keyof DailyBehavior) => {
    const nextBehaviors = { ...behaviors, [key]: !behaviors[key] }
    const nextSources = { ...behaviorSources, [key]: 'MANUAL' as const }
    setBehaviors(nextBehaviors)
    setBehaviorSources(nextSources)
    void persistBehaviors(nextBehaviors, nextSources)
  }

  const save = async () => {
    const now = Date.now()
    const record = {
      date: todayStr,
      cycleNumber,
      cycleDay,
      shiftType,
      behaviors,
      behaviorSources,
      symptoms: DEFAULT_SYMPTOMS,
      score,
      achieved,
      memo: memo.trim() || undefined,
    }
    if (logId) {
      await db.dailyHealthLogs.update(logId, { ...record, updatedAt: now })
    } else {
      const id = await db.dailyHealthLogs.add({ ...record, createdAt: now, updatedAt: now })
      setLogId(id as number)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="px-4 pt-8 text-gray-400 text-sm text-center">로딩 중...</div>
  }

  if (!cycleStartDate) {
    return (
      <div className="px-4 pt-6 pb-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-lg font-semibold text-gray-900 mb-2">주기 시작일 설정</p>
          <p className="text-gray-500 text-sm mb-4">
            8일 교대 주기의 첫 번째 주간근무일을 입력하세요.
            <br />패턴: 주간→주간→야간→비번→휴무→야간→비번→휴무
          </p>
          <input
            type="date"
            className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 outline-none text-sm mb-3"
            value={editCycleStart}
            onChange={e => setEditCycleStart(e.target.value)}
          />
          <button
            onClick={saveConfig}
            className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm active:bg-emerald-600"
          >
            설정 완료
          </button>
        </div>
      </div>
    )
  }

  const shiftColor = SHIFT_COLORS[shiftType]
  const mealGuide = MEAL_GUIDES[shiftType]

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">

      {/* 주기 / 근무 헤더 */}
      <div
        className="rounded-2xl p-4 border"
        style={{ background: shiftColor + '14', borderColor: shiftColor + '30' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[11px] text-gray-400 mb-0.5">오늘 주기</p>
            <p className="text-gray-900 font-semibold text-base">
              {cycleNumber}주기 · {cycleDay + 1}/8일차
            </p>
          </div>
          <span
            className="px-3 py-1.5 rounded-xl text-sm font-bold"
            style={{ background: shiftColor + '25', color: shiftColor }}
          >
            {SHIFT_LABELS[shiftType]}
          </span>
        </div>

        {showCycleEdit ? (
          <div className="flex gap-2 mt-2">
            <input
              type="date"
              className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-gray-900 outline-none text-sm"
              value={editCycleStart}
              onChange={e => setEditCycleStart(e.target.value)}
            />
            <button onClick={saveConfig} className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-xs font-semibold">저장</button>
            <button onClick={() => setShowCycleEdit(false)} className="px-3 py-2 bg-gray-100 text-gray-400 rounded-xl text-xs">취소</button>
          </div>
        ) : (
          <button
            onClick={() => setShowCycleEdit(true)}
            className="text-[11px] text-gray-400 underline underline-offset-2 mt-1"
          >
            시작일: {cycleStartDate} (변경)
          </button>
        )}
      </div>

      {/* 오늘 단백질 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">오늘 단백질</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowProfile(true)} className="text-xs text-emerald-600">프로필</button>
            <button onClick={() => setShowTargets(true)} className="text-xs text-emerald-500">목표 설정</button>
          </div>
        </div>
        {targets ? (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div><p className="text-[10px] text-gray-400">현재 섭취</p><p className="text-xl font-bold text-gray-900">{mealSummary?.totalProteinGrams ?? 0}g</p></div>
              <div><p className="text-[10px] text-gray-400">목표 밴드</p><p className="text-sm font-bold text-gray-700 mt-1">{targets.proteinMinGrams}~{targets.proteinMaxGrams ?? '∞'}g</p></div>
              <div><p className="text-[10px] text-gray-400">남은 최소량</p><p className="text-sm font-bold text-emerald-600 mt-1">{Math.max(0, targets.proteinMinGrams - (mealSummary?.totalProteinGrams ?? 0))}g</p></div>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((mealSummary?.totalProteinGrams ?? 0) / targets.proteinMinGrams) * 100)}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              상태: {STATUS_LABELS[mealSummary?.proteinStatus ?? 'BELOW']}{mealSummary?.hasEstimatedValues ? ' · 일부 추정' : ''}
            </p>
          </>
        ) : (
          <div className="bg-amber-50 rounded-xl px-3 py-3">
            <p className="text-xs text-amber-700">개인 단백질 최소·상한 목표를 먼저 설정해 주세요.</p>
          </div>
        )}
      </div>

      <button onClick={onOpenMeals} className="w-full bg-emerald-500 text-white rounded-2xl px-4 py-3.5 flex items-center justify-between font-semibold text-sm">
        <span>빠른 식단 기록 / 프리셋</span><span>›</span>
      </button>

      {/* 오늘 식단 요약 카드 */}
      {mealSummary && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900">🍽 오늘 식단 현황</p>
            <button
              onClick={restoreAutomaticValues}
              className="text-xs text-emerald-500 border border-emerald-400/30 px-2.5 py-1 rounded-lg active:bg-emerald-500/10"
            >
              행동 자동 반영
            </button>
          </div>
          <div className="flex gap-2">
            {[
              { label: '탄수화물', value: `${mealSummary.totalCarbohydrateGrams}g`, ok: mealSummary.carbRangeMet },
              { label: '채소', value: `${mealSummary.totalVegetableGrams}g`, ok: mealSummary.vegetableGoalMet },
              { label: '단백질', value: `${mealSummary.totalProteinGrams}g`, ok: mealSummary.proteinGoalMet },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                <p className={`text-sm font-bold ${ok ? 'text-emerald-500' : 'text-amber-500'}`}>{value}</p>
              </div>
            ))}
          </div>
          {(mealSummary.ultraProcessedCount > 0 || mealSummary.hasNightSnackAfter1am) && (
            <p className="text-[11px] text-amber-500 mt-2">
              {mealSummary.ultraProcessedCount > 0 && `이가공식품 ${mealSummary.ultraProcessedCount}회 `}
              {mealSummary.hasNightSnackAfter1am && '야간 1시 이후 섭취'}
            </p>
          )}
          <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-gray-100">
            {[
              ['정상 식사', mealSummary.normalMealCount],
              ['방어간식', mealSummary.defenseSnackCount],
              ['초가공', mealSummary.ultraProcessedCount],
              ['당 음료', mealSummary.sugaryDrinkCount],
            ].map(([label, count]) => (
              <div key={String(label)} className="text-center bg-gray-50 rounded-lg px-1 py-2">
                <p className="text-[9px] text-gray-400">{label}</p><p className="text-sm font-bold text-gray-700">{count}회</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">오늘 운동</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{exerciseProgress.displayMinutes}분</p>
          </div>
          <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
            exerciseProgress.complete ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
          }`}>
            {exerciseProgress.complete ? '완료' : '진행 중'}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          {exerciseWorkoutCount > 0 ? `${exerciseWorkoutCount}개 운동 기록` : '오늘 운동 기록 없음'}
          {exerciseProgress.targetMinutes != null ? ` · 완료 기준 ${exerciseProgress.targetMinutes}분` : ' · 운동 기록이 있으면 완료'}
        </p>
        {exerciseWorkoutCount > 0 && !exerciseProgress.complete && exerciseProgress.targetMinutes != null && (
          <p className="mt-1 text-[10px] text-amber-500">
            목표까지 {Math.max(0, exerciseProgress.targetMinutes - exerciseProgress.displayMinutes)}분 남았습니다.
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-gray-900 mb-2">공복시간</p>
        {fastingInterval ? (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{Math.floor(fastingInterval.minutes / 60)}시간 {fastingInterval.minutes % 60}분</p>
              <p className="text-[11px] text-gray-400 mt-1">기록 구간 {fastingBandLabel(fastingInterval.band)}</p>
            </div>
            <p className="text-[10px] text-gray-400 text-right">열량 섭취 시각 기준<br />점수·보상 없음</p>
          </div>
        ) : <p className="text-xs text-gray-400">시각이 있는 열량 섭취 기록이 2개 이상이면 표시됩니다.</p>}
      </div>

      <HealthConnectCard />
      <HealthSnapshotCard />

      {/* 오늘 식사 가이드 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <p className="text-sm font-bold text-gray-900 mb-3">🍽 {mealGuide.title}</p>

        <div className="space-y-2.5 mb-3">
          {mealGuide.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-xs font-bold text-gray-800 bg-gray-200/70 rounded-lg px-2.5 py-1 shrink-0 text-center min-w-[52px]">
                {item.label}
              </span>
              <div className="min-w-0 pt-0.5">
                {item.time && (
                  <p className="text-[11px] text-gray-500 font-semibold leading-none mb-0.5">{item.time}</p>
                )}
                <p className="text-sm text-gray-700 leading-snug">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-2.5 space-y-1 border border-gray-100">
          {mealGuide.portionNote.map((note, i) => (
            <p key={i} className="text-xs text-gray-600 font-medium">{note}</p>
          ))}
        </div>

        <div className="bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-100">
          <p className="text-xs text-emerald-700 font-medium leading-relaxed">💡 {mealGuide.focus}</p>
        </div>
      </div>

      {/* 행동 체크 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">✅ 오늘 행동 체크</p>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
              achieved ? 'bg-emerald-500/15 text-emerald-600' : 'bg-gray-100 text-gray-400'
            }`}>
              {completedCount}/5
            </span>
            <button onClick={restoreAutomaticValues} className="text-[11px] text-emerald-500">자동값 복원</button>
          </div>
        </div>

        {/* 핵심 진행바 */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${achieved ? 'bg-emerald-500' : 'bg-emerald-400'}`}
            style={{ width: `${(completedCount / TODAY_BEHAVIORS.length) * 100}%` }}
          />
        </div>

        <div className="space-y-2">
          {TODAY_BEHAVIORS.map(({ key, label, sublabel }) => {
            const checked = behaviors[key]
            const source = behaviorSources[key]
            return (
              <button
                key={key}
                onClick={() => toggleBehavior(key)}
                className={`w-full py-3 px-3 rounded-xl text-left border transition-colors flex items-center gap-3 ${
                  checked ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <span className={`text-base font-bold ${checked ? 'text-emerald-500' : 'text-gray-200'}`}>
                  {checked ? '✓' : '○'}
                </span>
                <span className="flex-1">
                  <span className={`block text-xs font-semibold ${checked ? 'text-emerald-700' : 'text-gray-600'}`}>{label}</span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">{sublabel}</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white text-gray-400">
                  {source === 'MEAL_LOG' ? '자동·식단' : source === 'HEALTH_CONNECT' ? '자동·Health Connect' : source === 'MANUAL' ? '수동' : '미판정'}
                </span>
              </button>
            )
          })}
        </div>

        {achieved && (
          <p className="text-center text-emerald-500 text-sm font-semibold mt-3">오늘 5개 항목을 모두 확인했습니다.</p>
        )}
      </div>

      {/* 메모 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <label className="text-[12px] text-gray-400 block mb-2">메모 (선택)</label>
        <textarea
          rows={2}
          placeholder="오늘 특이사항, 컨디션 등..."
          className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none text-sm resize-none"
          value={memo}
          onChange={e => setMemo(e.target.value)}
        />
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={save}
        className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-colors ${
          saved
            ? 'bg-emerald-500 text-white'
            : 'bg-emerald-500 text-white active:bg-emerald-600'
        }`}
      >
        {saved ? '✓ 저장 완료' : '빠른 저장'}
      </button>
      {showTargets ? (
        <NutritionTargetsSheet
          current={targets}
          onClose={() => setShowTargets(false)}
          onSaved={value => {
            setTargets(value)
            load()
          }}
        />
      ) : null}
      {showProfile ? (
        <BodyProfileSheet
          current={profile}
          currentTargets={targets}
          onClose={() => setShowProfile(false)}
          onSaved={(nextProfile, nextTargets) => {
            setProfile(nextProfile)
            if (nextTargets) setTargets(nextTargets)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}
