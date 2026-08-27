import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../db/database'
import type { UserNutritionTargets } from '../db/database'
import { PERSONAL_DIET_PLAN, type DietPlanShift } from '../data/personalDietPlan'

const plan = PERSONAL_DIET_PLAN

interface LatestWeight {
  date: string
  weightKg: number
}

function newestWeight(values: Array<LatestWeight | null>): LatestWeight {
  return values
    .filter((value): value is LatestWeight => value !== null)
    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? {
      date: plan.goal.latestCheckAt,
      weightKg: plan.goal.latestWeightKg,
    }
}

function matchesPlan(targets: UserNutritionTargets | null): boolean {
  if (!targets) return false
  return targets.calorieMinKcal === plan.targets.calorieMinKcal
    && targets.calorieMaxKcal === plan.targets.calorieMaxKcal
    && targets.proteinMinGrams === plan.targets.proteinMinGrams
    && targets.proteinMaxGrams === plan.targets.proteinMaxGrams
    && targets.carbohydrateMinGrams === plan.targets.carbohydrateMinGrams
    && targets.carbohydrateMaxGrams === plan.targets.carbohydrateMaxGrams
    && targets.vegetableTargetGrams === plan.targets.vegetableTargetGrams
    && targets.dietaryFiberTargetGrams === plan.targets.dietaryFiberTargetGrams
}

function PlanSection({ title, description, children, open = false }: {
  title: string
  description?: string
  children: ReactNode
  open?: boolean
}) {
  return (
    <details open={open} className="group rounded-2xl border border-emerald-100 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          {description ? <span className="mt-0.5 block text-[11px] text-gray-400">{description}</span> : null}
        </span>
        <span className="text-lg text-emerald-400 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-emerald-50 px-4 py-4">{children}</div>
    </details>
  )
}

function TargetCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
      <p className="text-[10px] text-emerald-700/60">{label}</p>
      <p className="mt-0.5 text-base font-bold text-emerald-900">{value}</p>
      {note ? <p className="mt-0.5 text-[9px] text-emerald-700/55">{note}</p> : null}
    </div>
  )
}

