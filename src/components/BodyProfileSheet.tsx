import { useState } from 'react'
import { db } from '../db/database'
import type { BodyProfile, UserNutritionTargets } from '../db/database'
import { recommendTargets } from '../utils/bodyProfile'

interface Props {
  current: BodyProfile | null
  currentTargets: UserNutritionTargets | null
  onClose: () => void
  onSaved: (profile: BodyProfile, targets?: UserNutritionTargets) => void
}

const PERSONAL_DEFAULTS = {
  age: 37,
  heightCm: 173,
  weightKg: 93,
  weeklyExerciseSessions: 3,
  averageDailySteps: 7000,
}

export default function BodyProfileSheet({ current, currentTargets, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    age: String(current?.age ?? PERSONAL_DEFAULTS.age),
    heightCm: String(current?.heightCm ?? PERSONAL_DEFAULTS.heightCm),
    weightKg: String(current?.weightKg ?? PERSONAL_DEFAULTS.weightKg),
    weeklyExerciseSessions: String(current?.weeklyExerciseSessions ?? PERSONAL_DEFAULTS.weeklyExerciseSessions),
    averageDailySteps: String(current?.averageDailySteps ?? PERSONAL_DEFAULTS.averageDailySteps),
  }))
  const [error, setError] = useState('')

  const draft = {
    age: Number(form.age),
    heightCm: Number(form.heightCm),
    weightKg: Number(form.weightKg),
    weeklyExerciseSessions: Number(form.weeklyExerciseSessions),
    averageDailySteps: Number(form.averageDailySteps),
  }
  const valid = draft.age >= 18 && draft.heightCm >= 120 && draft.heightCm <= 230
    && draft.weightKg >= 35 && draft.weightKg <= 300
    && draft.weeklyExerciseSessions >= 0 && draft.weeklyExerciseSessions <= 14
    && draft.averageDailySteps >= 0 && draft.averageDailySteps <= 100_000
  const recommendation = valid ? recommendTargets(draft) : null

  const save = async (applyRecommendation: boolean) => {
    if (!valid || !recommendation) {
      setError('나이·키·체중·운동 횟수·걸음 수를 확인해 주세요.')
      return
    }
    const now = Date.now()
    const profile: BodyProfile = {
      id: current?.id,
      ...draft,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    }
    profile.id = await db.bodyProfiles.put(profile) as number

    let targets: UserNutritionTargets | undefined
    if (applyRecommendation) {
      targets = {
        id: currentTargets?.id,
        ...recommendation.targets,
        source: 'PROFILE_RECOMMENDATION',
        profileUpdatedAt: now,
        createdAt: currentTargets?.createdAt ?? now,
        updatedAt: now,
      }
      targets.id = await db.nutritionTargets.put(targets) as number
    }
    onSaved(profile, targets)
    onClose()
  }

  const fields: Array<{ key: keyof typeof form; label: string; unit: string }> = [
    { key: 'age', label: '나이', unit: '세' },
    { key: 'heightCm', label: '키', unit: 'cm' },
    { key: 'weightKg', label: '현재 체중', unit: 'kg' },
    { key: 'weeklyExerciseSessions', label: '주간 운동', unit: '회' },
    { key: 'averageDailySteps', label: '평균 걸음', unit: '보' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="modal-sheet max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5" onClick={event => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div><h3 className="text-lg font-semibold text-gray-900">신체 프로필</h3><p className="mt-1 text-xs text-gray-400">생활습관 목표 추천에만 사용하며 진단값이 아닙니다.</p></div>
          <button type="button" onClick={onClose} aria-label="닫기" className="h-8 w-8 text-2xl text-gray-400">✕</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(field => (
            <label key={field.key} className={field.key === 'averageDailySteps' ? 'col-span-2 text-xs text-gray-500' : 'text-xs text-gray-500'}>
              {field.label} ({field.unit})
              <input type="number" min="0" inputMode="decimal" value={form[field.key]}
                onChange={event => { setForm(previous => ({ ...previous, [field.key]: event.target.value })); setError('') }}
                className="mt-1 w-full rounded-xl bg-gray-100 px-3 py-2.5 text-gray-900 outline-none" />
            </label>
          ))}
        </div>
        {recommendation ? (
          <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="text-xs font-semibold text-indigo-800">추천 목표 · 기준체중 {recommendation.referenceWeightKg}kg</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-indigo-700">
              <span>단백질 {recommendation.targets.proteinMinGrams}~{recommendation.targets.proteinMaxGrams}g</span>
              <span>탄수화물 {recommendation.targets.carbohydrateMinGrams}~{recommendation.targets.carbohydrateMaxGrams}g</span>
              <span>채소 {recommendation.targets.vegetableTargetGrams}g+</span>
              <span>운동 {recommendation.targets.exerciseMinutes}분</span>
            </div>
          </div>
        ) : null}
        {error ? <p role="alert" className="mt-3 text-xs text-red-500">{error}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void save(false)} className="rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-600">프로필만 저장</button>
          <button type="button" onClick={() => void save(true)} className="rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white">추천 목표 적용</button>
        </div>
      </div>
    </div>
  )
}
