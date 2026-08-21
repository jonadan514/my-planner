import { useState, useEffect, useCallback } from 'react'
import { format, differenceInDays, parseISO, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { db, summarizeMeals } from '../db/database'
import type { DailyHealthLog, HealthRecord, MealLog, ShiftType, UserNutritionTargets, WorkoutEntry } from '../db/database'
import { getCompletedFastingIntervals } from '../utils/nutrition'

const SHIFT_LABELS: Record<ShiftType, string> = {
  day: '주간',
  night: '야간',
  off_after_night: '비번',
  holiday: '휴무',
}

const SHIFT_COLORS: Record<ShiftType, string> = {
  day: '#f59e0b',
  night: '#6366f1',
  off_after_night: '#a855f7',
  holiday: '#10b981',
}

function getCycleStatus(achievedDays: number, count: number): { label: string; color: string } {
  if (count === 0) return { label: '—', color: '#9ca3af' }
  const rate = achievedDays / count
  if (rate >= 0.6) return { label: '✅ 유지 중', color: '#10b981' }
  return { label: '🔧 핵심 루틴 점검', color: '#f59e0b' }
}

export default function BiSummaryTab() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [cycleStartDate, setCycleStartDate] = useState('')
  const [logs, setLogs] = useState<DailyHealthLog[]>([])
  const [weeklyMeals, setWeeklyMeals] = useState<MealLog[]>([])
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<WorkoutEntry[]>([])
  const [weeklyHealth, setWeeklyHealth] = useState<HealthRecord[]>([])
  const [targets, setTargets] = useState<UserNutritionTargets | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const cfg = await db.bodyConfigs.toCollection().last()
    const today = parseISO(todayStr)
    const weeklyStart = format(addDays(today, -6), 'yyyy-MM-dd')
    const [meals, workouts, nutritionTargets, healthRecords] = await Promise.all([
      db.mealLogs.where('date').between(weeklyStart, todayStr, true, true).toArray(),
      db.workoutLogs.where('date').between(weeklyStart, todayStr, true, true).toArray(),
      db.nutritionTargets.toCollection().last(),
      db.healthRecords.where('date').between(weeklyStart, todayStr, true, true).toArray(),
    ])
    setWeeklyMeals(meals)
    setWeeklyWorkouts(workouts)
    setTargets(nutritionTargets ?? null)
    setWeeklyHealth(healthRecords)

    if (!cfg) { setLoading(false); return }
    setCycleStartDate(cfg.cycleStartDate)

    const anchor = parseISO(cfg.cycleStartDate)
    const diff = differenceInDays(today, anchor)
    const cycleDay = ((diff % 8) + 8) % 8
    const cycleStart = format(addDays(today, -cycleDay), 'yyyy-MM-dd')
    const cycleEnd   = format(addDays(today, 7 - cycleDay), 'yyyy-MM-dd')

    const all = await db.dailyHealthLogs
      .where('date')
      .between(cycleStart, cycleEnd, true, true)
      .sortBy('date')
    setLogs(all)
    setLoading(false)
  }, [todayStr])

  useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

  if (loading) return <div className="px-4 pt-8 text-gray-400 text-sm text-center">로딩 중...</div>

  const weekDates = Array.from({ length: 7 }, (_, index) => format(addDays(parseISO(todayStr), index - 6), 'yyyy-MM-dd'))
  const weeklySummaries = weekDates
    .map(date => summarizeMeals(weeklyMeals.filter(meal => meal.date === date), targets))
    .filter(summary => summary != null)
  const proteinDays = weeklySummaries.filter(summary => summary.proteinGoalMet).length
  const carbohydrateDays = weeklySummaries.filter(summary => summary.carbRangeMet).length
  const vegetableDays = weeklySummaries.filter(summary => summary.vegetableGoalMet).length
  const qualityTotals = weeklySummaries.reduce((totals, summary) => ({
    normal: totals.normal + summary.normalMealCount,
    defensive: totals.defensive + summary.defenseSnackCount,
    ultraProcessed: totals.ultraProcessed + summary.ultraProcessedCount,
    sugaryDrink: totals.sugaryDrink + summary.sugaryDrinkCount,
  }), { normal: 0, defensive: 0, ultraProcessed: 0, sugaryDrink: 0 })
  const fastingIntervals = getCompletedFastingIntervals(weeklyMeals)
  const workoutMinutes = weeklyWorkouts.reduce((total, workout) => total + (workout.duration ?? 0), 0)
  const stepDays = weekDates.map(date => weeklyHealth
    .filter(record => record.dataType === 'STEPS' && record.date === date)
    .reduce((sum, record) => sum + (record.value ?? 0), 0)).filter(value => value > 0)
  const sleepDays = weekDates.map(date => weeklyHealth
    .filter(record => record.dataType === 'SLEEP' && record.date === date)
    .reduce((longest, record) => Math.max(longest, record.durationMinutes ?? 0), 0)).filter(value => value > 0)
  const averageSteps = stepDays.length > 0 ? Math.round(stepDays.reduce((sum, value) => sum + value, 0) / stepDays.length) : 0
  const averageSleepMinutes = sleepDays.length > 0 ? Math.round(sleepDays.reduce((sum, value) => sum + value, 0) / sleepDays.length) : 0
  const latestWeight = weeklyHealth.filter(record => record.dataType === 'WEIGHT' && record.value != null)
    .toSorted((a, b) => b.startTime.localeCompare(a.startTime))[0]?.value

  const weeklyNutritionCard = (
    <div className="space-y-3">
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div><p className="text-sm font-semibold text-gray-900">최근 7일 식사 정상화</p><p className="text-[10px] text-gray-400">{weekDates[0]} ~ {todayStr}</p></div>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">기록 {weeklySummaries.length}/7일</span>
        </div>
        {weeklySummaries.length === 0 ? (
          <p className="text-xs text-gray-400 py-3 text-center">데이터 부족 · 식사 기록 후 지표가 표시됩니다.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <StatCard label="단백질 충분" value={String(proteinDays)} unit="일" color="#10b981" />
              <StatCard label="탄수 범위" value={String(carbohydrateDays)} unit="일" color="#6366f1" />
              <StatCard label="채소 목표" value={String(vegetableDays)} unit="일" color="#f59e0b" />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                ['정상식사', qualityTotals.normal], ['방어간식', qualityTotals.defensive],
                ['초가공', qualityTotals.ultraProcessed], ['당 음료', qualityTotals.sugaryDrink],
              ].map(([label, value]) => <div key={String(label)} className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-[9px] text-gray-400">{label}</p><p className="text-sm font-bold text-gray-700">{value}회</p></div>)}
            </div>
          </>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="운동 세션" value={String(weeklyWorkouts.length)} unit="회" color="#6366f1" />
        <StatCard label="운동 시간" value={String(workoutMinutes)} unit="분" color="#10b981" />
        <StatCard label="공복 구간" value={String(fastingIntervals.length)} unit="회" color="#f59e0b" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="평균 걸음" value={averageSteps > 0 ? averageSteps.toLocaleString() : '—'} unit={averageSteps > 0 ? '보' : ''} color="#6366f1" />
        <StatCard label="평균 수면" value={averageSleepMinutes > 0 ? (averageSleepMinutes / 60).toFixed(1) : '—'} unit={averageSleepMinutes > 0 ? '시간' : ''} color="#8b5cf6" />
        <StatCard label="최근 체중" value={latestWeight == null ? '—' : latestWeight.toFixed(1)} unit={latestWeight == null ? '' : 'kg'} color="#10b981" />
      </div>
    </div>
  )

  if (!cycleStartDate) {
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        {weeklyNutritionCard}
        <p className="text-gray-400 text-sm text-center">8일 근무 주기 요약은 오늘 탭에서 주기 시작일을 설정하면 표시됩니다.</p>
      </div>
    )
  }

  const recordedLogs = logs
  const count = recordedLogs.length
  const averageScore = count > 0
    ? recordedLogs.reduce((s, l) => s + l.score, 0) / count
    : 0
  const achievedDays = recordedLogs.filter(log => log.achieved).length
  // 운동 기록한 날
  const exerciseDays = recordedLogs.filter(l => l.behaviors.exercise).length

  const { label: statusLabel, color: statusColor } = getCycleStatus(achievedDays, count)

  const anchor = parseISO(cycleStartDate)
  const today = parseISO(todayStr)
  const diff = differenceInDays(today, anchor)
  const cycleDay = ((diff % 8) + 8) % 8
  const cycleNumber = Math.floor(diff < 0 ? 0 : diff / 8) + 1
  const cycleStartStr = format(addDays(today, -cycleDay), 'yyyy-MM-dd')

  const SHIFT_PATTERN: ShiftType[] = [
    'day', 'day', 'night', 'off_after_night', 'holiday', 'night', 'off_after_night', 'holiday',
  ]

  const cycleDays = Array.from({ length: 8 }, (_, i) => {
    const dateStr = format(addDays(parseISO(cycleStartStr), i), 'yyyy-MM-dd')
    const log = recordedLogs.find(l => l.date === dateStr)
    const shiftType = SHIFT_PATTERN[i]
    const isFuture = dateStr > todayStr
    const isToday = dateStr === todayStr
    return { dateStr, log, shiftType, isFuture, isToday, dayIndex: i }
  })

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      {weeklyNutritionCard}
      {/* 주기 헤더 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 mb-0.5">현재 주기</p>
            <p className="text-gray-900 font-bold text-lg">{cycleNumber}주기</p>
            <p className="text-gray-400 text-xs">
              {format(parseISO(cycleStartStr), 'M/d', { locale: ko })} ~ {format(addDays(parseISO(cycleStartStr), 7), 'M/d', { locale: ko })}
            </p>
          </div>
          <div
            className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: statusColor + '18', color: statusColor }}
          >
            {statusLabel}
          </div>
        </div>
      </div>

      {/* 8일 타임라인 */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">8일 타임라인</p>
        <div className="grid grid-cols-4 gap-2">
          {cycleDays.map(({ dateStr, log, shiftType, isFuture, isToday, dayIndex }) => {
            const shiftColor = SHIFT_COLORS[shiftType]
            return (
              <div
                key={dateStr}
                className={`rounded-xl p-2 text-center border ${
                  isToday ? 'border-indigo-300' : 'border-transparent'
                } ${isFuture ? 'opacity-30' : ''}`}
                style={{ background: shiftColor + '12' }}
              >
                <p className="text-[10px] mb-0.5" style={{ color: shiftColor }}>
                  {SHIFT_LABELS[shiftType]}
                </p>
                <p className="text-[10px] text-gray-400 mb-1">{format(parseISO(dateStr), 'M/d')}</p>
                {log ? (
                  <p className={`text-base font-bold ${log.achieved ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {log.score}
                  </p>
                ) : (
                  <p className="text-base text-gray-200">—</p>
                )}
                {isToday && <p className="text-[9px] text-indigo-400 mt-0.5">오늘</p>}
                {!isFuture && !isToday && <p className="text-[9px] text-gray-300 mt-0.5">{dayIndex + 1}일차</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* 집계 카드 */}
      {count > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="핵심 달성일" value={String(achievedDays)} unit={`/ ${count}일`} color="#10b981" />
            <StatCard label="운동 횟수" value={String(exerciseDays)} unit={`/ ${count}일`} color="#6366f1" />
            <StatCard label="평균 점수" value={averageScore.toFixed(1)} unit="/ 5" color={averageScore >= 3 ? '#10b981' : '#ef4444'} />
          </div>

          {/* 일별 점수 로그 */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">일별 기록</p>
            <div className="space-y-2">
              {recordedLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: SHIFT_COLORS[log.shiftType] }}
                  />
                  <span className="text-xs text-gray-400 w-14 shrink-0">{format(parseISO(log.date), 'M/d (EEE)', { locale: ko })}</span>
                  <span className="text-xs text-gray-400">{SHIFT_LABELS[log.shiftType]}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${log.achieved ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      style={{ width: `${(log.score / 5) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-6 text-right shrink-0 ${log.achieved ? 'text-emerald-500' : 'text-gray-400'}`}>
                    {log.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-300 text-sm">이번 주기에 기록된 데이터가 없습니다.</p>
          <p className="text-gray-200 text-xs mt-1">오늘 탭에서 행동을 체크하고 저장해 보세요.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5">
      <p className="text-[11px] text-gray-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold" style={{ color }}>{value}</span>
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
    </div>
  )
}