export default function PersonalDietPlanTab() {
  const [shift, setShift] = useState<DietPlanShift>('day')
  const [applied, setApplied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [latestWeight, setLatestWeight] = useState<LatestWeight>({
    date: plan.goal.latestCheckAt,
    weightKg: plan.goal.latestWeightKg,
  })

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      db.nutritionTargets.orderBy('updatedAt').last(),
      db.weeklyMeasurements.orderBy('date').last(),
      db.inBodyRecords.orderBy('date').last(),
      db.healthRecords.where('dataType').equals('WEIGHT').sortBy('date'),
    ]).then(([targets, weekly, inBody, healthWeights]) => {
      if (cancelled) return

      setApplied(matchesPlan(targets ?? null))
      const health = healthWeights.at(-1)
      setLatestWeight(newestWeight([
        weekly?.weightKg && weekly.weightKg > 0 ? { date: weekly.date, weightKg: weekly.weightKg } : null,
        inBody?.weight && inBody.weight > 0 ? { date: inBody.date, weightKg: inBody.weight } : null,
        health?.value && health.value > 0 ? { date: health.date, weightKg: health.value } : null,
      ]))
    })

    return () => { cancelled = true }
  }, [])

  const progress = Math.max(0, Math.min(
    ((plan.goal.startWeightKg - latestWeight.weightKg) / (plan.goal.startWeightKg - plan.goal.firstGoalWeightKg)) * 100,
    100,
  ))

  const applyTargets = async () => {
    setSaving(true)
    const current = await db.nutritionTargets.orderBy('updatedAt').last()
    const now = Date.now()
    const next: UserNutritionTargets = {
      id: current?.id,
      ...plan.targets,
      source: 'MANUAL',
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }
    if (current?.id) await db.nutritionTargets.put(next)
    else next.id = await db.nutritionTargets.add(next) as number
    setApplied(true)
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-600 to-green-700 p-4 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-emerald-100">1차 감량 목표</p>
            <p className="mt-1 text-2xl font-bold">{plan.goal.firstGoalWeightKg}kg</p>
            <p className="mt-1 text-xs text-emerald-100">{plan.goal.firstGoalAt}까지 · 최종 {plan.goal.finalGoalWeightKg}kg</p>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2 text-right backdrop-blur">
            <p className="text-[10px] text-emerald-100">최근 체중</p>
            <p className="text-lg font-bold">{latestWeight.weightKg}kg</p>
            <p className="text-[9px] text-emerald-100">{latestWeight.date}</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/15">
          <div className="h-full rounded-full bg-lime-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-emerald-100">
          <span>시작 {plan.goal.startWeightKg}kg</span>
          <span>{progress.toFixed(0)}% 진행</span>
          <span>목표 {plan.goal.firstGoalWeightKg}kg</span>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">하루 영양 목표</h2>
            <p className="mt-0.5 text-[11px] text-gray-400">첫 2주 추세를 보고 미세 조정</p>
          </div>
          {applied ? <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">적용됨</span> : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <TargetCard label="열량" value="1,800~2,000" note="kcal" />
          <TargetCard label="단백질" value="140~150g" />
          <TargetCard label="탄수화물" value="130~160g" />
          <TargetCard label="지방" value="55~70g" />
          <TargetCard label="채소" value="500g+" />
          <TargetCard label="식이섬유" value="30g" />
        </div>
        <button
          type="button"
          disabled={saving || applied}
          onClick={() => void applyTargets()}
          className="mt-3 w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white disabled:bg-emerald-200"
        >
          {saving ? '적용 중…' : applied ? '✓ 식단 기록 목표에 적용됨' : '이 목표를 식단 기록에 적용'}
        </button>
      </section>

      <PlanSection title="근무별 식단" description="주간·야간·휴무 시간표" open>
        <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1">
          {(Object.keys(plan.shiftLabels) as DietPlanShift[]).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setShift(id)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium ${shift === id ? 'bg-emerald-500 text-white' : 'text-gray-400'}`}
            >
              {plan.shiftLabels[id]}
            </button>
          ))}
        </div>
        <ol className="space-y-3">
          {plan.shiftMeals[shift].map(meal => (
            <li key={`${meal.time}-${meal.title}`} className="flex gap-3">
              <span className="w-14 shrink-0 pt-0.5 font-mono text-[11px] font-semibold text-emerald-600">{meal.time}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gray-800">{meal.title}</span>
                <span className="mt-0.5 block text-[11px] leading-5 text-gray-500">{meal.items}</span>
              </span>
            </li>
          ))}
        </ol>
      </PlanSection>

      <PlanSection title="고기 종류별 한 끼 중량" description="조리 전 또는 포장 중량 기준">
        <div className="space-y-2.5">
          {plan.proteinPortions.map(item => (
            <div key={item.name} className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2.5 last:border-0 last:pb-0">
              <div><p className="text-xs font-semibold text-gray-800">{item.name}</p><p className="mt-0.5 text-[10px] text-gray-400">{item.note}</p></div>
              <span className="shrink-0 text-sm font-bold text-emerald-600">{item.grams}</span>
            </div>
          ))}
        </div>
      </PlanSection>

      <PlanSection title="일반 한식 양 조절" description="메뉴가 달라도 지키는 한 접시 규칙">
        <ul className="space-y-2">
          {plan.portionRules.map(rule => <li key={rule} className="flex gap-2 text-xs leading-5 text-gray-600"><span className="text-emerald-500">✓</span><span>{rule}</span></li>)}
        </ul>
      </PlanSection>

      <PlanSection title="추천 채소와 조합" description="매 끼니 2종류, 하루 총 500g 목표" open>
        <p className="mb-2 text-[11px] font-semibold text-gray-500">추천 채소</p>
        <div className="flex flex-wrap gap-1.5">
          {plan.vegetables.map(vegetable => <span key={vegetable} className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">{vegetable}</span>)}
        </div>
        <p className="mb-2 mt-4 text-[11px] font-semibold text-gray-500">간단 조합</p>
        <ul className="space-y-1.5">
          {plan.vegetableCombos.map(combo => <li key={combo} className="text-xs text-gray-600">• {combo}</li>)}
        </ul>
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3">
          <p className="text-[11px] font-semibold text-amber-800">탄수화물로 계산할 채소</p>
          <p className="mt-1.5 text-xs leading-5 text-amber-700">{plan.carbohydrateVegetables.join(' · ')}</p>
          <p className="mt-1 text-[10px] text-amber-600">충분히 먹은 끼니에는 밥을 빼거나 50g으로 줄이기</p>
        </div>
      </PlanSection>

      <PlanSection title="체중 추세 조정 규칙" description="하루 숫자 대신 7일 평균">
        <ul className="space-y-2">
          {plan.adjustmentRules.map(rule => <li key={rule} className="flex gap-2 text-xs leading-5 text-gray-600"><span className="text-emerald-500">•</span><span>{rule}</span></li>)}
        </ul>
      </PlanSection>
    </div>
  )
}
